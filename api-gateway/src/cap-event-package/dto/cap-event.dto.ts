import type {
  Account,
  CapEvent,
  CapEventType,
  Entity,
  FundGroup,
  Investment,
  Sponsor,
} from '@cap-event/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { DATE_OR_EMPTY_REGEX } from '../../common/utils/query-validation.util';
import {
  AccountDto,
  EntityDto,
  FundGroupDto,
  InvestmentDto,
  SponsorDto,
} from '../../reference-data/dto/reference-data-response.dto';

/*
 * Request/response body of capEventPackage.json (CapEvent, CapEventDraft and
 * their parts). The UI's generated client sends partially filled objects
 * (e.g. `investment: null`, `account` with only some fields, `''` for unset
 * dates), so validation checks structure and types, not completeness of the
 * nested reference objects. Unknown properties are kept.
 */

const OBJ_MSG = { message: 'Should be an object' };
const STR_MSG = { message: 'Should be in string format' };
const NUM_MSG = { message: 'Should be a number' };
const DATE_MSG = { message: 'Should be a date in YYYY-MM-DD format' };
const CAP_EVENT_STATUSES = ['DRAFT', 'SUBMITTED', 'POSTED'];

export class CapEventTypeDto implements CapEventType {
  @ApiPropertyOptional({ format: 'uuid' })
  id?: string;

  @ApiPropertyOptional({ example: 'Call' })
  abbreviation?: string;

  @ApiPropertyOptional({ example: 'Capital Call' })
  name?: string;

  @ApiPropertyOptional()
  description?: string;
}

export class MgmtFeeJournalEntryDto {
  @ApiPropertyOptional({ description: 'Management fee amount' })
  amount?: number;

  @ApiPropertyOptional({ format: 'date', description: 'Batch date' })
  batchDate?: string;

  @ApiPropertyOptional({ description: 'Description' })
  description?: string;

  @ApiPropertyOptional({ type: 'integer', description: 'Batch number' })
  batchNo?: number;
}

export class CapEventLineItemDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString(STR_MSG)
  id?: string;

  @ApiProperty({ type: AccountDto })
  @IsObject(OBJ_MSG)
  account: Account;

  @ApiPropertyOptional({ type: InvestmentDto, nullable: true })
  @IsOptional()
  @IsObject(OBJ_MSG)
  investment?: Investment | null;

  @ApiProperty()
  @IsString(STR_MSG)
  allocationBasis: string;

  @ApiProperty()
  @IsString(STR_MSG)
  allocationBasisId: string;

  @ApiProperty()
  @IsNumber({}, NUM_MSG)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Should be a boolean' })
  isMfLineItem?: boolean;

  @ApiPropertyOptional({ type: 'integer' })
  @IsOptional()
  @IsNumber({}, NUM_MSG)
  batchNo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString(STR_MSG)
  originAccountKey?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString(STR_MSG)
  fundGroupLineItemInheritanceId?: string;

  @ApiProperty({ format: 'date' })
  @Matches(DATE_OR_EMPTY_REGEX, DATE_MSG)
  prDate: string;

  @ApiProperty()
  @IsBoolean({ message: 'Should be a boolean' })
  prFlag: boolean;
}

export class CapEventEntityLineItemDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString(STR_MSG)
  id?: string;

  @ApiProperty({ type: EntityDto })
  @IsObject(OBJ_MSG)
  entity: Entity;

  @ApiProperty({ format: 'date' })
  @Matches(DATE_OR_EMPTY_REGEX, DATE_MSG)
  noticeDate: string;

  @ApiProperty({ format: 'date' })
  @Matches(DATE_OR_EMPTY_REGEX, DATE_MSG)
  dueDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString(STR_MSG)
  templateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Should be a boolean' })
  includeUncalledMgmtFee?: boolean;

  @ApiPropertyOptional({ type: MgmtFeeJournalEntryDto })
  @IsOptional()
  @IsObject(OBJ_MSG)
  mgmtFeeJournalEntry?: MgmtFeeJournalEntryDto;

  @ApiProperty({ type: [CapEventLineItemDto] })
  @IsArray({ message: 'Should be a list' })
  @ValidateNested({ each: true })
  @Type(() => CapEventLineItemDto)
  capEventLineItems: CapEventLineItemDto[];
}

