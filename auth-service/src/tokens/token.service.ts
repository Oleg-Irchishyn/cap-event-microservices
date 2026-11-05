import {
  AccessTokenClaims,
  BEARER_TOKEN_TYPE,
  IdTokenClaims,
  PublicUser,
  TokenUse,
} from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { rpcError } from '../common/utils/rpc-error.util';
import { readPositiveInt } from '../config/config.util';

export interface TokenContext {
  issuer: string;
  clientId: string;
  nonce?: string;
}

/** Signs and verifies the HS256 JWTs. The gateway verifies access tokens with the same PRIVATE_KEY. */
@Injectable()
export class TokenService {
  readonly accessTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessTtlSeconds = readPositiveInt(
      config,
      'ACCESS_TOKEN_TTL_SECONDS',
      3600,
    );
  }

  async signTokens(
    user: PublicUser,
    ctx: TokenContext,
  ): Promise<{
    access_token: string;
    id_token: string;
    token_type: typeof BEARER_TOKEN_TYPE;
    expires_in: number;
  }> {
    const base = {
      sub: user.id,
      email: user.email,
      name: user.name,
      iss: ctx.issuer,
      aud: ctx.clientId,
    };
    const access: AccessTokenClaims = { ...base, token_use: TokenUse.ACCESS };
    const id: IdTokenClaims = {
      ...base,
      token_use: TokenUse.ID,
      ...(ctx.nonce ? { nonce: ctx.nonce } : {}),
    };
    const options = {
      algorithm: 'HS256' as const,
      expiresIn: this.accessTtlSeconds,
    };

    const [access_token, id_token] = await Promise.all([
      this.jwt.signAsync({ ...access }, options),
      this.jwt.signAsync({ ...id }, options),
    ]);
    return {
      access_token,
      id_token,
      token_type: BEARER_TOKEN_TYPE,
      expires_in: this.accessTtlSeconds,
    };
  }

  /** Verifies an id_token_hint. Expired tokens are fine for logout; forged ones are not. */
  async verifyIdTokenHint(token: string): Promise<IdTokenClaims> {
    try {
      const claims = await this.jwt.verifyAsync<IdTokenClaims>(token, {
        algorithms: ['HS256'],
        ignoreExpiration: true,
      });
      if (claims.token_use !== TokenUse.ID || !claims.sub) {
        throw new Error('not an id token');
      }
      return claims;
    } catch {
      throw rpcError(400, 'id_token_hint is invalid', 'invalid_request');
    }
  }
}
