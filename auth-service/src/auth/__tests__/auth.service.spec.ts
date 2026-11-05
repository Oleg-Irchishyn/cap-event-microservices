import { RpcException } from '@nestjs/microservices';

import { AuthService } from '../auth.service';

const user = { id: 'u1', email: 'a@b.co', name: 'Ada' };

describe('AuthService', () => {
  let users: { findById: jest.Mock; validateCredentials: jest.Mock };
  let codes: { consume: jest.Mock };
  let refreshTokens: {
    issue: jest.Mock;
    consume: jest.Mock;
    revokeAllForUser: jest.Mock;
  };
  let tokens: { signTokens: jest.Mock; verifyIdTokenHint: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    users = {
      findById: jest.fn().mockResolvedValue(user),
      validateCredentials: jest.fn().mockResolvedValue(user),
    };
    codes = { consume: jest.fn() };
    refreshTokens = {
      issue: jest.fn().mockResolvedValue('refresh-1'),
      consume: jest.fn(),
      revokeAllForUser: jest.fn().mockResolvedValue(2),
    };
    tokens = {
      signTokens: jest.fn().mockResolvedValue({
        access_token: 'at',
        id_token: 'it',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
      verifyIdTokenHint: jest.fn().mockResolvedValue({ sub: 'u1' }),
    };
    service = new AuthService(
      users as never,
      codes as never,
      refreshTokens as never,
      tokens as never,
    );
  });

  it('exchanges a code for the full token set, echoing the nonce', async () => {
    codes.consume.mockResolvedValue({ userId: 'u1', nonce: 'n1' });

    const result = await service.exchangeCode({
      clientId: 'c1',
      issuer: 'iss',
      code: 'code',
      redirectUri: 'http://x/cb',
      codeVerifier: 'v',
    });

    expect(result).toEqual({
      access_token: 'at',
      id_token: 'it',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'refresh-1',
    });
    expect(tokens.signTokens).toHaveBeenCalledWith(user, {
      issuer: 'iss',
      clientId: 'c1',
      nonce: 'n1',
    });
    expect(refreshTokens.issue).toHaveBeenCalledWith('u1', 'c1');
  });

  it('rotates the refresh token: consumes the old one and issues a new one', async () => {
    refreshTokens.consume.mockResolvedValue({ userId: 'u1' });
    refreshTokens.issue.mockResolvedValue('refresh-2');

    const result = await service.refresh({
      clientId: 'c1',
      issuer: 'iss',
      refreshToken: 'refresh-1',
    });

    expect(refreshTokens.consume).toHaveBeenCalledWith('refresh-1', 'c1');
    expect(result.refresh_token).toBe('refresh-2');
  });

  it('turns a vanished user into invalid_grant on refresh', async () => {
    refreshTokens.consume.mockResolvedValue({ userId: 'gone' });
    users.findById.mockRejectedValue(
      new RpcException({ status: 404, message: 'x' }),
    );

    await expect(
      service.refresh({ clientId: 'c1', issuer: 'iss', refreshToken: 'r' }),
    ).rejects.toMatchObject({
      error: { status: 400, error: 'invalid_grant' },
    });
  });

  it('login validates credentials then issues tokens plus the user', async () => {
    const session = await service.login({
      email: 'a@b.co',
      password: 'password1',
      clientId: 'c1',
      issuer: 'iss',
    });
    expect(session.user).toEqual(user);
    expect(session.refresh_token).toBe('refresh-1');
  });

  it('logout revokes all refresh tokens of the id_token_hint subject', async () => {
    await expect(service.logout({ idTokenHint: 'hint' })).resolves.toEqual({
      revoked: 2,
    });
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
  });
});
