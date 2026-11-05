import { DEMO_INVESTOR_IDS } from '@cap-event/contracts';
import type {
  Account,
  AllocationBasis,
  Entity,
  Investment,
  JournalEntry,
  Query,
  Sponsor,
} from '@cap-event/contracts';

/**
 * Deterministic demo data. Everything is derived from the constant tables
 * below, so repeated seeding produces identical documents (idempotent upsert
 * by natural key) and the data set is internally consistent:
 * sponsor -> fund groups -> entities -> journal entries / investor attributes.
 */

export type SeedSponsor = Required<Sponsor>;
export interface SeedFundGroup {
  id: string;
  name: string;
  sponsorId: string;
}
export type SeedEntity = Entity & {
  id: string;
  name: string;
  fundGroupId: string;
  status: 'ACTIVE' | 'INACTIVE';
  type: 'FUND' | 'ADMIN' | 'ELIMINATION';
};
export type SeedAccount = Account & {
  accountKey: string;
  accountNo: string;
  accountName: string;
  sponsorId: string;
  fsGrouping: string;
};
export interface SeedMappedAccount {
  sourceAccountKey: string;
  mappedAccountKey: string;
}
export type SeedQuery = Query & {
  id: string;
  name: string;
  query: string;
  results: Record<string, string>;
};
export type SeedJournalEntry = JournalEntry & {
  key: string;
  kind: 'HEADER' | 'LINE';
  calledFlag: 'Y' | 'N';
  state: string;
  entityId: string;
};
export interface SeedInvestorAttribute {
  investorId: string;
  entityId: string;
  secondaryInvestorId: string;
}

export interface SeedData {
  sponsors: SeedSponsor[];
  fundGroups: SeedFundGroup[];
  entities: SeedEntity[];
  accounts: SeedAccount[];
  mappedAccounts: SeedMappedAccount[];
  queries: SeedQuery[];
  investments: Investment[];
  allocationBases: AllocationBasis[];
  journalEntries: SeedJournalEntry[];
  investorAttributes: SeedInvestorAttribute[];
}

/** Ids the UI hard-codes (cap-event-ui/src/const/allocationBasisOptions.ts). */
export const ALLOCATION_BASES: AllocationBasis[] = [
  {
    allocationId: 'DS-CMNT',
    allocationName: 'Commitment',
    type: 'dynamic',
    allocationBasisStatus: 'Active',
  },
  {
    allocationId: 'DS-UNFNDCMNT',
    allocationName: 'Unfunded Commitment',
    type: 'dynamic',
    allocationBasisStatus: 'Active',
  },
  {
    allocationId: 'DS-CNTRAll',
    allocationName: 'Contribution - All',
    type: 'dynamic',
    allocationBasisStatus: 'Active',
  },
  {
    allocationId: 'DS-CNTRDeal',
    allocationName: 'Contribution - Deal',
    type: 'dynamic',
    allocationBasisStatus: 'Active',
  },
  {
    allocationId: 'DS-NONDMNT',
    allocationName: 'Non-Dominant',
    type: 'dynamic',
    allocationBasisStatus: 'Active',
  },
  {
    allocationId: 'DS-LEGACY',
    allocationName: 'Legacy Pro Rata',
    type: 'static',
    allocationBasisStatus: 'Inactive',
  },
];

const SPONSORS: SeedSponsor[] = [
  ['1', 'Golden Dev Test', 'ACTIVE'],
  ['2', 'Apex Capital Partners', 'ACTIVE'],
  ['3', 'Meridian Growth Equity', 'ACTIVE'],
  ['4', 'Northwind Real Assets', 'ACTIVE'],
  ['5', 'Harborview Credit Advisors', 'ONBOARDING_TRANSITION'],
].map(([id, name, status]) => ({
  id,
  name,
  status: status as Sponsor['status'] & string,
  salesforceId: `0015g00000SF${id.padStart(6, '0')}`,
  companyIds: [`CO-${1000 + Number(id)}`],
}));

const FUND_GROUP_TABLE: Array<[string, string, string]> = [
  ['FG001', 'Global Equity', '1'],
  ['FG002', 'Emerging Markets Growth', '1'],
  ['FG003', 'Flagship Buyout', '2'],
  ['FG004', 'Secondaries Opportunities', '2'],
  ['FG005', 'Venture Growth I', '3'],
  ['FG006', 'Venture Growth II', '3'],
  ['FG007', 'Core Real Estate', '4'],
  ['FG008', 'Infrastructure Income', '4'],
  ['FG009', 'Senior Credit', '5'],
  ['FG010', 'Direct Lending', '5'],
];

const FUND_GROUPS: SeedFundGroup[] = FUND_GROUP_TABLE.map(
  ([id, name, sponsorId]) => ({ id, name, sponsorId }),
);

