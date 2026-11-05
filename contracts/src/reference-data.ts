import type { components } from './generated/reference-data';

/**
 * TCP contract of reference-data-service. Response types come from the
 * OpenAPI spec (openapi/referenceData.json + common.json), generated into
 * src/generated/reference-data.ts.
 */
type Schemas = components['schemas'];

export type Sponsor = Schemas['Sponsor'];
export type FundGroup = Schemas['FundGroup'];
export type Entity = Schemas['Entity'];
export type Account = Schemas['Account'];
export type Investment = Schemas['Investment'];
export type AllocationBasis = Schemas['AllocationBasis'];
export type Query = Schemas['Query'];
export type QueryResults = Schemas['QueryResults'];
export type JournalEntry = Schemas['JournalEntry'];
export type InvestorAttribute = Schemas['InvestorAttribute'];
export type ErrorResponse = Schemas['ErrorResponse'];

/** `@MessagePattern` names handled by reference-data-service. */
export const ReferenceDataPattern = {
  FUND_GROUPS_SEARCH: 'reference-data.fund-groups.search',
  ENTITIES_BY_FUND_GROUP: 'reference-data.entities.by-fund-group',
  ACCOUNTS_LIST: 'reference-data.accounts.list',
  ACCOUNTS_MAPPED: 'reference-data.accounts.mapped',
  QUERIES_LIST: 'reference-data.queries.list',
  QUERIES_EXECUTE: 'reference-data.queries.execute',
  INVESTMENTS_LIST: 'reference-data.investments.list',
  SPONSORS_LIST: 'reference-data.sponsors.list',
  JOURNAL_ENTRIES_MGMT_FEE: 'reference-data.journal-entries.mgmt-fee',
  JOURNAL_ENTRIES_MGMT_FEE_LINE_ITEMS:
    'reference-data.journal-entries.mgmt-fee-line-items',
  JOURNAL_ENTRIES_TOTAL_AMOUNT: 'reference-data.journal-entries.total-amount',
  JOURNAL_ENTRIES_LIST: 'reference-data.journal-entries.list',
  ALLOCATION_BASES_LIST: 'reference-data.allocation-bases.list',
  INVESTOR_ATTRIBUTES_GET: 'reference-data.investor-attributes.get',
} as const;

export type ReferenceDataPatternName =
  (typeof ReferenceDataPattern)[keyof typeof ReferenceDataPattern];

export interface FundGroupsSearchPayload {
  sponsorId?: string;
}

export interface EntitiesByFundGroupPayload {
  fundGroupId: string;
  statuses?: string[];
  typesToExclude?: string[];
}

export interface AccountsListPayload {
  sponsorId: string;
  fsGroupings?: string[];
  capitalCategories?: string[];
}

export interface AccountsMappedPayload {
  id: string;
}

export interface QueriesExecutePayload {
  queryId: string;
  arguments?: Record<string, string>;
}

export interface MgmtFeeJournalEntriesPayload {
  entityIds?: string[];
  fsLineItems?: string[];
  calledFlag?: string;
}

export interface MgmtFeeJournalLineItemsPayload {
  batchNo: number;
  entityId: string;
  state: string;
  calledFlag: string;
  fsLineItems?: string[];
}

export interface TotalAmountJournalEntriesPayload {
  entityIds: string[];
  allocationBasis: string;
  /** ISO date (YYYY-MM-DD), inclusive. */
  toDate: string;
}

export interface JournalEntriesListPayload {
  batchNo: number;
  accountKey: string;
  allocationBasis: string;
  entityId: string;
}

export interface InvestorAttributesPayload {
  investorId: string;
  entityId: string;
}

/**
 * Convention shared by the demo data of both services: investors are
 * `CUST001`..`CUST008`. reference-data-service seeds investor attributes for
 * them; cap-event-package-service draws its simulated investor roster from them.
 */
export const DEMO_INVESTOR_IDS = [
  'CUST001',
  'CUST002',
  'CUST003',
  'CUST004',
  'CUST005',
  'CUST006',
  'CUST007',
  'CUST008',
] as const;
