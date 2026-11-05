import type { OAuthErrorCode, RpcErrorPayload } from '@cap-event/contracts';
import { RpcException } from '@nestjs/microservices';

/** Builds the `RpcException({ status, message, error? })` the gateway translates back to HTTP. */
export const rpcError = (
  status: number,
  message: string,
  error?: OAuthErrorCode,
): RpcException => {
  const payload: RpcErrorPayload = error
    ? { status, message, error }
    : { status, message };
  return new RpcException(payload);
};

export const invalidGrant = (description: string): RpcException =>
  rpcError(400, description, 'invalid_grant');
