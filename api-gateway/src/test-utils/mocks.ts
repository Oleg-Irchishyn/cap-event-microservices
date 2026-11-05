import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';

import { OidcConfigService } from '../oidc/oidc-config.service';

export const TEST_KEY = 'unit-test-signing-key-0123456789abcdef';
export const REDIRECT_URI = 'http://localhost:3000/cap-event/auth/callback';
export const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

export const buildOidcConfig = (
  env: Record<string, string> = {},
): OidcConfigService =>
  new OidcConfigService(
    new ConfigService({
      CLIENT_ID: 'cap-event-ui',
      PORT: '4000',
      ...env,
    }),
  );

/** ClientProxy stand-in: `send` resolves with `value` or rejects with `error`. */
export const mockClient = () => ({ send: jest.fn() });
export const replyWith = (value: unknown) => of(value);
export const failWith = (error: unknown) => throwError(() => error);

export const mockRes = () => {
  const res = {
    status: jest.fn(),
    set: jest.fn(),
    send: jest.fn(),
    json: jest.fn(),
    redirect: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.set.mockReturnValue(res);
  res.send.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

export const validAuthQuery = (overrides: Record<string, unknown> = {}) => ({
  client_id: 'cap-event-ui',
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: 'openid profile email',
  state: 'st-1',
  resource: 'https://api.example.test',
  code_challenge: CHALLENGE,
  code_challenge_method: 'S256',
  ...overrides,
});
