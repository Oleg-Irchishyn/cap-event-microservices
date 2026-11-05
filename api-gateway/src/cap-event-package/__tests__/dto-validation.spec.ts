import { ArgumentMetadata } from '@nestjs/common';

import { ValidationException } from '../../exceptions/validation.exception';
import { ValidationPipe } from '../../pipes/validation.pipe';
import {
  EntitiesQueryDto,
  TotalAmountQueryDto,
} from '../../reference-data/dto/reference-data-query.dto';
import {
  AllocationInputDto,
  CapEventListQueryDto,
  FundGroupAllocationInputDto,
  InvestorDocumentInputDto,
  MgmtFeeLineItemsQueryDto,
} from '../dto/allocation.dto';
import { CapEventDto } from '../dto/cap-event.dto';

const pipe = new ValidationPipe();
const check = (metatype: new () => object, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });
const messagesOf = async (
  metatype: new () => object,
  value: unknown,
): Promise<string[]> => {
  try {
    await check(metatype, value);
  } catch (e) {
    return [(e as ValidationException).messages].flat();
  }
  return [];
};

/** What cap-event-ui's PreviewScreenStore.buildPayload / SubmitButton send. */
const uiPayload = () => ({
  sponsor: { id: '1', name: 'Golden Dev Test' },
  capEventType: {
    id: '657475ed-b745-41d3-a864-463847900129',
    abbreviation: 'Call',
    name: 'Capital Call',
  },
  fundGroup: { id: 'FG001', name: 'Global Equity' },
  entities: [
    {
      id: '73301-01',
      name: 'Global Equity Master Fund LP',
      state: 'selected',
      label: 'x',
    },
  ],
  noticeDate: '2026-12-01',
  status: 'DRAFT',
  comment: 'hello',
  capEventFundGroupLineItems: [
    {
      inheritanceId: 'i1',
      investment: null,
      allocationBasisId: 'DS-CMNT',
      allocationBasis: 'Commitment',
      amount: 10,
      account: { accountNo: '3110' },
    },
  ],
  capEventEntityLineItems: [
    {
      entity: { id: '73301-01', name: 'Fund' },
      noticeDate: '2026-12-01',
      dueDate: '2026-12-15',
      capEventLineItems: [
        {
          account: {
            accountNo: '3110',
            capitalCategory: 'Cont - Investments',
            insideCommitment: 'yes',
          },
          investment: null,
          allocationBasis: 'Commitment',
          allocationBasisId: 'DS-CMNT',
          amount: 1000,
          fundGroupLineItemInheritanceId: 'i1',
          prDate: '2026-12-15',
          prFlag: true,
          isMfLineItem: false,
          batchNo: undefined,
          originAccountKey: undefined,
        },
      ],
    },
  ],
  totalAmount: 1000,
});

describe('CapEventDto (what the generated UI client sends)', () => {
  it('accepts the UI payload, drafts without entity line items and empty dates', async () => {
    await expect(check(CapEventDto, uiPayload())).resolves.toBeDefined();
    await expect(
      check(CapEventDto, {
        ...uiPayload(),
        capEventEntityLineItems: [],
        noticeDate: '',
      }),
    ).resolves.toBeDefined();
  });

  it('keeps unknown properties (no whitelisting)', async () => {
    const body = { ...uiPayload(), somethingNew: 1 };
    await expect(check(CapEventDto, body)).resolves.toBe(body);
  });

  it('rejects structural problems with readable messages', async () => {
    const messages = await messagesOf(CapEventDto, {
      ...uiPayload(),
      sponsor: 'x',
      entities: 'nope',
      status: 'WEIRD',
      comment: 'c'.repeat(1201),
      capEventEntityLineItems: [
        {
          entity: {},
          noticeDate: 'tomorrow',
          dueDate: '2026-12-15',
          capEventLineItems: [{ account: {}, amount: 'ten' }],
        },
      ],
    });
    const text = messages.join(' | ');
    expect(text).toContain('sponsor - Should be an object');
    expect(text).toContain('entities - Should be a list');
    expect(text).toContain(
      'status - Should be one of DRAFT, SUBMITTED, POSTED',
    );
    expect(text).toContain('comment - Should be at most 1200 characters');
    expect(text).toContain('capEventEntityLineItems');
  });

  it('rejects a missing required top-level field', async () => {
    const { sponsor: _sponsor, ...rest } = uiPayload();
    expect(_sponsor).toBeDefined();
    expect((await messagesOf(CapEventDto, rest)).join()).toContain('sponsor');
  });
});