const basis = (id: string): AllocationBasis =>
  ALLOCATION_BASES.find((b) => b.allocationId === id) as AllocationBasis;

const buildEntities = (): SeedEntity[] => {
  const entities: SeedEntity[] = [];
  FUND_GROUPS.forEach((group, i) => {
    const mfPercent = ['0.02', '0.0175', '0.015', '0.0125'][i % 4];
    const common = {
      fundGroupId: group.id,
      dueDateDays: ['10', '15', '5'][i % 3],
      dueDateType: i % 2 === 0 ? 'Business Days' : 'Calendar Days',
      mfBasis: 'COMMITMENT',
      allocationBasis: basis(i % 2 === 0 ? 'DS-CMNT' : 'DS-UNFNDCMNT'),
      allocationBasisPostInvPeriod: basis(
        i % 2 === 0 ? 'DS-UNFNDCMNT' : 'DS-CNTRAll',
      ),
      mfBasisDateDefault: 'Quarter End',
      yearFractionApproach: i % 2 === 0 ? 'ACT/360' : '30/360',
      mfPercent,
      mfStartDate: '01/01/2025',
      mfStepDownDate: '01/01/2029',
      mfPercentPostInvPeriod: (Number(mfPercent) * 0.75).toFixed(5),
    };
    const id = (n: number) => `${73300 + i + 1}-${String(n).padStart(2, '0')}`;
    const fundNames = ['Master Fund LP', 'Feeder A LP', 'Feeder B LP'];
    fundNames.forEach((suffix, n) => {
      entities.push({
        ...common,
        id: id(n + 1),
        name: `${group.name} ${suffix}`,
        status: i % 3 === 2 && n === 2 ? 'INACTIVE' : 'ACTIVE',
        type: 'FUND',
      });
    });
    if (i % 2 === 0) {
      entities.push({
        ...common,
        id: id(4),
        name: `${group.name} GP Admin LLC`,
        status: 'ACTIVE',
        type: 'ADMIN',
      });
      entities.push({
        ...common,
        id: id(5),
        name: `${group.name} Elimination`,
        status: 'ACTIVE',
        type: 'ELIMINATION',
      });
    }
  });
  return entities;
};

const INVESTMENTS: Investment[] = [
  ['INV-001', 'Project Atlas', 'Atlas Holdings LP - Series A', 'Equity'],
  ['INV-002', 'Project Boreal', 'Boreal Energy Partners - Common', 'Equity'],
  ['INV-003', 'Project Cedar', 'Cedar Logistics Group - Preferred', 'Equity'],
  ['INV-004', 'Harbor Term Loan', 'Harbor Marine Term Loan B', 'Debt'],
  ['INV-005', 'Summit Notes', 'Summit Software Senior Notes 2029', 'Debt'],
  [
    'INV-006',
    'Lakeside Tower',
    'Lakeside Tower Office Property',
    'Real Estate',
  ],
  ['INV-007', 'Meridian Plaza', 'Meridian Plaza Retail Center', 'Real Estate'],
  [
    'INV-008',
    'Pacific Grid',
    'Pacific Grid Transmission Assets',
    'Infrastructure',
  ],
  ['INV-009', 'Orion Bio', 'Orion Biosciences Series C', 'Venture'],
  ['INV-010', 'Nova Payments', 'Nova Payments Series B', 'Venture'],
].map(([id, name, title, type]) => ({ id, name, title, type }));

