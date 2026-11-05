import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

import type { ErrorReason, ErrorResponseDto } from './dto/error-response.dto';
import { ValidationException } from './validation.exception';

const reasonFor = (status: number, validation: boolean): ErrorReason => {
  if (validation) return 'VALIDATION_ERROR';
  if (status === 401) return 'ACCESS_DENIED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'RESOURCE_NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status >= 500) return 'INTERNAL_SERVER_ERROR';
  return 'BAD_REQUEST';
};

/** Splits the pipe's "field - message" strings into ErrorDetail objects. */
const toDetail = (text: string) => {
  const [field, ...rest] = text.split(' - ');
  return rest.length > 0
    ? { field, reason: 'INVALID_VALUE', message: rest.join(' - ') }
    : { reason: 'INVALID_VALUE', message: text };
};

/**
 * Renders errors of the reference-data / cap-event-package routes in the
 * `ErrorResponse` shape of the OpenAPI specs (reason, message, details,
 * timestamp, requestId). Anything that is not an HttpException becomes a
 * generic 500 and is only logged, never echoed.
 */
@Catch()
export class ErrorResponseFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorResponseFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    res.status(body.status).json(body.payload);
  }

  private toBody(exception: unknown): {
    status: number;
    payload: ErrorResponseDto;
  } {
    const base = {
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
    };

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        payload: {
          reason: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          ...base,
        },
      };
    }

    const status = exception.getStatus();
    if (exception instanceof ValidationException) {
      const messages = [exception.messages].flat();
      return {
        status,
        payload: {
          reason: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: messages.map(toDetail),
          ...base,
        },
      };
    }

    const response = exception.getResponse();
    const raw =
      typeof response === 'object' && response !== null && 'message' in response
        ? response.message
        : exception.message;
    const messages = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    return {
      status,
      payload: {
        reason: reasonFor(status, false),
        message: messages[0],
        ...(messages.length > 1 ? { details: messages.map(toDetail) } : {}),
        ...base,
      },
    };
  }
}
