import { HttpException } from '@nestjs/common';

import {
  buildOidcConfig,
  failWith,
  mockClient,
  replyWith,
} from '../../test-utils/mocks';
import { AuthController } from '../auth.controller';

const user = { id: 'u1', email: 'demo@example.com', name: 'Demo' };
const session = {
  access_token: 'at',
  id_token: 'it',
  refresh_token: 'rt',
  token_type: 'Bearer',
  expires_in: 3600,
  user,
};

describe('AuthController', () => {
  const oidc = buildOidcConfig();
  let client: ReturnType<typeof mockClient>;
  let controller: AuthController;

  beforeEach(() => {
    client = mockClient();
    controller = new AuthController(client as never, oidc);
  });

  describe('login', () => {
    it('forwards credentials with the client id and issuer and returns the session', async () => {
      client.send.mockReturnValue(replyWith(session));

      await expect(
        controller.login({ email: 'demo@example.com', password: 'password1' }),
      ).resolves.toEqual(session);
      expect(client.send).toHaveBeenCalledWith('auth.login', {
        email: 'demo@example.com',
        password: 'password1',
        clientId: 'cap-event-ui',
        issuer: 'http://localhost:4000/oidc/2',
      });
    });

    it('translates an RPC 401 into an HttpException(401)', async () => {
      client.send.mockReturnValue(
        failWith({ status: 401, message: 'Invalid email or password' }),
      );

      const error = await controller
        .login({ email: 'a@b.co', password: 'x' })
        .catch((e: HttpException) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(401);
    });
  });

  describe('registration', () => {
    it('registers, then logs in with the same credentials', async () => {
      client.send.mockImplementation((pattern: string) =>
        replyWith(pattern === 'auth.register' ? user : session),
      );

      const result = await controller.registration({
        email: 'demo@example.com',
        password: 'password1',
        name: 'Demo',
      });

      expect(result).toEqual(session);
      expect(client.send.mock.calls.map((c) => c[0])).toEqual([
        'auth.register',
        'auth.login',
      ]);
    });

    it('surfaces 409 for an existing email and does not attempt login', async () => {
      client.send.mockReturnValue(failWith({ status: 409, message: 'exists' }));

      const error = await controller
        .registration({ email: 'a@b.co', password: 'password1', name: 'A' })
        .catch((e: HttpException) => e);
      expect((error as HttpException).getStatus()).toBe(409);
      expect(client.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('me', () => {
    it('asks auth-service for the user named in the token subject', async () => {
      client.send.mockReturnValue(replyWith(user));

      await expect(
        controller.me({ user: { sub: 'u1' } } as never),
      ).resolves.toEqual(user);
      expect(client.send).toHaveBeenCalledWith('auth.me', { userId: 'u1' });
    });

    it('returns 503 when auth-service is down, without leaking the socket error', async () => {
      client.send.mockReturnValue(
        failWith(
          Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:4001'), {
            code: 'ECONNREFUSED',
          }),
        ),
      );

      const error = (await controller
        .me({ user: { sub: 'u1' } } as never)
        .catch((e: HttpException) => e)) as HttpException;
      expect(error.getStatus()).toBe(503);
      expect(error.message).not.toContain('127.0.0.1');
    });
  });
});
