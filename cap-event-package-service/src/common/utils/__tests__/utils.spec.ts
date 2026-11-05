import { deterministicUuid, fnv1a, UUID_REGEX } from '../hash.util';
import { badRequest, notFound, rpcError } from '../rpc-error.util';
import { round2, splitByWeights } from '../split.util';

describe('splitByWeights', () => {
  const sum = (values: number[]) =>
    Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;

  it('splits proportionally and adds up to the cent', () => {
    const { rounded } = splitByWeights(1000, [1, 1, 1]);
    expect(sum(rounded)).toBe(1000);
    expect(rounded.sort()).toEqual([333.33, 333.33, 333.34]);
  });

  it('respects the weights', () => {
    const { rounded, raw } = splitByWeights(100, [3, 1]);
    expect(rounded).toEqual([75, 25]);
    expect(raw).toEqual([75, 25]);
  });

  it('gives zero-weight entries nothing', () => {
    expect(splitByWeights(90, [0, 1, 2]).rounded).toEqual([0, 30, 60]);
  });

  it('falls back to an equal split for all-zero / invalid weights', () => {
    expect(splitByWeights(10, [0, 0]).rounded).toEqual([5, 5]);
    expect(splitByWeights(10, [NaN, -1]).rounded).toEqual([5, 5]);
  });

  it('handles negative amounts and empty input', () => {
    expect(sum(splitByWeights(-10, [1, 1, 1]).rounded)).toBe(-10);
    expect(splitByWeights(10, [])).toEqual({ rounded: [], raw: [] });
  });

  it('keeps totals exact for awkward numbers', () => {
    const weights = [7, 13, 29, 31, 3];
    expect(sum(splitByWeights(123456.79, weights).rounded)).toBe(123456.79);
  });

  it('round2 rounds to cents', () => {
    expect(round2(1.005 + 1.1)).toBe(2.11);
  });
});

describe('hash util', () => {
  it('fnv1a is stable and spreads values', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
  });

  it('deterministicUuid is a stable, valid UUID', () => {
    const a = deterministicUuid('seed');
    expect(a).toBe(deterministicUuid('seed'));
    expect(a).not.toBe(deterministicUuid('other'));
    expect(UUID_REGEX.test(a)).toBe(true);
  });
});

describe('rpc error helpers', () => {
  it('build RpcException payloads', () => {
    expect(rpcError(503, 'x').getError()).toEqual({
      status: 503,
      message: 'x',
    });
    expect(badRequest('b').getError()).toEqual({ status: 400, message: 'b' });
    expect(notFound('n').getError()).toEqual({ status: 404, message: 'n' });
  });
});
