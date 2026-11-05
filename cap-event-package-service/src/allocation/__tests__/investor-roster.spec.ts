import { DEMO_INVESTOR_IDS } from '@cap-event/contracts';

import {
  BASIS,
  resolveBasisId,
  rosterForEntity,
  weightsFor,
} from '../investor-roster';

describe('rosterForEntity', () => {
  it('is deterministic per entity and differs between entities', () => {
    expect(rosterForEntity('73301-01')).toEqual(rosterForEntity('73301-01'));
    expect(rosterForEntity('73301-01')).not.toEqual(
      rosterForEntity('73302-01'),
    );
  });

  it('has six distinct investors from the shared demo pool', () => {
    const roster = rosterForEntity('73301-01');
    expect(roster).toHaveLength(6);
    expect(new Set(roster.map((i) => i.customerId)).size).toBe(6);
    for (const investor of roster) {
      expect(DEMO_INVESTOR_IDS).toContain(investor.customerId);
    }
  });

  it('keeps commitment = invested + unfunded', () => {
    for (const i of rosterForEntity('X-1')) {
      expect(i.investedCapital + i.unfunded).toBe(i.commitment);
      expect(i.unfunded).toBeGreaterThan(0);
    }
  });
});

describe('resolveBasisId', () => {
  it('accepts known ids, falls back to names, else undefined', () => {
    expect(resolveBasisId('DS-CMNT')).toBe('DS-CMNT');
    expect(resolveBasisId('', 'Unfunded Commitment')).toBe('DS-UNFNDCMNT');
    expect(resolveBasisId('bogus', 'commitment')).toBe('DS-CMNT');
    expect(resolveBasisId('bogus', 'User-Provided')).toBeUndefined();
    expect(resolveBasisId()).toBeUndefined();
  });
});

describe('weightsFor', () => {
  const roster = rosterForEntity('73301-01');

  it('maps each basis onto the matching investor quantity', () => {
    expect(weightsFor(BASIS.COMMITMENT, roster)).toEqual(
      roster.map((i) => i.commitment),
    );
    expect(weightsFor(BASIS.UNFUNDED, roster)).toEqual(
      roster.map((i) => i.unfunded),
    );
    expect(weightsFor(BASIS.CONTRIBUTION_ALL, roster)).toEqual(
      roster.map((i) => i.investedCapital),
    );
    expect(weightsFor(BASIS.CONTRIBUTION_DEAL, roster)).toEqual(
      roster.map((i) => i.investedCapital * i.dealFactor),
    );
  });

  it('non-dominant zeroes only the largest commitment', () => {
    const weights = weightsFor(BASIS.NON_DOMINANT, roster);
    expect(weights.filter((w) => w === 0)).toHaveLength(1);
    expect(
      weights[
        roster.findIndex(
          (i) => i.commitment === Math.max(...roster.map((r) => r.commitment)),
        )
      ],
    ).toBe(0);
  });

  it('unknown basis means equal weights', () => {
    expect(weightsFor(undefined, roster)).toEqual(roster.map(() => 1));
  });
});
