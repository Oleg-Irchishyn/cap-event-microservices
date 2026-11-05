import { createHash, randomBytes } from 'node:crypto';

export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/** 256 bits of entropy, URL-safe. Used for authorization codes and refresh tokens. */
export const generateOpaqueToken = (): string =>
  randomBytes(32).toString('base64url');
