import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { toHttpException } from './rpc-error.util';

/** `client.send` + translation of every failure into an HttpException. */
export const rpcCall = async <T>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
  serviceLabel: string,
): Promise<T> => {
  try {
    return await firstValueFrom(client.send<T>(pattern, payload));
  } catch (error) {
    throw toHttpException(error, serviceLabel);
  }
};

/** Query strings give `string | string[] | undefined`; services want `string[] | undefined`. */
export const toStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return (Array.isArray(value) ? value : [value]).map(String);
};
