import type { CapEvent } from '@cap-event/contracts';

import { rpcStatus } from '../../test-utils/fake-model';
import { AllocationService } from '../allocation.service';

const sum = (values: Array<number | undefined>) =>
  Math.round(values.reduce<number>((a, b) => a + (b ?? 0), 0) * 100) / 100;

describe('AllocationService', () => {
  const referenceData = {
    mgmtFeeJournalEntries: jest.fn(),
    mgmtFeeLineItems: jest.fn(),
    journalEntries: jest.fn(),
    allocationBases: jest.fn(),
  };
  const service = new AllocationService(referenceData as never);

  beforeEach(() => jest.resetAllMocks());

  describe('allocateLineItem', () => {
    const input = {
      entityId: '73301-01',
      dueDate: '2026-12-15',
      allocationBasisId: 'DS-CMNT',
      accountNo: '3110',
      investmentId: 'INV-001',
      amount: 1_000_000,
    };

    it('splits the amount across the entity roster proportionally to commitment', () => {
      const entries = service.allocateLineItem(input);
      expect(entries).toHaveLength(6);
      expect(sum(entries.map((e) => e.allocatedAmount))).toBe(1_000_000);
      const total = entries.reduce((s, e) => s + (e.commitment ?? 0), 0);
      for (const e of entries) {
        expect(e.allocatedAmount).toBeCloseTo(
          ((e.commitment ?? 0) / total) * 1_000_000,
          1,
        );
        expect(e.isAggregated).toBe(false);
        expect(e.account).toEqual({ accountNo: '3110' });
        expect(e.investment).toEqual({ id: 'INV-001' });
      }
    });

    it('is deterministic (including ids)', () => {
      expect(service.allocateLineItem(input)).toEqual(
        service.allocateLineItem(input),
      );
    });

    it('uses a different weight for a different basis', () => {
      const unfunded = service.allocateLineItem({
        ...input,
        allocationBasisId: 'DS-UNFNDCMNT',
      });
      const commitment = service.allocateLineItem(input);
      expect(unfunded.map((e) => e.allocatedAmount)).not.toEqual(
        commitment.map((e) => e.allocatedAmount),
      );
      expect(sum(unfunded.map((e) => e.allocatedAmount))).toBe(1_000_000);
    });

    it('splits equally for an unknown basis and rejects a bad amount', async () => {
      const equal = service.allocateLineItem({
        ...input,
        allocationBasisId: '',
        amount: 600,
      });
      expect(equal.map((e) => e.allocatedAmount)).toEqual([
        100, 100, 100, 100, 100, 100,
      ]);
      expect(
        await rpcStatus(() =>
          service.allocateLineItem({ ...input, amount: NaN }),
        ),
      ).toMatchObject({
        status: 400,
      });
    });
  });

  describe('allocateEntities', () => {
    it('splits across entities and sums exactly', () => {
      const result = service.allocateEntities({
        allocationBasis: 'Commitment',
        amount: 1_000_000,
        entityAllocationInput: [
          { entityId: 'A-1', dueDate: '2026-12-15' },
          { entityId: 'B-1', dueDate: '2026-12-20' },
          { entityId: 'A-1', dueDate: '2026-12-15' },
        ],
      });
      expect(Object.keys(result)).toEqual(['A-1', 'B-1']);
      expect(sum(Object.values(result))).toBe(1_000_000);
    });

    it('returns {} without entities', () => {
      expect(
        service.allocateEntities({
          allocationBasis: 'Commitment',
          amount: 5,
          entityAllocationInput: [],
        }),
      ).toEqual({});
    });
  });

  describe('management fee', () => {
    it('groups uncalled journal entries by entity (and lists entities without any)', async () => {
      referenceData.mgmtFeeJournalEntries.mockResolvedValue([
        {
          entity: { id: 'E1' },
          amount: 10,
          batchDate: '2026-06-30',
          description: 'd',
          batchNo: 1,
          account: { x: 1 },
        },
        {
          entity: { id: 'E1' },
          amount: 20,
          batchDate: '2026-09-30',
          description: 'e',
          batchNo: 2,
        },
        { amount: 5 },
      ]);
      const result = await service.mgmtFeeJournalEntries({
        entityIds: ['E1', 'E2'],
      });
      expect(referenceData.mgmtFeeJournalEntries).toHaveBeenCalledWith({
        entityIds: ['E1', 'E2'],
        calledFlag: 'N',
      });
      expect(result).toEqual({
        E1: [
          { amount: 10, batchDate: '2026-06-30', description: 'd', batchNo: 1 },
          { amount: 20, batchDate: '2026-09-30', description: 'e', batchNo: 2 },
        ],
        E2: [],
      });
    });

    it('shapes GL lines as cap event line items', async () => {
      referenceData.mgmtFeeLineItems.mockResolvedValue([
        {
          account: { accountKey: '1-3130', accountNo: '3130' },
          allocationBasis: 'Commitment',
          amount: 70,
          batchNo: 6001,
          prDate: '2026-06-30',
          prFlag: 'Yes',
        },
      ]);
      referenceData.allocationBases.mockResolvedValue([
        { allocationId: 'DS-CMNT', allocationName: 'Commitment' },
      ]);
      const [item] = await service.mgmtFeeLineItems({
        batchNo: 6001,
        entityId: 'E1',
      });
      expect(referenceData.mgmtFeeLineItems).toHaveBeenCalledWith({
        batchNo: 6001,
        entityId: 'E1',
        state: 'POSTED',
        calledFlag: 'N',
      });
      expect(item).toMatchObject({
        allocationBasis: 'Commitment',
        allocationBasisId: 'DS-CMNT',
        amount: 70,
        isMfLineItem: true,
        batchNo: 6001,
        originAccountKey: '1-3130',
        prFlag: true,
        prDate: '2026-06-30',
      });
      expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('allocates the journal entry amount and exposes it as managementFee', async () => {
      referenceData.journalEntries.mockResolvedValue([
        { amount: 100000, account: { accountKey: '1-3130' } },
        { amount: 50000.5, account: { accountKey: '1-3130' } },
      ]);
      const entries = await service.allocateMgmtFee({
        batchNo: 6001,
        accountKey: '1-3130',
        allocationBasis: 'Commitment',
        allocationBasisId: 'DS-CMNT',
        entityId: '73301-01',
      });
      expect(sum(entries.map((e) => e.allocatedAmount))).toBe(150000.5);
      expect(entries.every((e) => e.managementFee === e.allocatedAmount)).toBe(
        true,
      );
    });

    it('404 when the journal entry does not exist', async () => {
      referenceData.journalEntries.mockResolvedValue([]);
      expect(
        await rpcStatus(
          service.allocateMgmtFee({
            batchNo: 1,
            accountKey: 'x',
            allocationBasis: 'Commitment',
            allocationBasisId: 'DS-CMNT',
            entityId: 'E',
          }),
        ),
      ).toMatchObject({ status: 404 });
    });
  });

  describe('process', () => {
    const capEvent = {
      capEventEntityLineItems: [
        {
          entity: { id: '73301-01', name: 'Fund' },
          noticeDate: '2026-12-01',
          dueDate: '2026-12-15',
          capEventLineItems: [
            {
              account: { accountNo: '3110' },
              investment: null,
              allocationBasis: 'Commitment',
              allocationBasisId: 'DS-CMNT',
              amount: 1000,
              prDate: '2026-12-15',
              prFlag: true,
            },
            {
              account: { accountNo: '3120' },
              allocationBasis: 'Unfunded Commitment',
              allocationBasisId: 'DS-UNFNDCMNT',
              amount: 500,
              prDate: '2026-12-15',
              prFlag: false,
            },
          ],
        },
        {
          entity: { id: 'empty' },
          noticeDate: '',
          dueDate: '',
          capEventLineItems: [],
        },
      ],
    } as unknown as CapEvent;

    it('returns one aggregated item per entity with detail and aggregated investor entries', () => {
      const result = service.process(capEvent);
      expect(result).toHaveLength(1);
      const entries = result[0].plInvestorEntries ?? [];
      const aggregated = entries.filter((e) => e.isAggregated);
      const details = entries.filter((e) => !e.isAggregated);
      expect(aggregated).toHaveLength(6);
      expect(details).toHaveLength(12);
      expect(sum(aggregated.map((e) => e.allocatedAmount))).toBe(1500);
      for (const agg of aggregated) {
        const own = details.filter((d) => d.customerId === agg.customerId);
        expect(sum(own.map((d) => d.allocatedAmount))).toBe(
          agg.allocatedAmount,
        );
        expect(agg.lineItemAmount).toBe(1500);
      }
    });

    it('is deterministic and handles an event without line items', () => {
      expect(service.process(capEvent)).toEqual(service.process(capEvent));
      expect(service.process({} as CapEvent)).toEqual([]);
    });

    it('rejects a non-finite line amount', async () => {
      const bad = {
        capEventEntityLineItems: [
          {
            entity: { id: 'E' },
            dueDate: 'd',
            capEventLineItems: [{ amount: NaN }],
          },
        ],
      } as unknown as CapEvent;
      expect(await rpcStatus(() => service.process(bad))).toMatchObject({
        status: 400,
      });
    });
  });
});
