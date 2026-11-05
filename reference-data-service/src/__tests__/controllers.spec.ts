import { ReferenceDataPattern } from '@cap-event/contracts';

import { AccountsController } from '../accounts/accounts.controller';
import { AllocationBasesController } from '../allocation-bases/allocation-bases.controller';
import { EntitiesController } from '../entities/entities.controller';
import { FundGroupsController } from '../fund-groups/fund-groups.controller';
import { InvestmentsController } from '../investments/investments.controller';
import { InvestorAttributesController } from '../investor-attributes/investor-attributes.controller';
import { JournalEntriesController } from '../journal-entries/journal-entries.controller';
import { QueriesController } from '../queries/queries.controller';
import { SponsorsController } from '../sponsors/sponsors.controller';

const svc = (...methods: string[]) =>
  Object.fromEntries(
    methods.map((m) => [m, jest.fn().mockResolvedValue(`${m}-result`)]),
  );

/** Every controller method must delegate to its service and carry the right @MessagePattern. */
describe('controllers delegate to their services', () => {
  it('sponsors', async () => {
    const s = svc('list');
    await expect(new SponsorsController(s as never).list()).resolves.toBe(
      'list-result',
    );
  });

  it('fund groups (undefined payload becomes {})', async () => {
    const s = svc('search');
    const c = new FundGroupsController(s as never);
    await c.search({ sponsorId: '1' });
    await c.search(undefined as never);
    expect(s.search).toHaveBeenNthCalledWith(1, { sponsorId: '1' });
    expect(s.search).toHaveBeenNthCalledWith(2, {});
  });

  it('entities', async () => {
    const s = svc('byFundGroup');
    await new EntitiesController(s as never).byFundGroup({
      fundGroupId: 'FG1',
    });
    expect(s.byFundGroup).toHaveBeenCalledWith({ fundGroupId: 'FG1' });
  });

  it('accounts', async () => {
    const s = svc('list', 'mapped');
    const c = new AccountsController(s as never);
    await c.list({ sponsorId: '1' });
    await c.mapped({ id: 'a' });
    expect(s.list).toHaveBeenCalledWith({ sponsorId: '1' });
    expect(s.mapped).toHaveBeenCalledWith({ id: 'a' });
  });

  it('queries', async () => {
    const s = svc('list', 'execute');
    const c = new QueriesController(s as never);
    await c.list();
    await c.execute({ queryId: 'q' });
    expect(s.execute).toHaveBeenCalledWith({ queryId: 'q' });
  });

  it('investments, allocation bases, investor attributes', async () => {
    const i = svc('list');
    const a = svc('list');
    const t = svc('get');
    await new InvestmentsController(i as never).list();
    await new AllocationBasesController(a as never).list();
    await new InvestorAttributesController(t as never).get({
      investorId: 'c',
      entityId: 'e',
    });
    expect(i.list).toHaveBeenCalled();
    expect(a.list).toHaveBeenCalled();
    expect(t.get).toHaveBeenCalledWith({ investorId: 'c', entityId: 'e' });
  });

  it('journal entries (undefined mgmt-fee payload becomes {})', async () => {
    const s = svc('mgmtFee', 'mgmtFeeLineItems', 'totalAmount', 'list');
    const c = new JournalEntriesController(s as never);
    await c.mgmtFee(undefined as never);
    await c.mgmtFeeLineItems({ batchNo: 1 } as never);
    await c.totalAmount({ entityIds: [] } as never);
    await c.list({ batchNo: 1 } as never);
    expect(s.mgmtFee).toHaveBeenCalledWith({});
    expect(s.mgmtFeeLineItems).toHaveBeenCalledWith({ batchNo: 1 });
    expect(s.totalAmount).toHaveBeenCalled();
    expect(s.list).toHaveBeenCalled();
  });

  it('registers one handler per pattern', () => {
    const controllers = [
      SponsorsController,
      FundGroupsController,
      EntitiesController,
      AccountsController,
      QueriesController,
      InvestmentsController,
      AllocationBasesController,
      InvestorAttributesController,
      JournalEntriesController,
    ];
    const handled = controllers.flatMap((ctl) =>
      Object.getOwnPropertyNames(ctl.prototype)
        .filter((n) => n !== 'constructor')
        .map(
          (n) =>
            Reflect.getMetadata(
              'microservices:pattern',
              ctl.prototype[n as keyof typeof ctl.prototype],
            ) as string[],
        ),
    );
    expect(handled.flat().sort()).toEqual(
      Object.values(ReferenceDataPattern).sort(),
    );
  });
});
