/**
 * Contracts shared by api-gateway and auth-service.
 *
 * This is the single source of truth for everything that crosses the TCP
 * boundary: message patterns, request/response payloads, token claims and the
 * RPC error shape. It deliberately has no runtime dependencies so both Nest
 * projects can import it without version coupling.
 */

/** `@MessagePattern` names handled by auth-service. Convention: `<domain>.<action>`. */
export const AuthPattern = {
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',
  VALIDATE_CREDENTIALS: 'auth.validate-credentials',
  CODE_ISSUE: 'auth.code.issue',
  TOKEN_EXCHANGE: 'auth.token.exchange',
  TOKEN_REFRESH: 'auth.token.refresh',
  ME: 'auth.me',
  LOGOUT: 'auth.logout',
} as const;

export type AuthPatternName = (typeof AuthPattern)[keyof typeof AuthPattern];

/** Distinguishes access tokens from id tokens signed with the same key. */
export const TokenUse = {
  ACCESS: 'access',
  ID: 'id',
} as const;

export type TokenUseName = (typeof TokenUse)[keyof typeof TokenUse];

export const BEARER_TOKEN_TYPE = 'Bearer' as const;
export const PKCE_METHOD_S256 = 'S256' as const;

/** OAuth2 / OIDC error codes used in `{ error, error_description }` bodies. */
export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'access_denied'
  | 'server_error';

/** What auth-service throws as `new RpcException(<RpcErrorPayload>)`. */
export interface RpcErrorPayload {
  status: number;
  message: string;
  /** Present when the failure should be reported with an OAuth2 error code. */
  error?: OAuthErrorCode;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface ValidateCredentialsPayload {
  email: string;
  password: string;
}

/** Direct (non-OIDC) login: credentials in, token set out. */
export interface LoginPayload extends ValidateCredentialsPayload {
  clientId: string;
  issuer: string;
}

export interface IssueCodePayload {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: typeof PKCE_METHOD_S256;
  nonce?: string;
}

export interface IssueCodeResult {
  code: string;
  expiresIn: number;
}

export interface TokenExchangePayload {
  clientId: string;
  issuer: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface TokenRefreshPayload {
  clientId: string;
  issuer: string;
  refreshToken: string;
}

export interface TokenSet {
  access_token: string;
  token_type: typeof BEARER_TOKEN_TYPE;
  expires_in: number;
  refresh_token: string;
  id_token: string;
}

export interface AuthSession extends TokenSet {
  user: PublicUser;
}

export interface MePayload {
  userId: string;
}

export interface LogoutPayload {
  idTokenHint: string;
}

export interface LogoutResult {
  revoked: number;
}

interface BaseClaims {
  sub: string;
  email: string;
  name: string;
  iss: string;
  aud: string;
  iat?: number;
  exp?: number;
}

export interface AccessTokenClaims extends BaseClaims {
  token_use: typeof TokenUse.ACCESS;
}

export interface IdTokenClaims extends BaseClaims {
  token_use: typeof TokenUse.ID;
  nonce?: string;
}

// --- OpenAPI-derived contracts (see openapi/README.md)
export * from './reference-data';
export * from './cap-event-package';
