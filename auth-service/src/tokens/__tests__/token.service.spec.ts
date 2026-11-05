import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';

import { TokenService } from '../token.service';

const KEY = 'unit-test-signing-key-0123456789abcdef';
const user = { id: 'u1', email: 'a@b.co', name: 'Ada' };

describe('TokenService', () => {
  const jwt = new JwtService({ secret: KEY });
  const service = new TokenService(
    jwt,
    new ConfigService({ ACCESS_TOKEN_TTL_SECONDS: '3600' }),
  );
  const ctx = { issuer: 'http://gw/oidc/2', clientId: 'client-1' };

  it('signs an HS256 access token and id token with the expected claims', async () => {
    const out = await service.signTokens(user, { ...ctx, nonce: 'n1' });

    expect(out.token_type).toBe('Bearer');
    expect(out.expires_in).toBe(3600);

    const access = jwt.verify(out.access_token, { algorithms: ['HS256'] });
    expect(access).toMatchObject({
      sub: 'u1',
      email: 'a@b.co',
      name: 'Ada',
      token_use: 'access',
      iss: ctx.issuer,
      aud: 'client-1',
    });
    expect(access.exp - access.iat).toBe(3600);
    expect(access.nonce).toBeUndefined();

    const id = jwt.verify(out.id_token, { algorithms: ['HS256'] });
    expect(id).toMatchObject({ token_use: 'id', aud: 'client-1', nonce: 'n1' });
  });

  it('accepts an expired id token as a logout hint', async () => {
    const expired = jwt.sign(
      { sub: 'u1', token_use: 'id' },
      { expiresIn: -10 },
    );
    await expect(service.verifyIdTokenHint(expired)).resolves.toMatchObject({
      sub: 'u1',
    });
  });

  it('rejects access tokens, forged tokens and garbage as a logout hint', async () => {
    const { access_token } = await service.signTokens(user, ctx);
    const forged = new JwtService({
      secret: 'another-key-another-key-another-key',
    }).sign({
      sub: 'u1',
      token_use: 'id',
    });

    for (const bad of [access_token, forged, 'garbage']) {
      await expect(service.verifyIdTokenHint(bad)).rejects.toBeInstanceOf(
        RpcException,
      );
    }
  });
});
