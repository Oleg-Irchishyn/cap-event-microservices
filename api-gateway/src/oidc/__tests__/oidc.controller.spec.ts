import { OAuthException } from '../../exceptions/oauth.exception';
import {
  buildOidcConfig,
  CHALLENGE,
  failWith,
  mockClient,
  mockRes,
  REDIRECT_URI,
  replyWith,
  validAuthQuery,
} from '../../test-utils/mocks';
import { AuthorizeRequestService } from '../authorize-request.service';
import { OidcController } from '../oidc.controller';

const user = { id: 'u1', email: 'demo@example.com', name: 'Demo' };

describe('OidcController', () => {
  const oidc = buildOidcConfig();
  let client: ReturnType<typeof mockClient>;
  let controller: OidcController;

  beforeEach(() => {
    client = mockClient();
    controller = new OidcController(
      client as never,
      oidc,
      new AuthorizeRequestService(oidc),
    );
  });

  describe('discovery', () => {
    it('advertises issuer and endpoints under /oidc/2', () => {
      expect(controller.discovery()).toMatchObject({
        issuer: 'http://localhost:4000/oidc/2',
        authorization_endpoint: 'http://localhost:4000/oidc/2/auth',
        token_endpoint: 'http://localhost:4000/oidc/2/token',
        end_session_endpoint: 'http://localhost:4000/oidc/2/logout',
        code_challenge_methods_supported: ['S256'],
      });
    });
  });

  describe('GET /auth', () => {
    it('renders the sign-in form with hidden request fields', () => {
      const res = mockRes();
      controller.showForm(validAuthQuery(), res as never);

      expect(res.status).toHaveBeenCalledWith(200);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('name="email"');
      expect(html).toContain('name="password"');
      expect(html).toContain(`name="code_challenge" value="${CHALLENGE}"`);
      expect(html).toContain('name="state" value="st-1"');
      expect(html).toContain('mode=register');
    });

    it('renders the registration form for mode=register', () => {
      const res = mockRes();
      controller.showForm(validAuthQuery({ mode: 'register' }), res as never);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('name="name"');
      expect(html).toContain('name="mode" value="register"');
    });

    it('HTML-escapes reflected values (no XSS)', () => {
      const res = mockRes();
      const payload = '"><script>alert(1)</script>';
      controller.showForm(
        validAuthQuery({ state: payload, resource: payload, nonce: payload }),
        res as never,
      );
      const html = res.send.mock.calls[0][0] as string;
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('sets anti-framing and no-store headers', () => {
      const res = mockRes();
      controller.showForm(validAuthQuery(), res as never);
      expect(res.set.mock.calls[0][0]).toMatchObject({
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store',
      });
    });

    it('never redirects for an unknown client_id or unregistered redirect_uri', () => {
      for (const bad of [
        { client_id: 'evil' },
        { redirect_uri: 'http://evil.test/cb' },
        { redirect_uri: `${REDIRECT_URI}/extra` },
        { client_id: ['a', 'b'] },
      ]) {
        const res = mockRes();
        controller.showForm(validAuthQuery(bad), res as never);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.redirect).not.toHaveBeenCalled();
      }
    });

    it('redirects back with an OAuth error for a missing PKCE challenge', () => {
      const res = mockRes();
      controller.showForm(
        validAuthQuery({ code_challenge: undefined }),
        res as never,
      );
      const [status, url] = res.redirect.mock.calls[0] as [number, string];
      expect(status).toBe(302);
      expect(url).toContain(REDIRECT_URI);
      expect(url).toContain('error=invalid_request');
      expect(url).toContain('state=st-1');
    });

    it('redirects back with unsupported_response_type for response_type=token', () => {
      const res = mockRes();
      controller.showForm(
        validAuthQuery({ response_type: 'token' }),
        res as never,
      );
      expect(res.redirect.mock.calls[0][1]).toContain(
        'error=unsupported_response_type',
      );
    });
  });

  describe('POST /auth', () => {
    const form = (overrides: Record<string, unknown> = {}) =>
      validAuthQuery({
        mode: 'login',
        email: 'demo@example.com',
        password: 'password1',
        ...overrides,
      });

    it('verifies credentials, issues a code and redirects with code and state', async () => {
      client.send.mockImplementation((pattern: string) =>
        replyWith(
          pattern === 'auth.validate-credentials'
            ? user
            : { code: 'the-code', expiresIn: 120 },
        ),
      );
      const res = mockRes();

      await controller.submitForm(form(), res as never);

      const [status, url] = res.redirect.mock.calls[0] as [number, string];
      expect(status).toBe(302);
      const target = new URL(url);
      expect(target.origin + target.pathname).toBe(REDIRECT_URI);
      expect(target.searchParams.get('code')).toBe('the-code');
      expect(target.searchParams.get('state')).toBe('st-1');
      expect(client.send).toHaveBeenNthCalledWith(2, 'auth.code.issue', {
        userId: 'u1',
        clientId: 'cap-event-ui',
        redirectUri: REDIRECT_URI,
        codeChallenge: CHALLENGE,
        codeChallengeMethod: 'S256',
        nonce: undefined,
      });
    });

    it('re-renders the form with an error on bad credentials', async () => {
      client.send.mockReturnValue(
        failWith({ status: 401, message: 'Invalid email or password' }),
      );
      const res = mockRes();

      await controller.submitForm(form(), res as never);

      expect(res.redirect).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('Invalid email or password');
      expect(html).toContain('value="demo@example.com"');
      expect(html).not.toContain('password1');
    });

    it('registers first when mode=register', async () => {
      client.send.mockImplementation((pattern: string) =>
        replyWith(
          pattern === 'auth.register' ? user : { code: 'c', expiresIn: 1 },
        ),
      );
      const res = mockRes();

      await controller.submitForm(
        form({ mode: 'register', name: 'Demo' }),
        res as never,
      );

      expect(client.send.mock.calls[0][0]).toBe('auth.register');
      expect(res.redirect).toHaveBeenCalled();
    });

    it('shows a generic message (not the socket error) when auth-service is down', async () => {
      client.send.mockReturnValue(
        failWith(
          Object.assign(new Error('connect ECONNREFUSED'), {
            code: 'ECONNREFUSED',
          }),
        ),
      );
      const res = mockRes();

      await controller.submitForm(form(), res as never);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.send.mock.calls[0][0]).not.toContain('ECONNREFUSED');
    });

    it('rejects malformed input without calling auth-service', async () => {
      const res = mockRes();
      await controller.submitForm(form({ email: { $ne: null } }), res as never);
      await controller.submitForm(form({ password: '' }), res as never);
      expect(client.send).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('re-validates client_id / redirect_uri on POST', async () => {
      const res = mockRes();
      await controller.submitForm(
        form({ redirect_uri: 'http://evil.test/cb' }),
        res as never,
      );
      expect(client.send).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('POST /token', () => {
    const exchange = {
      grant_type: 'authorization_code',
      client_id: 'cap-event-ui',
      code: 'the-code',
      redirect_uri: REDIRECT_URI,
      code_verifier: 'v'.repeat(64),
    };
    const tokens = {
      access_token: 'at',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'rt',
      id_token: 'it',
    };

    it('exchanges a code and returns the token set', async () => {
      client.send.mockReturnValue(replyWith(tokens));

      await expect(controller.token(exchange)).resolves.toEqual(tokens);
      expect(client.send).toHaveBeenCalledWith('auth.token.exchange', {
        clientId: 'cap-event-ui',
        issuer: 'http://localhost:4000/oidc/2',
        code: 'the-code',
        redirectUri: REDIRECT_URI,
        codeVerifier: 'v'.repeat(64),
      });
    });

    it('rotates via the refresh_token grant', async () => {
      client.send.mockReturnValue(replyWith(tokens));

      await controller.token({
        grant_type: 'refresh_token',
        client_id: 'cap-event-ui',
        refresh_token: 'rt-old',
      });
      expect(client.send).toHaveBeenCalledWith('auth.token.refresh', {
        clientId: 'cap-event-ui',
        issuer: 'http://localhost:4000/oidc/2',
        refreshToken: 'rt-old',
      });
    });

    it('maps auth-service invalid_grant to a 400 OAuth error', async () => {
      client.send.mockReturnValue(
        failWith({
          status: 400,
          message: 'PKCE verification failed',
          error: 'invalid_grant',
        }),
      );

      const error = (await controller
        .token(exchange)
        .catch((e: OAuthException) => e)) as OAuthException;
      expect(error).toBeInstanceOf(OAuthException);
      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toEqual({
        error: 'invalid_grant',
        error_description: 'PKCE verification failed',
      });
    });

    it.each([
      [{ ...exchange, client_id: 'evil' }, 'invalid_client', 401],
      [{ ...exchange, grant_type: 'password' }, 'unsupported_grant_type', 400],
      [{ ...exchange, code: undefined }, 'invalid_request', 400],
      [
        { grant_type: 'refresh_token', client_id: 'cap-event-ui' },
        'invalid_request',
        400,
      ],
    ])('rejects %j', async (dto, code, status) => {
      const error = (await controller
        .token(dto as never)
        .catch((e: OAuthException) => e)) as OAuthException;
      expect(error.error).toBe(code);
      expect(error.getStatus()).toBe(status);
      expect(client.send).not.toHaveBeenCalled();
    });
  });

  describe('GET /logout', () => {
    it('revokes via the hint and redirects to an allowed post_logout_redirect_uri', async () => {
      client.send.mockReturnValue(replyWith({ revoked: 1 }));
      const res = mockRes();

      await controller.logout(
        {
          id_token_hint: 'hint',
          post_logout_redirect_uri:
            'http://localhost:3000/cap-event/login?prompt_login=true',
        },
        res as never,
      );

      expect(client.send).toHaveBeenCalledWith('auth.logout', {
        idTokenHint: 'hint',
      });
      expect(res.redirect).toHaveBeenCalledWith(
        302,
        'http://localhost:3000/cap-event/login?prompt_login=true',
      );
    });

    it('refuses to redirect to a foreign origin', async () => {
      client.send.mockReturnValue(replyWith({ revoked: 0 }));
      const res = mockRes();

      await controller.logout(
        {
          id_token_hint: 'hint',
          post_logout_redirect_uri: 'https://evil.test/',
        },
        res as never,
      );

      expect(res.redirect).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('still redirects when the hint is invalid (nothing to revoke)', async () => {
      client.send.mockReturnValue(
        failWith({ status: 400, message: 'id_token_hint is invalid' }),
      );
      const res = mockRes();

      await controller.logout(
        {
          id_token_hint: 'bad',
          post_logout_redirect_uri: 'http://localhost:3000/cap-event/login',
        },
        res as never,
      );
      expect(res.redirect).toHaveBeenCalled();
    });

    it('renders a signed-out page when no redirect is requested', async () => {
      const res = mockRes();
      await controller.logout({}, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(client.send).not.toHaveBeenCalled();
    });
  });
});