describe('allocation inputs', () => {
  it('AllocationInputDto accepts what allocateLineItem sends (incl. empty ids)', async () => {
    await expect(
      check(AllocationInputDto, {
        entityId: 'E1',
        dueDate: '2026-12-15',
        allocationBasisId: '',
        accountNo: '',
        investmentId: '',
        amount: 0,
      }),
    ).resolves.toBeDefined();
    expect(
      (
        await messagesOf(AllocationInputDto, {
          entityId: '',
          dueDate: 'x',
          amount: '5',
        })
      ).length,
    ).toBeGreaterThan(2);
  });

  it('FundGroupAllocationInputDto accepts the UI body and the spec example', async () => {
    await expect(
      check(FundGroupAllocationInputDto, {
        allocationBasis: 'Commitment',
        amount: 100,
        entityAllocationInput: [{ entityId: 'E1', dueDate: '2026-12-15' }],
      }),
    ).resolves.toBeDefined();
    await expect(
      check(FundGroupAllocationInputDto, {
        allocationBasis: 'commitment',
        allocationBasisId: 'DS-CMNT',
        amount: 1000000,
        entityAllocationInput: [
          { entityId: 'ENTITY001', dueDate: '2024-12-15' },
        ],
      }),
    ).resolves.toBeDefined();
    expect(
      (
        await messagesOf(FundGroupAllocationInputDto, {
          allocationBasis: 'c',
          amount: 1,
          entityAllocationInput: [{}],
        })
      ).join(),
    ).toContain('entityAllocationInput');
  });

  it('InvestorDocumentInputDto validates the nested cap event', async () => {
    await expect(
      check(InvestorDocumentInputDto, {
        capEvent: uiPayload(),
        lineItem: { plInvestorEntries: [] },
      }),
    ).resolves.toBeDefined();
    expect(
      (
        await messagesOf(InvestorDocumentInputDto, {
          capEvent: { ...uiPayload(), sponsor: 1 },
          lineItem: {},
        })
      ).join(),
    ).toContain('capEvent');
  });
});

describe('query DTOs', () => {
  it('batchNo must be an integer (strings from the query string are fine)', async () => {
    await expect(
      check(MgmtFeeLineItemsQueryDto, { batchNo: '6001', entityId: 'E1' }),
    ).resolves.toBeDefined();
    expect(
      (
        await messagesOf(MgmtFeeLineItemsQueryDto, {
          batchNo: 'abc',
          entityId: 'E1',
        })
      ).join(),
    ).toContain('batchNo - Should be an integer');
  });

  it('single and repeated array parameters are both accepted', async () => {
    await expect(
      check(EntitiesQueryDto, { statuses: 'ACTIVE' }),
    ).resolves.toBeDefined();
    await expect(
      check(EntitiesQueryDto, {
        statuses: ['ACTIVE', 'INACTIVE'],
        typesToExclude: ['ADMIN'],
      }),
    ).resolves.toBeDefined();
    await expect(
      check(CapEventListQueryDto, { statuses: 'DRAFT', sponsorId: '1' }),
    ).resolves.toBeDefined();
  });

  it('required arrays and dates are enforced', async () => {
    await expect(
      check(TotalAmountQueryDto, {
        entityIds: 'E1',
        allocationBasis: 'Commitment',
        toDate: '2026-06-30',
      }),
    ).resolves.toBeDefined();
    const messages = (
      await messagesOf(TotalAmountQueryDto, {
        allocationBasis: 'Commitment',
        toDate: '30/06/2026',
      })
    ).join();
    expect(messages).toContain('entityIds');
    expect(messages).toContain(
      'toDate - Should be a date in YYYY-MM-DD format',
    );
  });
});
