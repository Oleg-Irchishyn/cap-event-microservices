export interface Split {
  /** Cent-exact shares; they add up to exactly `round(amount, 2)`. */
  rounded: number[];
  /** Exact proportional shares (6 decimals), before rounding. */
  raw: number[];
}

/**
 * Splits `amount` proportionally to `weights` (largest-remainder method on
 * cents, so the rounded shares always add up). All-zero or invalid weights
 * fall back to an equal split.
 */
export const splitByWeights = (amount: number, weights: number[]): Split => {
  if (weights.length === 0) return { rounded: [], raw: [] };
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const total = safe.reduce((a, b) => a + b, 0);
  const effective = total > 0 ? safe : safe.map(() => 1);
  const effectiveTotal = total > 0 ? total : effective.length;

  const sign = amount < 0 ? -1 : 1;
  const cents = Math.round(Math.abs(amount) * 100);
  const exact = effective.map((w) => (cents * w) / effectiveTotal);
  const floors = exact.map(Math.floor);
  let remainder = cents - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remainder <= 0) break;
    floors[index] += 1;
    remainder -= 1;
  }

  return {
    rounded: floors.map((c) => (sign * c) / 100 || 0),
    raw: effective.map(
      (w) =>
        Math.round(((sign * Math.abs(amount) * w) / effectiveTotal) * 1e6) /
          1e6 || 0,
    ),
  };
};

export const round2 = (n: number): number => Math.round(n * 100) / 100;
