import type { components } from './generated/cap-event-package';

/**
 * TCP contract of cap-event-package-service. Types come from the OpenAPI spec
 * (openapi/capEventPackage.json + common.json), generated into
 * src/generated/cap-event-package.ts.
 */
type Schemas = components['schemas'];

export type CapEvent = Schemas['CapEvent'];
export type CapEventDraft = Schemas['CapEventDraft'];
export type CapEventType = Schemas['CapEventType'];
export type CapEventStatus = Schemas['CapEventStatus'];
export type CapEventLineItem = Schemas['CapEventLineItem'];
export type CapEventEntityLineItem = Schemas['CapEventEntityLineItem'];
export type CapEventFundGroupLineItem = Schemas['CapEventFundGroupLineItem'];
export type CapEventAggregatedLineItem = Schemas['CapEventAggregatedLineItem'];
export type InvestorEntry = Schemas['InvestorEntry'];
export type AllocationInput = Schemas['AllocationInput'];
export type FundGroupAllocationInput = Schemas['FundGroupAllocationInput'];
export type InvestorDocumentInput = Schemas['InvestorDocumentInput'];
export type MgmtFeeJournalEntry = Schemas['MgmtFeeJournalEntry'];

export const CAP_EVENT_STATUSES = ['DRAFT', 'SUBMITTED', 'POSTED'] as const;

/** `@MessagePattern` names handled by cap-event-package-service. */
export const CapEventPackagePattern = {
  TYPES: 'cap-events.types',
  SUBMIT: 'cap-events.submit',
  LIST: 'cap-events.list',
  CREATE_DRAFT: 'cap-events.create-draft',
  GET: 'cap-events.get',
  DELETE: 'cap-events.delete',
  UPDATE: 'cap-events.update',
  PROCESS: 'cap-events.process',
  LINE_ITEM_ALLOCATE: 'cap-events.line-items.allocate',
  MGMT_FEE_LINE_ITEMS: 'cap-events.line-items.mgmt-fees',
  MGMT_FEE_JOURNAL_ENTRIES: 'cap-events.journal-entries.mgmt-fee',
  MGMT_FEE_ALLOCATE: 'cap-events.journal-entries.mgmt-fee-allocate',
  FUND_GROUP_ALLOCATE: 'cap-events.fund-group.allocate',
  INVESTOR_DOCUMENT: 'cap-events.investors.document',
} as const;

export type CapEventPackagePatternName =
  (typeof CapEventPackagePattern)[keyof typeof CapEventPackagePattern];

/** The authenticated user, forwarded by the gateway for createdBy/modifiedBy. */
export interface ActingUser {
  email: string;
}

export interface CapEventListPayload {
  sponsorId?: string;
  statuses?: string[];
}

export interface CapEventWritePayload {
  capEvent: CapEvent;
  user: ActingUser;
}

export interface CapEventUpdatePayload extends CapEventWritePayload {
  id: string;
}

export interface CapEventProcessPayload {
  capEvent: CapEvent;
}

export interface CapEventIdPayload {
  id: string;
}

export interface MgmtFeeLineItemsPayload {
  batchNo: number;
  entityId: string;
}

export interface MgmtFeeJournalEntriesByEntityPayload {
  entityIds: string[];
}

export interface MgmtFeeAllocatePayload {
  batchNo: number;
  accountKey: string;
  allocationBasis: string;
  allocationBasisId: string;
  entityId: string;
}

/** The investor document travels as base64 over TCP (tiny placeholder PDF). */
export interface InvestorDocumentResult {
  contentBase64: string;
  contentType: string;
}
