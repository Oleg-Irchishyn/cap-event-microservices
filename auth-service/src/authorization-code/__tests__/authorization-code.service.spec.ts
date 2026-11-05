import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';

import { sha256Hex } from '../../common/utils/hash.util';
import { computeS256Challenge } from '../../common/utils/pkce.util';
import { AuthorizationCodeService } from '../authorization-code.service';

const VERIFIER = 'v'.repeat(64);
const CHALLENGE = computeS256Challenge(VERIFIER);

const stored = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user-1',
  clientId: 'client-1',
  redirectUri: 'http://localhost:3000/cb',
  codeChallenge: CHALLENGE,
  nonce: undefined,
  expiresAt: new Date(Date.now() + 60_000),
  ...overrides,
});

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RpcException);
    return (error as RpcException).getError() as {
      status: number;
      message: string;
      error?: string;
    };
  }
  throw new Error('expected rejection');
};

describe('AuthorizationCodeService', () => {
  let model: { create: jest.Mock; findOneAndDelete: jest.Mock };
  let service: AuthorizationCodeService;

  const deleteReturns = (value: unknown) =>
    model.findOneAndDelete.mockReturnValue({
      exec: jest.fn().mockResolvedValue(value),
    });

  beforeEach(() => {
    model = {
      create: jest.fn().mockResolvedValue({}),
      findOneAndDelete: jest.fn(),
    };
    service = new AuthorizationCodeService(
      model as never,
      new ConfigService({ AUTH_CODE_TTL_SECONDS: '120' }),
    );
  });

  describe('issue', () => {
    const payload = {
      userId: 'user-1',
      clientId: 'client-1',
      redirectUri: 'http://localhost:3000/cb',
      codeChallenge: CHALLENGE,
      codeChallengeMethod: 'S256' as const,
    };

    it('stores only the hash of the code with a ~2 minute expiry', async () => {
      const result = await service.issue(payload);

      expect(result.expiresIn).toBe(120);
      const doc = model.create.mock.calls[0][0];
      expect(doc.codeHash).toBe(sha256Hex(result.code));
      expect(JSON.stringify(doc)).not.toContain(result.code);
      expect(doc.expiresAt.getTime()).toBeGreaterThan(Date.now() + 100_000);
      expect(doc.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 120_000);
    });

    it('rejects non-S256 methods and malformed challenges', async () => {
      const plain = await errorOf(
        service.issue({ ...payload, codeChallengeMethod: 'plain' as never }),
      );
      expect(plain.status).toBe(400);
      const bad = await errorOf(
        service.issue({ ...payload, codeChallenge: 'nope' }),
      );
      expect(bad.status).toBe(400);
    });
  });

  describe('consume', () => {
    const request = {
      code: 'the-code',
      clientId: 'client-1',
      redirectUri: 'http://localhost:3000/cb',
      codeVerifier: VERIFIER,
    };

    it('returns the user and deletes the code atomically by hash', async () => {
      deleteReturns(stored({ nonce: 'n-1' }));

      await expect(service.consume(request)).resolves.toEqual({
        userId: 'user-1',
        nonce: 'n-1',
      });
      expect(model.findOneAndDelete).toHaveBeenCalledWith({
        codeHash: sha256Hex('the-code'),
      });
    });

    it('is single use: a second redemption finds nothing', async () => {
      deleteReturns(stored());
      await service.consume(request);

      deleteReturns(null);
      const err = await errorOf(service.consume(request));
      expect(err).toMatchObject({ status: 400, error: 'invalid_grant' });
    });

    it('rejects an expired code even if the TTL monitor has not removed it', async () => {
      deleteReturns(stored({ expiresAt: new Date(Date.now() - 1) }));
      expect(await errorOf(service.consume(request))).toMatchObject({
        error: 'invalid_grant',
      });
    });

    it('rejects wrong client, redirect_uri and PKCE verifier', async () => {
      deleteReturns(stored());
      expect(
        await errorOf(service.consume({ ...request, clientId: 'other' })),
      ).toMatchObject({ error: 'invalid_grant' });

      deleteReturns(stored());
      expect(
        await errorOf(
          service.consume({ ...request, redirectUri: 'http://evil/cb' }),
        ),
      ).toMatchObject({ error: 'invalid_grant' });

      deleteReturns(stored());
      expect(
        await errorOf(
          service.consume({ ...request, codeVerifier: 'x'.repeat(64) }),
        ),
      ).toMatchObject({
        error: 'invalid_grant',
        message: 'PKCE verification failed',
      });
    });

    it('burns the code even when verification fails', async () => {
      deleteReturns(stored());
      await errorOf(
        service.consume({ ...request, codeVerifier: 'x'.repeat(64) }),
      );
      expect(model.findOneAndDelete).toHaveBeenCalledTimes(1);
    });
  });
});
