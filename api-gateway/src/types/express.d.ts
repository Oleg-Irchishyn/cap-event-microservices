import type { AccessTokenClaims } from '@cap-event/contracts';

declare global {
  namespace Express {
    interface Request {
      /** Set by JwtGuard from the verified access token. */
      user?: AccessTokenClaims;
    }
  }
}
