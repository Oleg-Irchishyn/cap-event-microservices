import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

import { OAuthException } from './oauth.exception';
import { ValidationException } from './validation.exception';

/**
 * Renders any HttpException thrown inside the token endpoint in OAuth2 shape.
 * Applied only to /oidc/2/token; the rest of the API keeps Nest's default JSON.
 */
@Catch(HttpException)
export class OAuthExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();

    let body: { error: string; error_description: string };
    if (exception instanceof OAuthException) {
      body = {
        error: exception.error,
        error_description: exception.errorDescription,
      };
    } else if (exception instanceof ValidationException) {
      body = {
        error: 'invalid_request',
        error_description: [exception.messages].flat().join('; '),
      };
    } else {
      body = {
        error: status >= 500 ? 'server_error' : 'invalid_request',
        error_description: exception.message,
      };
    }

    res
      .status(status)
      .set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })
      .json(body);
  }
}
