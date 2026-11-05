import { buildSeedData } from '../seed-data';

describe('buildSeedData', () => {
  const data = buildSeedData();

  it('is deterministic', () => {
    expect(buildSeedData()).toEqual(data);
  });

  it('links sponsors -> fund groups -> entities consistently', () => {
    const sponsorIds = new Set(data.sponsors.map((s) => s.id));
    const groupIds = new Set(data.fundGroups.map((g) => g.id));
    expect(data.fundGroups.every((g) => sponsorIds.has(g.sponsorId))).toBe(
      true,
    );
    expect(data.entities.every((e) => groupIds.has(e.fundGroupId))).toBe(true);
    for (const sponsor of data.sponsors) {
      expect(data.fundGroups.some((g) => g.sponsorId === sponsor.id)).toBe(
        true,
      );
    }
  });

  it('has unique natural keys', () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(data.entities.map((e) => e.id))).toBe(true);
    expect(unique(data.accounts.map((a) => a.accountKey))).toBe(true);
    expect(unique(data.journalEntries.map((j) => j.key))).toBe(true);
    expect(unique(data.queries.map((q) => q.id))).toBe(true);
  });

  it('includes the allocation basis ids hard-coded by the UI and an inactive one', () => {
    const ids = data.allocationBases.map((b) => b.allocationId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'DS-CMNT',
        'DS-UNFNDCMNT',
        'DS-CNTRAll',
        'DS-CNTRDeal',
        'DS-NONDMNT',
      ]),
    );
    expect(
      data.allocationBases.some((b) => b.allocationBasisStatus === 'Inactive'),
    ).toBe(true);
  });

  it('seeds entities with filterable statuses and types', () => {
    expect(new Set(data.entities.map((e) => e.type))).toEqual(
      new Set(['FUND', 'ADMIN', 'ELIMINATION']),
    );
    expect(data.entities.some((e) => e.status === 'INACTIVE')).toBe(true);
  });

  it('provides Capital accounts for every sponsor, including the UI categories', () => {
    for (const sponsor of data.sponsors) {
      const capital = data.accounts.filter(
        (a) => a.sponsorId === sponsor.id && a.fsGrouping === 'Capital',
      );
      expect(capital.length).toBeGreaterThan(5);
      expect(capital.map((a) => a.capitalCategory)).toContain(
        'Cont - Investments',
      );
    }
  });

  it('maps accounts onto existing accounts', () => {
    const keys = new Set(data.accounts.map((a) => a.accountKey));
    expect(data.mappedAccounts.length).toBeGreaterThan(0);
    for (const m of data.mappedAccounts) {
      expect(keys.has(m.sourceAccountKey)).toBe(true);
      expect(keys.has(m.mappedAccountKey)).toBe(true);
    }
  });

  it('seeds management fee batches whose lines sum to the header amount', () => {
    const headers = data.journalEntries.filter((j) => j.kind === 'HEADER');
    expect(headers.length).toBeGreaterThan(0);
    expect(new Set(headers.map((h) => h.calledFlag))).toEqual(
      new Set(['Y', 'N']),
    );
    for (const header of headers.slice(0, 20)) {
      const lines = data.journalEntries.filter(
        (j) =>
          j.kind === 'LINE' &&
          j.batchNo === header.batchNo &&
          j.entityId === header.entityId,
      );
      expect(lines.length).toBe(2);
      const sum = lines.reduce((s, l) => s + (l.amount ?? 0), 0);
      expect(Math.round(sum * 100)).toBe(
        Math.round((header.amount ?? 0) * 100),
      );
    }
  });

  it('seeds investor attributes for FUND entities only', () => {
    const fundIds = new Set(
      data.entities.filter((e) => e.type === 'FUND').map((e) => e.id),
    );
    expect(data.investorAttributes.every((a) => fundIds.has(a.entityId))).toBe(
      true,
    );
  });
});
