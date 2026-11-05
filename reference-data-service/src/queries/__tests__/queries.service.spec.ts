import { chain, mockModel, rpcStatus } from '../../test-utils/mocks';
import { QueriesService } from '../queries.service';

describe('QueriesService', () => {
  it('lists queries without their canned results', async () => {
    const model = mockModel();
    const c = chain([{ id: 'q' }]);
    model.find.mockReturnValue(c);
    await new QueriesService(model as never).list();
    expect(c.select).toHaveBeenCalledWith('-_id -__v -results');
  });

  it('executes: canned results overlaid with the arguments', async () => {
    const model = mockModel();
    model.findOne.mockReturnValue(chain({ results: { A: '1', B: '2' } }));
    const service = new QueriesService(model as never);
    await expect(
      service.execute({ queryId: 'q', arguments: { B: 'x', C: 'y' } }),
    ).resolves.toEqual({
      A: '1',
      B: 'x',
      C: 'y',
    });
    await expect(service.execute({ queryId: 'q' })).resolves.toEqual({
      A: '1',
      B: '2',
    });
  });

  it('404 for an unknown query', async () => {
    const model = mockModel();
    model.findOne.mockReturnValue(chain(null));
    expect(
      await rpcStatus(
        new QueriesService(model as never).execute({ queryId: 'x' }),
      ),
    ).toMatchObject({
      status: 404,
    });
  });
});
