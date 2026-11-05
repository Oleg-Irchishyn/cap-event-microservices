import { chain, mockModel } from '../../test-utils/mocks';
import { InvestmentsService } from '../investments.service';

describe('InvestmentsService', () => {
  it('lists investments', async () => {
    const model = mockModel();
    const c = chain([{ id: 'INV-001' }]);
    model.find.mockReturnValue(c);
    await expect(
      new InvestmentsService(model as never).list(),
    ).resolves.toEqual([{ id: 'INV-001' }]);
    expect(c.select).toHaveBeenCalledWith('-_id -__v');
  });
});
