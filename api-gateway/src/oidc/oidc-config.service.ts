import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const OIDC_BASE_PATH = '/oidc/2';
const DEFAULT_REDIRECT_URI = 'http://localhost:3000/cap-event/auth/callback';
const DEFAULT_CLIENT_URL = 'http://localhost:3000';

const splitList = (raw: string | undefined, fallback: string): string[] =>
  (raw && raw.trim().length > 0 ? raw : fallback)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const originOf = (value: string): string | undefined => {
  try {
    const url = new URL(value);
    return url.origin === 'null' ? undefined : url.origin;
  } catch {
    return undefined;
  }
};

/** Everything the fake provider needs to know about the one registered client. */
@Injectable()
export class OidcConfigService {
  readonly clientId: string;
  readonly publicUrl: string;
  readonly issuer: string;
  readonly allowedRedirectUris: readonly string[];
  readonly allowedOrigins: ReadonlySet<string>;

  constructor(config: ConfigService) {
    this.clientId = config.getOrThrow<string>('CLIENT_ID');
    const port = config.get<string>('PORT') ?? '4000';
    this.publicUrl = (
      config.get<string>('PUBLIC_URL') ?? `http://localhost:${port}`
    ).replace(/\/+$/, '');
    this.issuer = `${this.publicUrl}${OIDC_BASE_PATH}`;

    this.allowedRedirectUris = splitList(
      config.get<string>('ALLOWED_REDIRECT_URIS'),
      DEFAULT_REDIRECT_URI,
    );
    this.allowedOrigins = new Set(
      [
        ...this.allowedRedirectUris,
        ...splitList(config.get<string>('CLIENT_URL'), DEFAULT_CLIENT_URL),
      ]
        .map(originOf)
        .filter((origin): origin is string => origin !== undefined),
    );
  }

  isClientValid(clientId: string): boolean {
    return clientId === this.clientId;
  }

  /** Exact string match, as required for authorization redirect URIs. */
  isRedirectUriAllowed(uri: string): boolean {
    return this.allowedRedirectUris.includes(uri);
  }

  /** Post-logout redirects only need to live on an allowed origin. */
  isPostLogoutRedirectAllowed(uri: string): boolean {
    const origin = originOf(uri);
    return origin !== undefined && this.allowedOrigins.has(origin);
  }

  get corsOrigins(): string[] {
    return [...this.allowedOrigins];
  }
}