export class InvestorEntryDto {
  @ApiPropertyOptional({ format: 'uuid' }) id?: string;
  @ApiPropertyOptional({ type: AccountDto }) account?: AccountDto;
  @ApiPropertyOptional({ type: InvestmentDto }) investment?: InvestmentDto;
  @ApiPropertyOptional() optOut?: boolean;
  @ApiPropertyOptional() readOnly?: boolean;
  @ApiPropertyOptional() rounded?: boolean;
  @ApiPropertyOptional() investor?: string;
  @ApiPropertyOptional() classID?: string;
  @ApiPropertyOptional() additionalInvestorType?: string;
  @ApiPropertyOptional() customerId?: string;
  @ApiPropertyOptional() customerName?: string;
  @ApiPropertyOptional() department?: string;
  @ApiPropertyOptional() commitment?: number;
  @ApiPropertyOptional() investedCapital?: number;
  @ApiPropertyOptional() unfunded?: number;
  @ApiPropertyOptional() managementFee?: number;
  @ApiPropertyOptional() managementFeePercentage?: number;
  @ApiPropertyOptional() amount?: number;
  @ApiPropertyOptional() originalAmount?: number;
  @ApiPropertyOptional() allocatedAmount?: number;
  @ApiPropertyOptional() allocatedAmountNotRounded?: number;
  @ApiPropertyOptional() isTransferEntry?: boolean;
  @ApiPropertyOptional({ type: 'integer' }) trType?: number;
  @ApiPropertyOptional() hasZeroCtb?: boolean;
  @ApiPropertyOptional() investorToRound?: boolean;
  @ApiPropertyOptional() location?: string;
  @ApiPropertyOptional() dataPoints?: string;
  @ApiPropertyOptional({ default: false }) isAggregated?: boolean;
  @ApiPropertyOptional() lineItemAmount?: number;
  @ApiPropertyOptional() fileId?: string;
}

export class CapEventAggregatedLineItemDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString(STR_MSG)
  id?: string;

  @ApiPropertyOptional({ type: EntityDto })
  @IsOptional()
  @IsObject(OBJ_MSG)
  entity?: EntityDto;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsString(STR_MSG)
  dueDate?: string;

  @ApiPropertyOptional({ type: [InvestorEntryDto] })
  @IsOptional()
  @IsArray({ message: 'Should be a list' })
  plInvestorEntries?: InvestorEntryDto[];
}

/** CapEvent / CapEventDraft (request and response). */
export class CapEventDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID(undefined, { message: 'Should be a UUID' })
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString(STR_MSG)
  name?: string;

  @ApiProperty({ type: CapEventTypeDto })
  @IsObject(OBJ_MSG)
  capEventType: CapEventType;

  @ApiProperty({ type: SponsorDto })
  @IsObject(OBJ_MSG)
  sponsor: Sponsor;

  @ApiProperty({ type: FundGroupDto })
  @IsObject(OBJ_MSG)
  fundGroup: FundGroup;

  @ApiProperty({
    type: [EntityDto],
    description: 'The list of selected entities',
  })
  @IsArray({ message: 'Should be a list' })
  @IsObject({ each: true, message: 'Should be a list of objects' })
  entities: Entity[];

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @Matches(DATE_OR_EMPTY_REGEX, DATE_MSG)
  noticeDate?: string;

  @ApiPropertyOptional({ enum: CAP_EVENT_STATUSES })
  @IsOptional()
  @IsIn(CAP_EVENT_STATUSES, {
    message: `Should be one of ${CAP_EVENT_STATUSES.join(', ')}`,
  })
  status?: CapEvent['status'];

  @ApiPropertyOptional({ maxLength: 1200 })
  @IsOptional()
  @IsString(STR_MSG)
  @MaxLength(1200, { message: 'Should be at most 1200 characters' })
  comment?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject(OBJ_MSG)
  footnotes?: Record<string, string>;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray({ message: 'Should be a list' })
  capEventFundGroupLineItems?: CapEvent['capEventFundGroupLineItems'];

  @ApiPropertyOptional({ type: [CapEventEntityLineItemDto] })
  @IsOptional()
  @IsArray({ message: 'Should be a list' })
  @ValidateNested({ each: true })
  @Type(() => CapEventEntityLineItemDto)
  capEventEntityLineItems?: CapEventEntityLineItemDto[];

  @ApiPropertyOptional({ type: [CapEventAggregatedLineItemDto] })
  @IsOptional()
  @IsArray({ message: 'Should be a list' })
  @ValidateNested({ each: true })
  @Type(() => CapEventAggregatedLineItemDto)
  capEventAggregatedLineItems?: CapEventAggregatedLineItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, NUM_MSG)
  totalAmount?: number;

  @ApiPropertyOptional({ format: 'date' })
  createdAt?: string;

  @ApiPropertyOptional({ format: 'email' })
  createdBy?: string;

  @ApiPropertyOptional({ format: 'date' })
  modifiedAt?: string;

  @ApiPropertyOptional({ format: 'email' })
  modifiedBy?: string;
}
