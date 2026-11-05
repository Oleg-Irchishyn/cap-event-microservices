import { chain, mockModel } from '../../test-utils/mocks';
import { InvestorAttributesService } from '../investor-attributes.service';

describe('InvestorAttributesService', () => {
  it('returns the stored attribute', async () => {
    const model = mockModel();
    model.findOne.mockReturnValue(chain({ secondaryInvestorId: 'SEC-001' }));
    const service = new InvestorAttributesService(model as never);
    await expect(
      service.get({ investorId: 'CUST001', entityId: 'E1' }),
    ).resolves.toEqual({
      secondaryInvestorId: 'SEC-001',
    });
    expect(model.findOne).toHaveBeenCalledWith({
      investorId: 'CUST001',
      entityId: 'E1',
    });
  });

  it('returns an empty object when unknown', async () => {
    const model = mockModel();
    model.findOne.mockReturnValue(chain(null));
    await expect(
      new InvestorAttributesService(model as never).get({
        investorId: 'x',
        entityId: 'y',
      }),
    ).resolves.toEqual({});
  });
});
