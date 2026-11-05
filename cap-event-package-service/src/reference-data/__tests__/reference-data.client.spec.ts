import { ReferenceDataPattern } from '@cap-event/contracts';
import { of, throwError } from 'rxjs';

import { rpcStatus } from '../../test-utils/fake-model';
import { ReferenceDataClient } from '../reference-data.client';

describe('ReferenceDataClient', () => {
  const build = () => {
    const proxy = { send: jest.fn() };
    return { proxy, client: new ReferenceDataClient(proxy as never) };
  };

  it('sends the right pattern and payload for each call', async () => {
    const { proxy, client } = build();
    proxy.send.mockReturnValue(of([]));
    await client.mgmtFeeJournalEntries({ entityIds: ['E'] });
    await client.mgmtFeeLineItems({
      batchNo: 1,
      entityId: 'E',
      state: 'POSTED',
      calledFlag: 'N',
    });
    await client.journalEntries({
      batchNo: 1,
      accountKey: 'a',
      allocationBasis: 'b',
      entityId: 'E',
    });
    await client.allocationBases();
    expect(proxy.send.mock.calls.map((c) => c[0])).toEqual([
      ReferenceDataPattern.JOURNAL_ENTRIES_MGMT_FEE,
      ReferenceDataPattern.JOURNAL_ENTRIES_MGMT_FEE_LINE_ITEMS,
      ReferenceDataPattern.JOURNAL_ENTRIES_LIST,
      ReferenceDataPattern.ALLOCATION_BASES_LIST,
    ]);
  });

  it('passes RPC errors of the remote service through', async () => {
    const { proxy, client } = build();
    proxy.send.mockReturnValue(
      throwError(() => ({ status: 404, message: 'nope' })),
    );
    expect(await rpcStatus(client.allocationBases())).toEqual({
      status: 404,
      message: 'nope',
    });
  });

  it('turns connection failures into a 503 without leaking details', async () => {
    const { proxy, client } = build();
    proxy.send.mockReturnValue(
      throwError(() => ({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 10.0.0.1',
      })),
    );
    expect(await rpcStatus(client.allocationBases())).toEqual({
      status: 503,
      message: 'reference-data-service unavailable',
    });
  });
});
