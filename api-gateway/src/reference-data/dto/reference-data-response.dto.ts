import type {
  Account,
  AllocationBasis,
  Entity,
  FundGroup,
  Investment,
  InvestorAttribute,
  JournalEntry,
  Query,
  Sponsor,
} from '@cap-event/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';

/*
 * Response shapes of referenceData.json / common.json. They `implements` the
 * types generated from the specs, so drift between the two fails the build.
 */

const SPONSOR_STATUSES = [
  'NEW',
  'PROSPECT',
  'ONBOARDING_TRANSITION',
  'PENDING_CS_APPROVAL',
  'PENDING_QC_LEGAL_APPROVAL',
  'QC_REJECTED',
  'LEGAL_REJECTED',
  'IT_PROCESSING',
  'ACTIVE',
  'NEVER_LAUNCHED',
  'OFFBOARDING',
  'INACTIVE',
  'PENDING_CS_APPROVAL_OFFBOARDING',
  'IT_PROCESSING_OFFBOARDING',
] as const;

export class SponsorDto implements Sponsor {
  @ApiPropertyOptional({ example: '1' })
  id?: string;

  @ApiPropertyOptional({ example: 'Golden Dev Test' })
  name?: string;

  @ApiPropertyOptional({ enum: SPONSOR_STATUSES, example: 'ACTIVE' })
  status?: Sponsor['status'];

  @ApiPropertyOptional({ example: '0015g00000SF000001' })
  salesforceId?: string;

  @ApiPropertyOptional({ type: [String], example: ['CO-1001'] })
  companyIds?: string[];
}

export class FundGroupDto implements FundGroup {
  @ApiPropertyOptional({ example: 'FG001' })
  id?: string;

  @ApiPropertyOptional({ example: 'Global Equity' })
  name?: string;
}

export class AllocationBasisDto implements AllocationBasis {
  @ApiPropertyOptional({ example: 'DS-CMNT' })
  allocationId?: string;

  @ApiPropertyOptional({ example: 'Commitment' })
  allocationName?: string;

  @ApiPropertyOptional({ example: 'dynamic' })
  type?: string;

  @ApiPropertyOptional({ enum: ['Active', 'Inactive'] })
  allocationBasisStatus?: AllocationBasis['allocationBasisStatus'];
}

export class EntityDto implements Entity {
  @ApiPropertyOptional({ example: '73301-01' })
  id?: string;

  @ApiPropertyOptional({ example: 'Global Equity Master Fund LP' })
  name?: string;

  @ApiPropertyOptional({ example: '10' })
  dueDateDays?: string;

  @ApiPropertyOptional({ example: 'Business Days' })
  dueDateType?: string;

  @ApiPropertyOptional({ deprecated: true })
  mfBasis?: string;

  @ApiPropertyOptional({ type: AllocationBasisDto })
  allocationBasis?: AllocationBasisDto;

  @ApiPropertyOptional({ type: AllocationBasisDto })
  allocationBasisPostInvPeriod?: AllocationBasisDto;

  @ApiPropertyOptional({ example: 'Quarter End' })
  mfBasisDateDefault?: string;

  @ApiPropertyOptional({ example: 'ACT/360' })
  yearFractionApproach?: string;

  @ApiPropertyOptional({ example: '0.02' })
  mfPercent?: string;

  @ApiPropertyOptional({ example: '01/01/2025' })
  mfStartDate?: string;

  @ApiPropertyOptional({ example: '01/01/2029' })
  mfStepDownDate?: string;

  @ApiPropertyOptional({ example: '0.015' })
  mfPercentPostInvPeriod?: string;
}

export class AccountDto implements Account {
  @ApiPropertyOptional({ example: '1-3110' })
  accountKey?: string;

  @ApiPropertyOptional({ example: 'Partners Capital - Contributions' })
  accountName?: string;

  @ApiPropertyOptional({ example: '3110' })
  accountNo?: string;

  @ApiPropertyOptional({ example: 'Cont - Investments' })
  capitalCategory?: string;

  @ApiPropertyOptional({ example: 'Investment' })
  callDistributionReason?: string;

  @ApiPropertyOptional({ example: 'Capital call for investment' })
  defaultDescription?: string;

  @ApiPropertyOptional({ example: 'Yes' })
  insideCommitment?: string;

  @ApiPropertyOptional({ example: "Partners' Capital" })
  fsLineItem?: string;
}

export class InvestmentDto implements Investment {
  @ApiPropertyOptional({ description: 'Unique identifier of the investment' })
  id?: string;

  @ApiPropertyOptional({ description: 'Short name of the investment' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Full descriptive title of the investment',
  })
  title?: string;

  @ApiPropertyOptional({ description: 'Type of the investment' })
  type?: string;
}

export class QueryDto implements Query {
  @ApiPropertyOptional({ format: 'uuid' })
  id?: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  query?: string;

  @ApiPropertyOptional()
  description?: string;
}

export class JournalEntryDto implements JournalEntry {
  @ApiPropertyOptional({ type: AccountDto })
  account?: AccountDto;

  @ApiPropertyOptional({ type: InvestmentDto })
  investment?: InvestmentDto;

  @ApiPropertyOptional()
  prDate?: string;

  @ApiPropertyOptional()
  prFlag?: string;

  @ApiPropertyOptional()
  agnstCommit?: string;

  @ApiPropertyOptional()
  allocationBasis?: string;

  @ApiPropertyOptional({ description: 'Amount of the journal entry' })
  amount?: number;

  @ApiPropertyOptional({ type: 'integer', description: 'Tr type' })
  trType?: number;

  @ApiPropertyOptional({ format: 'date', description: 'Batch date' })
  batchDate?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ type: 'integer', description: 'Batch number' })
  batchNo?: number;

  @ApiPropertyOptional({ type: EntityDto })
  entity?: EntityDto;

  @ApiPropertyOptional()
  exchangeRate?: number;

  @ApiPropertyOptional()
  classId?: string;

  @ApiPropertyOptional()
  customerId?: string;

  @ApiPropertyOptional()
  isRounded?: boolean;

  @ApiPropertyOptional()
  optOutInvestors?: string;

  @ApiPropertyOptional({ format: 'date' })
  allocationBasisDate?: string;
}

export class InvestorAttributeDto implements InvestorAttribute {
  @ApiPropertyOptional({ example: 'SEC-001-73301-01' })
  secondaryInvestorId?: string;
}
