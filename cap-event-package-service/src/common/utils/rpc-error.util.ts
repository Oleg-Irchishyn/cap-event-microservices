import type { RpcErrorPayload } from '@cap-event/contracts';
import { RpcException } from '@nestjs/microservices';

/** Builds the `RpcException({ status, message })` the gateway translates back to HTTP. */
export const rpcError = (status: number, message: string): RpcException => {
  const payload: RpcErrorPayload = { status, message };
  return new RpcException(payload);
};

export const badRequest = (message: string): RpcException =>
  rpcError(400, message);

export const notFound = (message: string): RpcException =>
  rpcError(404, message);
