import { createHash, timingSafeEqual } from 'node:crypto';

// RFC 7636 section 4.1: 43..128 chars from the unreserved set.
const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;
// base64url(sha256(...)) is always exactly 43 chars.
const CHALLENGE_PATTERN = /^[A-Za-z0-9\-_]{43}$/;

export const isValidCodeChallenge = (challenge: string): boolean =>
  CHALLENGE_PATTERN.test(challenge);

export const computeS256Challenge = (verifier: string): string =>
  createHash('sha256').update(verifier).digest('base64url');

/** Verifies a PKCE S256 code_verifier against the stored code_challenge. */
export const verifyPkceS256 = (
  verifier: string,
  challenge: string,
): boolean => {
  if (!VERIFIER_PATTERN.test(verifier)) {
    return false;
  }
  const expected = Buffer.from(computeS256Challenge(verifier));
  const actual = Buffer.from(challenge);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
