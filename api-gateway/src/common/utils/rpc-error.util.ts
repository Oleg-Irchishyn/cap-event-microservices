import type { OAuthErrorCode } from '@cap-event/contracts';
import { HttpException, HttpStatus } from '@nestjs/common';

import { OAuthException } from '../../exceptions/oauth.exception';

interface RpcErrorShape {
  status?: unknown;
  message?: unknown;
  error?: unknown;
  code?: unknown;
}

const isRpcError = (
  e: RpcErrorShape,
): e is { status: number; message: string; error?: OAuthErrorCode } =>
  typeof e?.status === 'number' && typeof e?.message === 'string';

const isConnectionError = (e: RpcErrorShape): boolean =>
  e?.code === 'ECONNREFUSED' || e?.code === 'ECONNRESET';

/**
 * auth-service throws `RpcException({ status, message })`, which arrives here
 * as that exact object. Anything else (connection failure, unhandled error in
 * the service) is NOT forwarded verbatim: its message could leak internals.
 */
export const toHttpException = (
  error: unknown,
  serviceLabel = 'Authentication service',
): HttpException => {
  const shape = error as RpcErrorShape;
  if (isRpcError(shape)) {
    return new HttpException(shape.message, shape.status);
  }
  if (isConnectionError(shape)) {
    return new HttpException(
      `${serviceLabel} unavailable`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
  return new HttpException(
    'Internal server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
};

/** Same translation, but into an OAuth2 `{ error, error_description }` exception. */
export const toOAuthException = (error: unknown): OAuthException => {
  const shape = error as RpcErrorShape;
  if (isRpcError(shape) && shape.status < 500) {
    return new OAuthException(
      shape.error ??
        (shape.status === 401 ? 'invalid_client' : 'invalid_request'),
      shape.message,
      shape.status,
    );
  }
  const http = toHttpException(error);
  return new OAuthException('server_error', http.message, http.getStatus());
};

/** Status + user-safe message for re-rendering the HTML login form. */
export const toFormError = (
  error: unknown,
): { status: number; message: string } => {
  const shape = error as RpcErrorShape;
  if (isRpcError(shape) && shape.status < 500) {
    return { status: shape.status, message: shape.message };
  }
  const http = toHttpException(error);
  return {
    status: http.getStatus(),
    message: 'Sign-in is temporarily unavailable, please try again.',
  };
};
