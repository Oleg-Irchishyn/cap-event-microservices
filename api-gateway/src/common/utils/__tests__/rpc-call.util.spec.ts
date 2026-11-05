import { HttpException } from '@nestjs/common';

import { failWith, mockClient, replyWith } from '../../../test-utils/mocks';
import { rpcCall, toStringArray } from '../rpc-call.util';

describe('rpcCall', () => {
  it('returns the service reply', async () => {
    const client = mockClient();
    client.send.mockReturnValue(replyWith({ a: 1 }));
    await expect(
      rpcCall(client as never, 'p', { x: 1 }, 'Svc'),
    ).resolves.toEqual({ a: 1 });
    expect(client.send).toHaveBeenCalledWith('p', { x: 1 });
  });

  it('translates failures using the service label', async () => {
    const client = mockClient();
    client.send.mockReturnValue(failWith({ code: 'ECONNREFUSED' }));
    const error = (await rpcCall(
      client as never,
      'p',
      {},
      'Some service',
    ).catch((e: unknown) => e)) as HttpException;
    expect(error.getStatus()).toBe(503);
    expect(error.message).toBe('Some service unavailable');
  });
});

describe('toStringArray', () => {
  it.each([
    [undefined, undefined],
    [null, undefined],
    ['', undefined],
    ['a', ['a']],
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    [
      [1, 2],
      ['1', '2'],
    ],
  ])('%j -> %j', (input, expected) => {
    expect(toStringArray(input)).toEqual(expected);
  });
});
