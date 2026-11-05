import { mockModel } from '../../test-utils/mocks';
import { buildSeedData } from '../seed-data';
import { SeedService } from '../seed.service';

describe('SeedService', () => {
  const build = () => {
    const models = Array.from({ length: 10 }, () => mockModel());
    const service = new SeedService(
      ...(models as unknown as ConstructorParameters<typeof SeedService>),
    );
    return { service, models };
  };

  it('upserts every collection by natural key (replaceOne + upsert)', async () => {
    const { service, models } = build();
    await service.seed();
    const data = buildSeedData();
    const total = models.reduce(
      (n, m) => n + (m.bulkWrite.mock.calls[0][0] as unknown[]).length,
      0,
    );
    expect(total).toBe(
      data.sponsors.length +
        data.fundGroups.length +
        data.entities.length +
        data.accounts.length +
        data.mappedAccounts.length +
        data.queries.length +
        data.investments.length +
        data.allocationBases.length +
        data.journalEntries.length +
        data.investorAttributes.length,
    );
    const op = models[0].bulkWrite.mock.calls[0][0][0];
    expect(op.replaceOne.upsert).toBe(true);
    expect(op.replaceOne.filter).toEqual({ id: '1' });
  });

  it('is idempotent: seeding twice issues identical operations', async () => {
    const { service, models } = build();
    await service.seed();
    await service.onApplicationBootstrap();
    for (const model of models) {
      expect(model.bulkWrite).toHaveBeenCalledTimes(2);
      expect(model.bulkWrite.mock.calls[1][0]).toEqual(
        model.bulkWrite.mock.calls[0][0],
      );
    }
  });
});
