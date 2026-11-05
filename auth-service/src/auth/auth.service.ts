import {
  AuthSession,
  IssueCodePayload,
  IssueCodeResult,
  LoginPayload,
  LogoutPayload,
  LogoutResult,
  MePayload,
  PublicUser,
  RegisterPayload,
  TokenExchangePayload,
  TokenRefreshPayload,
  TokenSet,
  ValidateCredentialsPayload,
} from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';

import { AuthorizationCodeService } from '../authorization-code/authorization-code.service';
import { requireString } from '../common/utils/require-string.util';
import { invalidGrant } from '../common/utils/rpc-error.util';
import { RefreshTokenService } from '../tokens/refresh-token.service';
import { TokenService } from '../tokens/token.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly codes: AuthorizationCodeService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly tokens: TokenService,
  ) {}

  register(payload: RegisterPayload): Promise<PublicUser> {
    return this.users.register(payload);
  }

  validateCredentials(
    payload: ValidateCredentialsPayload,
  ): Promise<PublicUser> {
    return this.users.validateCredentials(payload);
  }

  async login(payload: LoginPayload): Promise<AuthSession> {
    const user = await this.users.validateCredentials(payload);
    const tokens = await this.issueTokenSet(
      user,
      requireString(payload.clientId, 'clientId'),
      requireString(payload.issuer, 'issuer'),
    );
    return { ...tokens, user };
  }

  issueCode(payload: IssueCodePayload): Promise<IssueCodeResult> {
    return this.codes.issue(payload);
  }

  async exchangeCode(payload: TokenExchangePayload): Promise<TokenSet> {
    const issuer = requireString(payload.issuer, 'issuer');
    const { userId, nonce } = await this.codes.consume(payload);
    const user = await this.findUserForGrant(userId);
    return this.issueTokenSet(user, payload.clientId, issuer, nonce);
  }

  async refresh(payload: TokenRefreshPayload): Promise<TokenSet> {
    const issuer = requireString(payload.issuer, 'issuer');
    const clientId = requireString(payload.clientId, 'clientId');
    const refreshToken = requireString(payload.refreshToken, 'refreshToken');

    const { userId } = await this.refreshTokens.consume(refreshToken, clientId);
    const user = await this.findUserForGrant(userId);
    return this.issueTokenSet(user, clientId, issuer);
  }

  me(payload: MePayload): Promise<PublicUser> {
    return this.users.findById(payload.userId);
  }

  async logout(payload: LogoutPayload): Promise<LogoutResult> {
    const claims = await this.tokens.verifyIdTokenHint(
      requireString(payload.idTokenHint, 'idTokenHint'),
    );
    return { revoked: await this.refreshTokens.revokeAllForUser(claims.sub) };
  }

  // A grant for a user that was deleted meanwhile is an invalid grant, not a 404.
  private async findUserForGrant(userId: string): Promise<PublicUser> {
    try {
      return await this.users.findById(userId);
    } catch {
      throw invalidGrant('The user for this grant no longer exists');
    }
  }

  private async issueTokenSet(
    user: PublicUser,
    clientId: string,
    issuer: string,
    nonce?: string,
  ): Promise<TokenSet> {
    const signed = await this.tokens.signTokens(user, {
      issuer,
      clientId,
      nonce,
    });
    const refresh_token = await this.refreshTokens.issue(user.id, clientId);
    return { ...signed, refresh_token };
  }
}
