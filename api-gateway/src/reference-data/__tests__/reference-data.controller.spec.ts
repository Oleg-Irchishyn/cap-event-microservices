import { ReferenceDataPattern } from '@cap-event/contracts';
import { HttpException } from '@nestjs/common';

import { failWith, mockClient, replyWith } from '../../test-utils/mocks';
import { ReferenceDataController } from '../reference-data.controller';

describe('ReferenceDataController', () => {
  let client: ReturnType<typeof mockClient>;
  let controller: ReferenceDataController;

  beforeEach(() => {
    client = mockClient();
    client.send.mockReturnValue(replyWith(['result']));
    controller = new ReferenceDataController(client as never);
  });

  it('searchFundGroups sends the sponsor id (empty -> undefined)', async () => {
    await expect(
      controller.searchFundGroups({ sponsorId: '1' }),
    ).resolves.toEqual(['result']);
    expect(client.send).toHaveBeenCalledWith(
      ReferenceDataPattern.FUND_GROUPS_SEARCH,
      { sponsorId: '1' },
    );
    await controller.searchFundGroups({ sponsorId: '' });
    expect(client.send).toHaveBeenLastCalledWith(
      ReferenceDataPattern.FUND_GROUPS_SEARCH,
      {
        sponsorId: undefined,
      },
    );
  });

  it('entitiesByFundGroup normalises single and repeated query values', async () => {
    await controller.entitiesByFundGroup('FG001', {
      statuses: 'ACTIVE' as never,
      typesToExclude: ['ADMIN', 'ELIMINATION'],
    });
    expect(client.send).toHaveBeenCalledWith(
      ReferenceDataPattern.ENTITIES_BY_FUND_GROUP,
      {
        fundGroupId: 'FG001',
        statuses: ['ACTIVE'],
        typesToExclude: ['ADMIN', 'ELIMINATION'],
      },
    );
  });

  it('accounts', async () => {
    await controller.accounts({ sponsorId: '1', fsGroupings: ['Capital'] });
    expect(client.send).toHaveBeenCalledWith(
      ReferenceDataPattern.ACCOUNTS_LIST,
      {
        sponsorId: '1',
        fsGroupings: ['Capital'],
        capitalCategories: undefined,
      },
    );
  });

  it('mappedAccount', async () => {
    await controller.mappedAccount('1-3110');
    expect(client.send).toHaveBeenCalledWith(
      ReferenceDataPattern.ACCOUNTS_MAPPED,
      { id: '1-3110' },
    );
  });

  it('executeQuery turns every query-string key into a string argument', async () => {
    await controller.executeQuery('q-id', { a: '1', b: ['x', 'y'], c: 3 });
    expect(client.send).toHaveBeenCalledWith(
      ReferenceDataPattern.QUERIES_EXECUTE,
      {
        queryId: 'q-id',
        arguments: { a: '1', b: 'y', c: '3' },
      },
    );
  });

  it.each([
    ['queries', ReferenceDataPattern.QUERIES_LIST],
    ['investments', ReferenceDataPattern.INVESTMENTS_LIST],
    ['sponsors', ReferenceDataPattern.SPONSORS_LIST],
    ['allocationBases', ReferenceDataPattern.ALLOCATION_BASES_LIST],
  ] as const)('%s sends %s', async (method, pattern) => {
    await controller[method]();
    expect(client.send).toHaveBeenCalledWith(pattern, {});
  });

  it('journal entry routes convert numbers and arrays', async () => {
    await controller.mgmtFeeJournalEntries({
      entityIds: 'E1' as never,
      calledFlag: 'N',
    });
    expect(client.send).toHaveBeenLastCalledWith(
      ReferenceDataPattern.JOURNAL_ENTRIES_MGMT_FEE,
      {
        entityIds: ['E1'],
        fsLineItems: undefined,
        calledFlag: 'N',
      },
    );

    await controller.mgmtFeeLineItems({
      batchNo: '6001' as never,
      entityId: 'E1',
      state: 'POSTED',
      calledFlag: 'N',
    });
    expect(client.send).toHaveBeenLastCalledWith(
      ReferenceDataPattern.JOURNAL_ENTRIES_MGMT_FEE_LINE_ITEMS,
      {
        batchNo: 6001,
        entityId: 'E1',
        state: 'POSTED',
        calledFlag: 'N',
        fsLineItems: undefined,
      },
    );

    await controller.totalAmount({
      entityIds: ['E1', 'E2'],
      allocationBasis: 'Commitment',
      toDate: '2026-06-30',
    });
    expect(client.send).toHaveBeenLastCalledWith(
      ReferenceDataPattern.JOURNAL_ENTRIES_TOTAL_AMOUNT,
      {
        entityIds: ['E1', 'E2'],
        allocationBasis: 'Commitment',
        toDate: '2026-06-30',
      },
    );

    await controller.journalEntries({
      batchNo: '7' as never,
      accountKey: 'a',
      allocationBasis: 'Commitment',
      entityId: 'E1',
    });
    expect(client.send).toHaveBeenLastCalledWith(
      ReferenceDataPattern.JOURNAL_ENTRIES_LIST,
      {
        batchNo: 7,
        accountKey: 'a',
        allocationBasis: 'Commitment',
        entityId: 'E1',
      },
    );
  });

  it('investorAttributes', async () => {
    await controller.investorAttributes({
      investorId: 'CUST001',
      entityId: 'E1',
    });
    expect(client.send).toHaveBeenCalledWith(
      ReferenceDataPattern.INVESTOR_ATTRIBUTES_GET,
      {
        investorId: 'CUST001',
        entityId: 'E1',
      },
    );
  });

  it('translates service errors to their HTTP status', async () => {
    client.send.mockReturnValue(
      failWith({ status: 404, message: 'Sponsor 9 not found' }),
    );
    const error = await controller
      .sponsors()
      .catch((e: unknown) => e as HttpException);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(404);
  });

  it('answers 503 naming the service when it is down', async () => {
    client.send.mockReturnValue(
      failWith({ code: 'ECONNREFUSED', message: 'secret host' }),
    );
    const error = (await controller
      .sponsors()
      .catch((e: unknown) => e)) as HttpException;
    expect(error.getStatus()).toBe(503);
    expect(error.message).toBe('Reference data service unavailable');
  });
});
