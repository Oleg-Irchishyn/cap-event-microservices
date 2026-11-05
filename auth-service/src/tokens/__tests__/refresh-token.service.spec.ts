import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';

import { sha256Hex } from '../../common/utils/hash.util';
import { RefreshTokenService } from '../refresh-token.service';

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as RpcException).getError();
  }
  throw new Error('expected rejection');
};

describe('RefreshTokenService', () => {
  let model: {
    create: jest.Mock;
    findOneAndDelete: jest.Mock;
    deleteMany: jest.Mock;
  };
  let service: RefreshTokenService;

  const deleteReturns = (value: unknown) =>
    model.findOneAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue(value),
    });

  beforeEach(() => {
    model = {
      create: jest.fn().mockResolvedValue({}),
      findOneAndDelete: jest.fn(),
      deleteMany: jest.fn(),
    };
    service = new RefreshTokenService(
      model as never,
      new ConfigService({ REFRESH_TOKEN_TTL_SECONDS: '1000' }),
    );
  });

  it('stores a hash with the configured expiry, returns the opaque token', async () => {
    const token = await service.issue('user-1', 'client-1');

    const doc = model.create.mock.calls[0][0];
    expect(doc).toMatchObject({
      tokenHash: sha256Hex(token),
      userId: 'user-1',
      clientId: 'client-1',
    });
    expect(Object.values(doc)).not.toContain(token);
    expect(doc.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000_000);
  });

  it('issues a different token every time', async () => {
    const a = await service.issue('u', 'c');
    const b = await service.issue('u', 'c');
    expect(a).not.toBe(b);
  });

  describe('consume (rotation)', () => {
    it('deletes the presented token and returns its owner', async () => {
      deleteReturns({
        userId: 'user-1',
        clientId: 'client-1',
        expiresAt: new Date(Date.now() + 5000),
      });

      await expect(service.consume('tok', 'client-1')).resolves.toEqual({
        userId: 'user-1',
      });
      expect(model.findOneAndDelete).toHaveBeenCalledWith({
        tokenHash: sha256Hex('tok'),
      });
    });

    it('rejects a reused (already rotated) token', async () => {
      deleteReturns(null);
      expect(await errorOf(service.consume('old', 'client-1'))).toMatchObject({
        status: 400,
        error: 'invalid_grant',
      });
    });

    it('rejects an expired token', async () => {
      deleteReturns({
        userId: 'u',
        clientId: 'client-1',
        expiresAt: new Date(Date.now() - 1),
      });
      expect(await errorOf(service.consume('t', 'client-1'))).toMatchObject({
        error: 'invalid_grant',
      });
    });

    it('rejects a token issued to another client', async () => {
      deleteReturns({
        userId: 'u',
        clientId: 'client-1',
        expiresAt: new Date(Date.now() + 5000),
      });
      expect(await errorOf(service.consume('t', 'other'))).toMatchObject({
        error: 'invalid_grant',
      });
    });
  });

  it('revokes every refresh token of a user', async () => {
    model.deleteMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 3 }),
    });
    await expect(service.revokeAllForUser('user-1')).resolves.toBe(3);
    expect(model.deleteMany).toHaveBeenCalledWith({ userId: 'user-1' });
  });
});
