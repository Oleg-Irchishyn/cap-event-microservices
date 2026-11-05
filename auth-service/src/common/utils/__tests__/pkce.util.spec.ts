import {
  computeS256Challenge,
  isValidCodeChallenge,
  verifyPkceS256,
} from '../pkce.util';

// RFC 7636 appendix B test vector.
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('pkce.util', () => {
  it('computes the RFC 7636 S256 challenge', () => {
    expect(computeS256Challenge(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
  });

  it('accepts a matching verifier', () => {
    expect(verifyPkceS256(RFC_VERIFIER, RFC_CHALLENGE)).toBe(true);
  });

  it('accepts the 64-char hex verifier produced by cap-event-ui', () => {
    const verifier = 'a1'.repeat(32);
    expect(verifyPkceS256(verifier, computeS256Challenge(verifier))).toBe(true);
  });

  it('rejects a different verifier', () => {
    expect(verifyPkceS256('b'.repeat(43), RFC_CHALLENGE)).toBe(false);
  });

  it('rejects verifiers that are too short or use illegal characters', () => {
    expect(verifyPkceS256('short', computeS256Challenge('short'))).toBe(false);
    const bad = `${'a'.repeat(42)}!`;
    expect(verifyPkceS256(bad, computeS256Challenge(bad))).toBe(false);
  });

  it('validates challenge format', () => {
    expect(isValidCodeChallenge(RFC_CHALLENGE)).toBe(true);
    expect(isValidCodeChallenge('too-short')).toBe(false);
    expect(isValidCodeChallenge(`${RFC_CHALLENGE}=`)).toBe(false);
  });
});
