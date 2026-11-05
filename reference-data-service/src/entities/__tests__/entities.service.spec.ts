import { chain, mockModel, rpcStatus } from '../../test-utils/mocks';
import { EntitiesService } from '../entities.service';

describe('EntitiesService', () => {
  const build = (groupExists = true) => {
    const model = mockModel();
    const groups = { exists: jest.fn().mockResolvedValue(groupExists) };
    return {
      model,
      service: new EntitiesService(model as never, groups as never),
    };
  };

  it('applies status and type filters and hides internal fields', async () => {
    const { model, service } = build();
    const c = chain([{ id: 'E1' }]);
    model.find.mockReturnValue(c);
    await service.byFundGroup({
      fundGroupId: 'FG001',
      statuses: ['ACTIVE'],
      typesToExclude: ['ADMIN', 'ELIMINATION'],
    });
    expect(model.find).toHaveBeenCalledWith({
      fundGroupId: 'FG001',
      status: { $in: ['ACTIVE'] },
      type: { $nin: ['ADMIN', 'ELIMINATION'] },
    });
    expect(c.select).toHaveBeenCalledWith(
      '-_id -__v -fundGroupId -status -type',
    );
  });

  it('does not filter without statuses/types', async () => {
    const { model, service } = build();
    model.find.mockReturnValue(chain([]));
    await service.byFundGroup({ fundGroupId: 'FG001' });
    expect(model.find).toHaveBeenCalledWith({ fundGroupId: 'FG001' });
  });

  it('answers 404 for an unknown fund group', async () => {
    const { service } = build(false);
    expect(
      await rpcStatus(service.byFundGroup({ fundGroupId: 'nope' })),
    ).toMatchObject({
      status: 404,
    });
  });
});
