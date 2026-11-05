import { rpcError } from './rpc-error.util';

/**
 * Defense in depth: the gateway validates input, but this service must never
 * hand a non-string (e.g. an operator object) to a Mongo query.
 */
export const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw rpcError(
      400,
      `${field} must be a non-empty string`,
      'invalid_request',
    );
  }
  return value;
};
