import { chain, mockModel, rpcStatus } from '../../test-utils/mocks';
import {
  JournalEntriesService,
  normalizeCalledFlag,
} from '../journal-entries.service';

describe('normalizeCalledFlag', () => {
  it.each([
    ['Y', 'Y'],
    ['yes', 'Y'],
    ['TRUE', 'Y'],
    ['n', 'N'],
    ['No', 'N'],
    ['false', 'N'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeCalledFlag(raw)).toBe(expected);
  });

  it('rejects anything else with 400', () => {
    expect(() => normalizeCalledFlag('maybe')).toThrow();
  });
});

describe('JournalEntriesService', () => {
  const build = () => {
    const model = mockModel();
    const bases = {
      namesFor: jest.fn().mockResolvedValue(['DS-CMNT', 'Commitment']),
    };
    return {
      model,
      bases,
      service: new JournalEntriesService(model as never, bases as never),
    };
  };

  it('mgmtFee: header entries filtered by entities and called flag', async () => {
    const { model, service } = build();
    model.find.mockReturnValue(chain([]));
    await service.mgmtFee({ entityIds: ['E1'], calledFlag: 'N' });
    expect(model.find).toHaveBeenCalledWith({
      kind: 'HEADER',
      entityId: { $in: ['E1'] },
      calledFlag: 'N',
    });
  });

  it('mgmtFee: fsLineItems narrows to batches with matching GL lines', async () => {
    const { model, service } = build();
    model.distinct.mockResolvedValue([6001]);
    model.find.mockReturnValue(chain([]));
    await service.mgmtFee({ fsLineItems: ["Partners' Capital"] });
    expect(model.find.mock.calls[0][0].batchNo).toEqual({ $in: [6001] });
  });

  it('mgmtFee: no filters', async () => {
    const { model, service } = build();
    model.find.mockReturnValue(chain([]));
    await service.mgmtFee({});
    expect(model.find).toHaveBeenCalledWith({ kind: 'HEADER' });
  });

  it('mgmtFeeLineItems: filters one batch and applies fsLineItems', async () => {
    const { model, service } = build();
    model.find.mockReturnValue(chain([]));
    await service.mgmtFeeLineItems({
      batchNo: 6001,
      entityId: 'E1',
      state: 'POSTED',
      calledFlag: 'n',
      fsLineItems: ['Management Fees'],
    });
    const filter = model.find.mock.calls[0][0];
    expect(filter).toMatchObject({
      kind: 'LINE',
      batchNo: 6001,
      entityId: 'E1',
      calledFlag: 'N',
      'account.fsLineItem': { $in: ['Management Fees'] },
    });
    expect(filter.state.test('posted')).toBe(true);
  });

  it('mgmtFeeLineItems: an invalid called flag is a 400', async () => {
    const { service } = build();
    expect(
      await rpcStatus(
        service.mgmtFeeLineItems({
          batchNo: 1,
          entityId: 'E',
          state: 'POSTED',
          calledFlag: '??',
        }),
      ),
    ).toMatchObject({ status: 400 });
  });

  it('list: matches the allocation basis by id or name', async () => {
    const { model, service } = build();
    model.find.mockReturnValue(chain([]));
    await service.list({
      batchNo: 1,
      accountKey: '1-3130',
      allocationBasis: 'DS-CMNT',
      entityId: 'E1',
    });
    expect(model.find).toHaveBeenCalledWith({
      kind: 'LINE',
      batchNo: 1,
      entityId: 'E1',
      'account.accountKey': '1-3130',
      allocationBasis: { $in: ['DS-CMNT', 'Commitment'] },
    });
  });

  it('totalAmount: one aggregated entry per entity, up to toDate', async () => {
    const { model, service } = build();
    model.find.mockReturnValue(
      chain([
        {
          entityId: 'E1',
          entity: { id: 'E1' },
          allocationBasis: 'Commitment',
          amount: 100.1,
          trType: 1,
        },
        {
          entityId: 'E1',
          entity: { id: 'E1' },
          allocationBasis: 'Commitment',
          amount: 200.2,
          trType: 1,
        },
        {
          entityId: 'E2',
          entity: { id: 'E2' },
          allocationBasis: 'Commitment',
          amount: 5,
        },
      ]),
    );
    const result = await service.totalAmount({
      entityIds: ['E1', 'E2'],
      allocationBasis: 'Commitment',
      toDate: '2026-06-30',
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      entity: { id: 'E1' },
      amount: 300.3,
      batchDate: '2026-06-30',
    });
    expect(model.find.mock.calls[0][0].batchDate).toEqual({
      $lte: '2026-06-30',
    });
  });
});
