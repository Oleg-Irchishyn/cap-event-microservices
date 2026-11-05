import { AccessTokenClaims, TokenUse } from '@cap-event/contracts';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { OidcConfigService } from '../oidc/oidc-config.service';

/**
 * Verifies the Bearer access token locally (HS256 + PRIVATE_KEY shared with
 * auth-service), with no network round-trip. Id tokens signed with the same
 * key are rejected via the `token_use` claim.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly oidc: OidcConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('User is not authorized');
    }

    try {
      const claims = await this.jwtService.verifyAsync<AccessTokenClaims>(
        token,
        {
          algorithms: ['HS256'],
          issuer: this.oidc.issuer,
          audience: this.oidc.clientId,
        },
      );
      if (claims.token_use !== TokenUse.ACCESS || !claims.sub) {
        throw new Error('not an access token');
      }
      req.user = claims;
      return true;
    } catch {
      throw new UnauthorizedException('User is not authorized');
    }
  }

  private extractToken(req: Request): string | undefined {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    return scheme === 'Bearer' && token ? token : undefined;
  }
}
