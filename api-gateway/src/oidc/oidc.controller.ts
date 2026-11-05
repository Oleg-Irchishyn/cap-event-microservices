import { AuthPattern, PKCE_METHOD_S256 } from '@cap-event/contracts';
import type {
  IssueCodeResult,
  PublicUser,
  TokenSet,
} from '@cap-event/contracts';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Res,
  UseFilters,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { isEmail } from 'class-validator';
import type { Response } from 'express';
import { firstValueFrom, Observable } from 'rxjs';

import {
  AuthorizeParseResult,
  AuthorizeRequestService,
  asString,
} from './authorize-request.service';
import { TokenResponseDto } from '../auth/dto/auth-response.dto';
import { OAuthExceptionFilter } from '../exceptions/oauth-exception.filter';
import { OAuthException } from '../exceptions/oauth.exception';
import { AuthorizeFormDto } from './dto/authorize-form.dto';
import { DiscoveryDocumentDto } from './dto/discovery-document.dto';
import { TokenRequestDto } from './dto/token-request.dto';
import {
  LoginMode,
  renderLoginPage,
  renderMessagePage,
} from './html/login-page.util';
import { OIDC_BASE_PATH, OidcConfigService } from './oidc-config.service';
import { toFormError, toOAuthException } from '../common/utils/rpc-error.util';
import { OAuthErrorDto } from '../exceptions/dto/oauth-error.dto';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
  'Referrer-Policy': 'no-referrer',
};

