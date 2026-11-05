import { PKCE_METHOD_S256 } from '@cap-event/contracts';
import type { OAuthErrorCode } from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';

import { OidcConfigService } from './oidc-config.service';

const MAX_PARAM_LENGTH = 2048;
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9\-_]{43}$/;

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  state?: string;
  resource?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  nonce?: string;
  prompt?: string;
}

export type AuthorizeParseResult =
  /** client_id / redirect_uri are untrustworthy: show an error page, never redirect. */
  | { kind: 'invalid'; message: string }
  /** redirect_uri is trusted: report the error back to the client. */
  | {
      kind: 'redirect_error';
      redirectUri: string;
      error: OAuthErrorCode;
      description: string;
      state?: string;
    }
  | { kind: 'ok'; params: AuthorizeParams };

/** Reads a request value only if it is a plain string (query/body values can be arrays or objects). */
export const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

@Injectable()
export class AuthorizeRequestService {
  constructor(private readonly oidc: OidcConfigService) {}

  parse(raw: Record<string, unknown>): AuthorizeParseResult {
    const clientId = asString(raw.client_id);
    const redirectUri = asString(raw.redirect_uri);

    if (!clientId || !this.oidc.isClientValid(clientId)) {
      return { kind: 'invalid', message: 'Unknown or missing client_id.' };
    }
    if (!redirectUri || !this.oidc.isRedirectUriAllowed(redirectUri)) {
      return {
        kind: 'invalid',
        message: 'redirect_uri is missing or not registered for this client.',
      };
    }

    const state = asString(raw.state);
    const fail = (
      error: OAuthErrorCode,
      description: string,
    ): AuthorizeParseResult => ({
      kind: 'redirect_error',
      redirectUri,
      error,
      description,
      state,
    });

    const optional = (key: string): string | undefined => asString(raw[key]);
    const all = [
      'state',
      'scope',
      'resource',
      'nonce',
      'prompt',
      'code_challenge',
      'code_challenge_method',
      'response_type',
    ];
    if (all.some((key) => (optional(key)?.length ?? 0) > MAX_PARAM_LENGTH)) {
      return fail('invalid_request', 'A request parameter is too long');
    }

    if (optional('response_type') !== 'code') {
      return fail(
        'unsupported_response_type',
        'Only response_type=code is supported',
      );
    }
    const codeChallenge = optional('code_challenge');
    if (!codeChallenge || !CODE_CHALLENGE_PATTERN.test(codeChallenge)) {
      return fail(
        'invalid_request',
        'A valid S256 code_challenge is required (PKCE)',
      );
    }
    if (optional('code_challenge_method') !== PKCE_METHOD_S256) {
      return fail('invalid_request', 'code_challenge_method must be S256');
    }

    return {
      kind: 'ok',
      params: {
        clientId,
        redirectUri,
        responseType: 'code',
        scope: optional('scope') ?? 'openid',
        state,
        resource: optional('resource'),
        codeChallenge,
        codeChallengeMethod: PKCE_METHOD_S256,
        nonce: optional('nonce'),
        prompt: optional('prompt'),
      },
    };
  }

  /** Appends params to a (pre-validated) redirect URI, skipping undefined values. */
  buildRedirect(
    redirectUri: string,
    query: Record<string, string | undefined>,
  ): string {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    return url.toString();
  }
}
