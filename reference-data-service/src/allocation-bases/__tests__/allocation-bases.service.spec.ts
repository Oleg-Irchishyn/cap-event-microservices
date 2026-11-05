import { chain, mockModel } from '../../test-utils/mocks';
import { AllocationBasesService } from '../allocation-bases.service';

describe('AllocationBasesService', () => {
  it('lists allocation bases', async () => {
    const model = mockModel();
    model.find.mockReturnValue(chain([{ allocationId: 'DS-CMNT' }]));
    await expect(
      new AllocationBasesService(model as never).list(),
    ).resolves.toHaveLength(1);
  });

  it('namesFor() returns the input plus the matching names', async () => {
    const model = mockModel();
    model.find.mockReturnValue(chain([{ allocationName: 'Commitment' }]));
    const names = await new AllocationBasesService(model as never).namesFor(
      'DS-CMNT',
    );
    expect(names).toEqual(['DS-CMNT', 'Commitment']);
  });

  it('namesFor() escapes regex characters of the input', async () => {
    const model = mockModel();
    model.find.mockReturnValue(chain([]));
    await new AllocationBasesService(model as never).namesFor('a.b(c');
    const filter = model.find.mock.calls[0][0];
    expect(filter.$or[1].allocationName.source).toBe('^a\\.b\\(c$');
  });
});