/** Fake OneLogin: the same Authorization Code + PKCE endpoints the UI already speaks. */
@ApiTags('OIDC (fake OneLogin)')
@Controller(OIDC_BASE_PATH.slice(1))
export class OidcController {
  private readonly logger = new Logger(OidcController.name);

  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    private readonly oidc: OidcConfigService,
    private readonly authorize: AuthorizeRequestService,
  ) {}

  @ApiOperation({ summary: 'OpenID Connect discovery document' })
  @ApiOkResponse({ type: DiscoveryDocumentDto })
  @Get('.well-known/openid-configuration')
  discovery(): DiscoveryDocumentDto {
    const issuer = this.oidc.issuer;
    return {
      issuer,
      authorization_endpoint: `${issuer}/auth`,
      token_endpoint: `${issuer}/token`,
      end_session_endpoint: `${issuer}/logout`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['HS256'],
      scopes_supported: ['openid', 'profile', 'email'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: [PKCE_METHOD_S256],
      claims_supported: [
        'sub',
        'email',
        'name',
        'iss',
        'aud',
        'iat',
        'exp',
        'nonce',
      ],
    };
  }

  @ApiOperation({
    summary:
      'Authorization endpoint - renders the HTML sign-in / register form',
    description:
      'Returns text/html (not JSON). Add `mode=register` to show the registration form. ' +
      'An unknown client_id or unregistered redirect_uri renders an error page (400) and never redirects.',
  })
  @ApiProduces('text/html')
  @ApiQuery({ name: 'client_id', required: true, example: 'cap-event-ui' })
  @ApiQuery({ name: 'redirect_uri', required: true })
  @ApiQuery({ name: 'response_type', required: true, example: 'code' })
  @ApiQuery({ name: 'code_challenge', required: true })
  @ApiQuery({ name: 'code_challenge_method', required: true, example: 'S256' })
  @ApiQuery({ name: 'scope', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'resource', required: false })
  @ApiQuery({ name: 'nonce', required: false })
  @ApiQuery({ name: 'prompt', required: false, example: 'login' })
  @ApiQuery({ name: 'mode', required: false, enum: ['login', 'register'] })
  @ApiResponse({
    status: 200,
    description: 'HTML form',
    content: { 'text/html': {} },
  })
  @ApiResponse({
    status: 302,
    description:
      'Redirect to redirect_uri with error=... for non-fatal request errors',
  })
  @ApiBadRequestResponse({
    description: 'HTML error page',
    content: { 'text/html': {} },
  })
  @Get('auth')
  showForm(
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ): void {
    const parsed = this.authorize.parse(query);
    if (parsed.kind !== 'ok') {
      return this.respondToInvalid(parsed, res);
    }
    const mode: LoginMode = query.mode === 'register' ? 'register' : 'login';
    this.sendHtml(res, 200, renderLoginPage({ params: parsed.params, mode }));
  }

  @ApiOperation({
    summary: 'Submit the sign-in / register form',
    description:
      'On success issues a one-time authorization code (2 min TTL, bound to client, redirect_uri and PKCE challenge) ' +
      'and answers 302 to `redirect_uri?code=...&state=...`. On bad credentials re-renders the HTML form (401) with an error.',
  })
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiBody({ type: AuthorizeFormDto })
  @ApiFoundResponse({
    description: 'Redirect to redirect_uri with code and state',
  })
  @ApiResponse({
    status: 400,
    description: 'HTML form with validation error',
    content: { 'text/html': {} },
  })
  @ApiResponse({
    status: 401,
    description: 'HTML form with "Invalid email or password"',
    content: { 'text/html': {} },
  })
  @ApiResponse({
    status: 409,
    description: 'HTML form: email already registered',
    content: { 'text/html': {} },
  })
  @Post('auth')
  async submitForm(
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    const parsed = this.authorize.parse(body);
    if (parsed.kind !== 'ok') {
      return this.respondToInvalid(parsed, res);
    }
    const { params } = parsed;

    const mode: LoginMode = body.mode === 'register' ? 'register' : 'login';
    const email = asString(body.email)?.trim() ?? '';
    const password = asString(body.password) ?? '';
    const name = asString(body.name)?.trim() ?? '';

    const rerender = (status: number, error: string): void =>
      this.sendHtml(
        res,
        status,
        renderLoginPage({ params, mode, error, email, name }),
      );

    if (!isEmail(email) || password.length === 0) {
      return rerender(400, 'Enter a valid email address and a password.');
    }
    if (mode === 'register' && name.length === 0) {
      return rerender(400, 'Enter your name.');
    }

    try {
      const user = await firstValueFrom(
        mode === 'register'
          ? this.authClient.send<PublicUser>(AuthPattern.REGISTER, {
              email,
              password,
              name,
            })
          : this.authClient.send<PublicUser>(AuthPattern.VALIDATE_CREDENTIALS, {
              email,
              password,
            }),
      );
      const { code } = await firstValueFrom(
        this.authClient.send<IssueCodeResult>(AuthPattern.CODE_ISSUE, {
          userId: user.id,
          clientId: params.clientId,
          redirectUri: params.redirectUri,
          codeChallenge: params.codeChallenge,
          codeChallengeMethod: PKCE_METHOD_S256,
          nonce: params.nonce,
        }),
      );
      res.redirect(
        302,
        this.authorize.buildRedirect(params.redirectUri, {
          code,
          state: params.state,
        }),
      );
    } catch (error) {
      const { status, message } = toFormError(error);
      if (status >= 500) this.logger.error('Sign-in failed', error as Error);
      rerender(status, message);
    }
  }

  @ApiOperation({
    summary:
      'Token endpoint - authorization_code (PKCE) and refresh_token grants',
    description:
      'Called from the browser with fetch (CORS allows CLIENT_URL). The code is single use; refresh tokens rotate on every use. ' +
      'Errors follow RFC 6749: `{ error, error_description }`.',
  })
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiBody({ type: TokenRequestDto })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiBadRequestResponse({
    type: OAuthErrorDto,
    description: 'invalid_request, invalid_grant, unsupported_grant_type',
  })
  @ApiResponse({
    status: 401,
    type: OAuthErrorDto,
    description: 'invalid_client',
  })
  @UseFilters(OAuthExceptionFilter)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Post('token')
  async token(@Body() dto: TokenRequestDto): Promise<TokenSet> {
    if (!this.oidc.isClientValid(dto.client_id)) {
      throw new OAuthException('invalid_client', 'Unknown client_id', 401);
    }
    const base = { clientId: dto.client_id, issuer: this.oidc.issuer };

    let request: Observable<TokenSet>;
    if (dto.grant_type === 'authorization_code') {
      if (!dto.code || !dto.redirect_uri || !dto.code_verifier) {
        throw new OAuthException(
          'invalid_request',
          'code, redirect_uri and code_verifier are required',
        );
      }
      request = this.authClient.send<TokenSet>(AuthPattern.TOKEN_EXCHANGE, {
        ...base,
        code: dto.code,
        redirectUri: dto.redirect_uri,
        codeVerifier: dto.code_verifier,
      });
    } else if (dto.grant_type === 'refresh_token') {
      if (!dto.refresh_token) {
        throw new OAuthException(
          'invalid_request',
          'refresh_token is required',
        );
      }
      request = this.authClient.send<TokenSet>(AuthPattern.TOKEN_REFRESH, {
        ...base,
        refreshToken: dto.refresh_token,
      });
    } else {
      throw new OAuthException(
        'unsupported_grant_type',
        'grant_type must be authorization_code or refresh_token',
      );
    }

    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toOAuthException(error);
    }
  }

  @ApiOperation({
    summary:
      "End-session endpoint - revokes the user's refresh tokens and redirects",
    description:
      'Revokes every refresh token of the user named by `id_token_hint`, then answers 302 to `post_logout_redirect_uri` ' +
      '(must be on an allowed origin). Without a redirect, renders a "signed out" HTML page.',
  })
  @ApiProduces('text/html')
  @ApiQuery({ name: 'id_token_hint', required: false })
  @ApiQuery({ name: 'post_logout_redirect_uri', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiFoundResponse({ description: 'Redirect to post_logout_redirect_uri' })
  @ApiResponse({
    status: 200,
    description: 'HTML "signed out" page',
    content: { 'text/html': {} },
  })
  @ApiBadRequestResponse({
    description: 'HTML error page: unregistered post_logout_redirect_uri',
    content: { 'text/html': {} },
  })
  @Get('logout')
  async logout(
    @Query() query: Record<string, unknown>,
    @Res() res: Response,
  ): Promise<void> {
    const hint = asString(query.id_token_hint);
    const target = asString(query.post_logout_redirect_uri);
    const state = asString(query.state);

    if (hint) {
      try {
        await firstValueFrom(
          this.authClient.send(AuthPattern.LOGOUT, { idTokenHint: hint }),
        );
      } catch (error) {
        const { status } = toFormError(error);
        if (status >= 500) {
          this.logger.error('Logout failed', error as Error);
          return this.sendHtml(
            res,
            status,
            renderMessagePage('Sign-out failed', 'Please try again.'),
          );
        }
        // A bad hint just means there is nothing to revoke; still end the session.
        this.logger.warn('Ignoring invalid id_token_hint on logout');
      }
    }

    if (!target) {
      return this.sendHtml(
        res,
        200,
        renderMessagePage('Signed out', 'You have been signed out.'),
      );
    }
    if (!this.oidc.isPostLogoutRedirectAllowed(target)) {
      return this.sendHtml(
        res,
        400,
        renderMessagePage(
          'Invalid request',
          'post_logout_redirect_uri is not registered for this client.',
        ),
      );
    }
    res.redirect(302, this.authorize.buildRedirect(target, { state }));
  }

  private respondToInvalid(
    result: Exclude<AuthorizeParseResult, { kind: 'ok' }>,
    res: Response,
  ): void {
    if (result.kind === 'invalid') {
      return this.sendHtml(
        res,
        400,
        renderMessagePage('Invalid request', result.message),
      );
    }
    res.redirect(
      302,
      this.authorize.buildRedirect(result.redirectUri, {
        error: result.error,
        error_description: result.description,
        state: result.state,
      }),
    );
  }

  private sendHtml(res: Response, status: number, html: string): void {
    res.status(status).set(HTML_HEADERS).send(html);
  }
}
