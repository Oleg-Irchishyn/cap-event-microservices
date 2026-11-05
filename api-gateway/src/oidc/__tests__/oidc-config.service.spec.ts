import { buildOidcConfig } from '../../test-utils/mocks';

describe('OidcConfigService', () => {
  it('uses the documented defaults', () => {
    const oidc = buildOidcConfig();
    expect(oidc.issuer).toBe('http://localhost:4000/oidc/2');
    expect(oidc.allowedRedirectUris).toEqual([
      'http://localhost:3000/cap-event/auth/callback',
    ]);
    expect(oidc.corsOrigins).toEqual(['http://localhost:3000']);
  });

  it('parses comma separated ALLOWED_REDIRECT_URIS and CLIENT_URL', () => {
    const oidc = buildOidcConfig({
      ALLOWED_REDIRECT_URIS: 'http://a.test/cb, https://b.test/cb',
      CLIENT_URL: 'http://c.test',
      PUBLIC_URL: 'https://gw.test/',
    });
    expect(oidc.allowedRedirectUris).toEqual([
      'http://a.test/cb',
      'https://b.test/cb',
    ]);
    expect([...oidc.allowedOrigins].sort()).toEqual([
      'http://a.test',
      'http://c.test',
      'https://b.test',
    ]);
    expect(oidc.issuer).toBe('https://gw.test/oidc/2');
  });

  it('matches redirect URIs exactly and post-logout URIs by origin', () => {
    const oidc = buildOidcConfig();
    expect(
      oidc.isRedirectUriAllowed(
        'http://localhost:3000/cap-event/auth/callback',
      ),
    ).toBe(true);
    expect(
      oidc.isRedirectUriAllowed(
        'http://localhost:3000/cap-event/auth/callback/',
      ),
    ).toBe(false);
    expect(
      oidc.isPostLogoutRedirectAllowed('http://localhost:3000/anything?x=1'),
    ).toBe(true);
    expect(oidc.isPostLogoutRedirectAllowed('http://localhost:3001/')).toBe(
      false,
    );
    expect(oidc.isPostLogoutRedirectAllowed('javascript:alert(1)')).toBe(false);
    expect(oidc.isPostLogoutRedirectAllowed('not a url')).toBe(false);
  });
});
