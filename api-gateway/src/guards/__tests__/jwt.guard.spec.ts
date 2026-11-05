import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { buildOidcConfig, TEST_KEY } from '../../test-utils/mocks';
import { JwtGuard } from '../jwt.guard';

describe('JwtGuard', () => {
  const oidc = buildOidcConfig();
  const jwt = new JwtService({ secret: TEST_KEY });
  const guard = new JwtGuard(jwt, oidc);

  const claims = {
    sub: 'u1',
    email: 'a@b.co',
    name: 'Ada',
    token_use: 'access',
    iss: oidc.issuer,
    aud: oidc.clientId,
  };

  const contextFor = (authorization?: string) => {
    const req: Record<string, unknown> = { headers: { authorization } };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { req, context };
  };

  it('accepts a valid Bearer access token and sets req.user', async () => {
    const token = jwt.sign(claims, { expiresIn: 60 });
    const { req, context } = contextFor(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.user).toMatchObject({ sub: 'u1', email: 'a@b.co' });
  });

  it.each([
    ['no header', undefined],
    ['wrong scheme', 'Basic abc'],
    ['garbage token', 'Bearer not-a-jwt'],
  ])('rejects %s', async (_label, header) => {
    const { context } = contextFor(header);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects expired tokens', async () => {
    const token = jwt.sign(claims, { expiresIn: -5 });
    await expect(
      guard.canActivate(contextFor(`Bearer ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens signed with another key', async () => {
    const token = new JwtService({
      secret: 'a-different-key-a-different-key-1234',
    }).sign(claims);
    await expect(
      guard.canActivate(contextFor(`Bearer ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects id tokens used as access tokens', async () => {
    const token = jwt.sign({ ...claims, token_use: 'id' });
    await expect(
      guard.canActivate(contextFor(`Bearer ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens for another audience or issuer', async () => {
    for (const bad of [
      { aud: 'other-client' },
      { iss: 'http://evil/oidc/2' },
    ]) {
      const token = jwt.sign({ ...claims, ...bad });
      await expect(
        guard.canActivate(contextFor(`Bearer ${token}`).context),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });
});
