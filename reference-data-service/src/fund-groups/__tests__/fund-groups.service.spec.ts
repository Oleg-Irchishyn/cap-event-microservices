import { chain, mockModel, rpcStatus } from '../../test-utils/mocks';
import { FundGroupsService } from '../fund-groups.service';

describe('FundGroupsService', () => {
  const build = (sponsorExists = true) => {
    const model = mockModel();
    const sponsors = { exists: jest.fn().mockResolvedValue(sponsorExists) };
    return {
      model,
      sponsors,
      service: new FundGroupsService(model as never, sponsors as never),
    };
  };

  it('filters by sponsor', async () => {
    const { model, service } = build();
    model.find.mockReturnValue(chain([{ id: 'FG001', name: 'Global Equity' }]));
    await expect(service.search({ sponsorId: '1' })).resolves.toHaveLength(1);
    expect(model.find).toHaveBeenCalledWith({ sponsorId: '1' });
  });

  it('returns all groups when no sponsor is given', async () => {
    const { model, sponsors, service } = build();
    model.find.mockReturnValue(chain([]));
    await service.search({});
    expect(model.find).toHaveBeenCalledWith({});
    expect(sponsors.exists).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown sponsor', async () => {
    const { service } = build(false);
    expect(await rpcStatus(service.search({ sponsorId: '99' }))).toMatchObject({
      status: 404,
    });
  });

  it('exists()', async () => {
    const { model, service } = build();
    model.exists.mockResolvedValue(null);
    await expect(service.exists('x')).resolves.toBe(false);
  });
});