/** [accountNo, name, category, reason, description, inside, fsLineItem, fsGrouping] */
type AccountTemplate = [
  string,
  string,
  string | undefined,
  string | undefined,
  string | undefined,
  string | undefined,
  string,
  string,
];
const CAPITAL = "Partners' Capital";
const ACCOUNT_TEMPLATES: AccountTemplate[] = [
  [
    '3110',
    'Partners Capital - Contributions',
    'Cont - Investments',
    'Investment',
    'Capital call for investment',
    'Yes',
    CAPITAL,
    'Capital',
  ],
  [
    '3111',
    'Partners Capital - Contributions (Outside)',
    'Cont - Investments',
    'Investment',
    'Capital call for investment (outside commitment)',
    'No',
    CAPITAL,
    'Capital',
  ],
  [
    '3120',
    'Partners Capital - Expense Contributions',
    'Cont - Expenses',
    'Fund Expenses',
    'Capital call for fund expenses',
    'Yes',
    CAPITAL,
    'Capital',
  ],
  [
    '3121',
    'Partners Capital - Expense Contributions (Outside)',
    'Cont - Expenses',
    'Fund Expenses',
    'Capital call for fund expenses (outside commitment)',
    'No',
    CAPITAL,
    'Capital',
  ],
  [
    '3130',
    'Partners Capital - Management Fee',
    'Cont - Mgmt Fee',
    'Management Fee',
    'Capital call for management fee',
    'Yes',
    CAPITAL,
    'Capital',
  ],
  [
    '3140',
    'Partners Capital - Recallable Equity',
    'Cont - ROE',
    'Recallable Distributions',
    'Recallable return of equity',
    'Yes',
    CAPITAL,
    'Capital',
  ],
  [
    '3150',
    'Partners Capital - Recallable Capital',
    'Cont – ROC',
    'Return of Capital',
    'Recallable return of capital',
    'Yes',
    CAPITAL,
    'Capital',
  ],
  [
    '3210',
    'Partners Capital - Income Distributions',
    'Dist - Income',
    'Income',
    'Distribution of investment income',
    'Yes',
    CAPITAL,
    'Capital',
  ],
  [
    '3220',
    'Partners Capital - Gain Distributions',
    'Dist - Gain',
    'Realized Gain',
    'Distribution of realized gains',
    'Yes',
    CAPITAL,
    'Capital',
  ],
  [
    '3230',
    'Partners Capital - Return of Capital',
    'Dist – ROC',
    'Return of Capital',
    'Distribution of return of capital',
    'No',
    CAPITAL,
    'Capital',
  ],
  [
    '3240',
    'Partners Capital - Dividend Distributions',
    'Dist – Dividend',
    'Dividend',
    'Distribution of dividends',
    'Yes',
    CAPITAL,
    'Capital',
  ],
  [
    '3310',
    'Partners Capital - Management Fee Adjustment',
    'Mgmt Fee',
    'Management Fee',
    'Management fee adjustment',
    'Yes',
    'Management Fees',
    'Capital',
  ],
  [
    '1010',
    'Cash - Operating',
    undefined,
    undefined,
    'Operating cash',
    'No',
    'Cash and Equivalents',
    'Assets',
  ],
  [
    '1300',
    'Capital Called Receivable',
    undefined,
    undefined,
    'Capital called, not yet received',
    'No',
    'Receivables',
    'Assets',
  ],
  [
    '2100',
    'Management Fee Payable',
    undefined,
    undefined,
    'Accrued management fee',
    'No',
    'Accrued Liabilities',
    'Liabilities',
  ],
  [
    '4100',
    'Interest Income',
    undefined,
    undefined,
    'Interest income',
    'Yes',
    'Interest Income',
    'Income',
  ],
  [
    '6100',
    'Management Fee Expense',
    undefined,
    undefined,
    'Management fee expense',
    'Yes',
    'Management Fees',
    'Expense',
  ],
  [
    '6200',
    'Professional Fees',
    undefined,
    undefined,
    'Audit, legal and tax fees',
    'Yes',
    'Professional Fees',
    'Expense',
  ],
  [
    '6300',
    'Organizational Costs',
    undefined,
    undefined,
    'Fund organizational costs',
    'Yes',
    'Organizational Costs',
    'Expense',
  ],
];

/** Capital accounts that map onto the "capital called receivable" account. */
const MAPPED_TARGET = '1300';

const buildAccounts = (): SeedAccount[] =>
  SPONSORS.flatMap((s) =>
    ACCOUNT_TEMPLATES.map(
      ([no, name, cat, reason, desc, inside, fsLine, grp]) => {
        const account: SeedAccount = {
          accountKey: `${s.id}-${no}`,
          accountNo: no,
          accountName: name,
          defaultDescription: desc,
          insideCommitment: inside,
          fsLineItem: fsLine,
          sponsorId: s.id,
          fsGrouping: grp,
        };
        if (cat) account.capitalCategory = cat;
        if (reason) account.callDistributionReason = reason;
        return account;
      },
    ),
  );

const buildMappedAccounts = (accounts: SeedAccount[]): SeedMappedAccount[] =>
  accounts
    .filter((a) => a.fsGrouping === 'Capital' && a.accountNo.startsWith('31'))
    .map((a) => ({
      sourceAccountKey: a.accountKey,
      mappedAccountKey: `${a.sponsorId}-${MAPPED_TARGET}`,
    }))
    .concat(
      SPONSORS.map((s) => ({
        sourceAccountKey: `${s.id}-6100`,
        mappedAccountKey: `${s.id}-2100`,
      })),
    );

