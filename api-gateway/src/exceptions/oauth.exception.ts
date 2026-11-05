import type { OAuthErrorCode } from '@cap-event/contracts';
import { HttpException } from '@nestjs/common';

/** RFC 6749 section 5.2 error response: `{ error, error_description }`. */
export class OAuthException extends HttpException {
  constructor(
    readonly error: OAuthErrorCode,
    readonly errorDescription: string,
    status = 400,
  ) {
    super({ error, error_description: errorDescription }, status);
  }
}
