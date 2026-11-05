import { chain, mockModel, rpcStatus } from '../../test-utils/mocks';
import { AccountsService } from '../accounts.service';

describe('AccountsService', () => {
  const build = (sponsorExists = true) => {
    const accounts = mockModel();
    const mapped = mockModel();
    const sponsors = { exists: jest.fn().mockResolvedValue(sponsorExists) };
    return {
      accounts,
      mapped,
      service: new AccountsService(
        accounts as never,
        mapped as never,
        sponsors as never,
      ),
    };
  };

  it('includes fsGroupings and excludes capitalCategories', async () => {
    const { accounts, service } = build();
    accounts.find.mockReturnValue(chain([]));
    await service.list({
      sponsorId: '1',
      fsGroupings: ['Capital'],
      capitalCategories: ['Mgmt Fee'],
    });
    expect(accounts.find).toHaveBeenCalledWith({
      sponsorId: '1',
      fsGrouping: { $in: ['Capital'] },
      capitalCategory: { $nin: ['Mgmt Fee'] },
    });
  });

  it('lists all accounts of a sponsor without filters', async () => {
    const { accounts, service } = build();
    accounts.find.mockReturnValue(chain([]));
    await service.list({ sponsorId: '1' });
    expect(accounts.find).toHaveBeenCalledWith({ sponsorId: '1' });
  });

  it('404 for an unknown sponsor', async () => {
    const { service } = build(false);
    expect(await rpcStatus(service.list({ sponsorId: '9' }))).toMatchObject({
      status: 404,
    });
  });

  it('resolves a mapped account', async () => {
    const { accounts, mapped, service } = build();
    mapped.findOne.mockReturnValue(chain({ mappedAccountKey: '1-1300' }));
    accounts.findOne.mockReturnValue(chain({ accountKey: '1-1300' }));
    await expect(service.mapped({ id: '1-3110' })).resolves.toEqual({
      accountKey: '1-1300',
    });
  });

  it('404 when there is no mapping or the target is missing', async () => {
    const { accounts, mapped, service } = build();
    mapped.findOne.mockReturnValue(chain(null));
    expect(await rpcStatus(service.mapped({ id: 'x' }))).toMatchObject({
      status: 404,
    });
    mapped.findOne.mockReturnValue(chain({ mappedAccountKey: 'gone' }));
    accounts.findOne.mockReturnValue(chain(null));
    expect(await rpcStatus(service.mapped({ id: 'x' }))).toMatchObject({
      status: 404,
    });
  });
});