const QUERIES: SeedQuery[] = [
  {
    id: '3f6c1c3e-6a0b-4d52-9d0e-0a1b2c3d4e01',
    name: 'vf_demo',
    query: '<object>Demo</object>',
    description: 'Demo description',
    results: { GL_ENTRY: '1234', ILPA_CATEGORY: 'Global Equity' },
  },
  {
    id: '3f6c1c3e-6a0b-4d52-9d0e-0a1b2c3d4e02',
    name: 'vf_commitments_by_entity',
    query: '<object>CommitmentsByEntity</object>',
    description: 'Total commitments of an entity',
    results: { TOTAL_COMMITMENT: '48250000', CURRENCY: 'USD' },
  },
  {
    id: '3f6c1c3e-6a0b-4d52-9d0e-0a1b2c3d4e03',
    name: 'vf_unfunded_by_entity',
    query: '<object>UnfundedByEntity</object>',
    description: 'Unfunded commitments of an entity',
    results: { TOTAL_UNFUNDED: '21400000', CURRENCY: 'USD' },
  },
  {
    id: '3f6c1c3e-6a0b-4d52-9d0e-0a1b2c3d4e04',
    name: 'vf_ilpa_categories',
    query: '<object>IlpaCategories</object>',
    description: 'ILPA reporting categories',
    results: { ILPA_CATEGORY: 'Management Fees', ILPA_SUBCATEGORY: 'Base Fee' },
  },
];

const QUARTERS: Array<{ date: string; label: string; called: 'Y' | 'N' }> = [
  { date: '2025-12-31', label: 'Q4 2025', called: 'Y' },
  { date: '2026-03-31', label: 'Q1 2026', called: 'Y' },
  { date: '2026-06-30', label: 'Q2 2026', called: 'N' },
  { date: '2026-09-30', label: 'Q3 2026', called: 'N' },
];

const stripInternal = (e: SeedEntity): Entity => {
  const rest: Partial<SeedEntity> = { ...e };
  delete rest.fundGroupId;
  delete rest.status;
  delete rest.type;
  return rest;
};

const stripAccount = (a: SeedAccount): Account => {
  const rest: Partial<SeedAccount> = { ...a };
  delete rest.sponsorId;
  delete rest.fsGrouping;
  return rest;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const buildJournalEntries = (
  entities: SeedEntity[],
  accounts: SeedAccount[],
): SeedJournalEntry[] => {
  const result: SeedJournalEntry[] = [];
  const sponsorOf = new Map(FUND_GROUPS.map((g) => [g.id, g.sponsorId]));
  const funds = entities.filter(
    (e) => e.type === 'FUND' && e.status === 'ACTIVE',
  );
  funds.forEach((entity, idx) => {
    const sponsorId = sponsorOf.get(entity.fundGroupId) as string;
    const feeAccount = accounts.find(
      (a) => a.accountKey === `${sponsorId}-3130`,
    );
    const adjAccount = accounts.find(
      (a) => a.accountKey === `${sponsorId}-3310`,
    );
    const apiEntity = stripInternal(entity);
    QUARTERS.forEach((q, qi) => {
      const batchNo = 6000 + idx * 10 + qi;
      const total = 150000 + ((idx * 3 + qi) % 5) * 25000;
      const base = {
        batchNo,
        batchDate: q.date,
        prDate: q.date,
        prFlag: 'Yes',
        agnstCommit: 'Yes',
        allocationBasis: entity.allocationBasis?.allocationName,
        allocationBasisDate: q.date,
        trType: 1,
        exchangeRate: 1,
        isRounded: false,
        optOutInvestors: '',
        entity: apiEntity,
        entityId: entity.id,
        calledFlag: q.called,
        state: 'POSTED',
      } as const;
      result.push({
        ...base,
        key: `${entity.id}:${batchNo}:H`,
        kind: 'HEADER',
        amount: total,
        description: `Management fee ${q.label}`,
      });
      const first = round2(total * 0.7);
      const lines: Array<[SeedAccount | undefined, number, string]> = [
        [feeAccount, first, `Management fee ${q.label} - base fee`],
        [
          adjAccount,
          round2(total - first),
          `Management fee ${q.label} - adjustment`,
        ],
      ];
      lines.forEach(([account, amount, description]) => {
        if (!account) return;
        result.push({
          ...base,
          key: `${entity.id}:${batchNo}:L:${account.accountNo}`,
          kind: 'LINE',
          account: stripAccount(account),
          amount,
          description,
        });
      });
    });
  });
  return result;
};

const buildInvestorAttributes = (
  entities: SeedEntity[],
): SeedInvestorAttribute[] =>
  entities
    .filter((e) => e.type === 'FUND')
    .flatMap((e) =>
      DEMO_INVESTOR_IDS.map((investorId) => ({
        investorId,
        entityId: e.id,
        secondaryInvestorId: `SEC-${investorId.slice(4)}-${e.id}`,
      })),
    );

export const buildSeedData = (): SeedData => {
  const entities = buildEntities();
  const accounts = buildAccounts();
  return {
    sponsors: SPONSORS,
    fundGroups: FUND_GROUPS,
    entities,
    accounts,
    mappedAccounts: buildMappedAccounts(accounts),
    queries: QUERIES,
    investments: INVESTMENTS,
    allocationBases: ALLOCATION_BASES,
    journalEntries: buildJournalEntries(entities, accounts),
    investorAttributes: buildInvestorAttributes(entities),
  };
};
