import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

import { CapEventDto } from './cap-event.dto';
import {
  DATE_OR_EMPTY_REGEX,
  queryArray,
} from '../../common/utils/query-validation.util';

const STR_MSG = { message: 'Should be in string format' };
const NUM_MSG = { message: 'Should be a number' };
const DATE_MSG = { message: 'Should be a date in YYYY-MM-DD format' };

export class AllocationInputDto {
  @ApiProperty({ example: '73301-01' })
  @IsString(STR_MSG)
  @IsNotEmpty({ message: 'Entity ID cannot be empty' })
  entityId: string;

  @ApiProperty({ format: 'date', example: '2026-12-15' })
  @Matches(DATE_OR_EMPTY_REGEX, DATE_MSG)
  dueDate: string;

  @ApiProperty({ example: 'DS-CMNT' })
  @IsString(STR_MSG)
  allocationBasisId: string;

  @ApiProperty({ example: '3110' })
  @IsString(STR_MSG)
  accountNo: string;

  @ApiProperty({ example: 'INV-001' })
  @IsString(STR_MSG)
  investmentId: string;

  @ApiProperty({ example: 1000000 })
  @IsNumber({}, NUM_MSG)
  amount: number;
}

export class EntityAllocationInputDto {
  @ApiProperty({ example: '73301-01' })
  @IsString(STR_MSG)
  @IsNotEmpty({ message: 'Entity ID cannot be empty' })
  entityId: string;

  @ApiProperty({ format: 'date', example: '2026-12-15' })
  @Matches(DATE_OR_EMPTY_REGEX, DATE_MSG)
  dueDate: string;
}

export class FundGroupAllocationInputDto {
  @ApiProperty({ type: [EntityAllocationInputDto] })
  @IsArray({ message: 'Should be a list' })
  @ValidateNested({ each: true })
  @Type(() => EntityAllocationInputDto)
  entityAllocationInput: EntityAllocationInputDto[];

  @ApiProperty({
    example: 'Commitment',
    description: 'Allocation basis for the entities (name)',
  })
  @IsString(STR_MSG)
  allocationBasis: string;

  @ApiPropertyOptional({
    example: 'DS-CMNT',
    description:
      'Not in the schema, but used by the spec example; preferred when present',
  })
  @IsOptional()
  @IsString(STR_MSG)
  allocationBasisId?: string;

  @ApiProperty({ example: 1000000, description: 'Total amount to allocate' })
  @IsNumber({}, NUM_MSG)
  amount: number;
}

export class InvestorDocumentInputDto {
  @ApiProperty({ type: CapEventDto })
  @IsObject({ message: 'Should be an object' })
  @ValidateNested()
  @Type(() => CapEventDto)
  capEvent: CapEventDto;

  @ApiProperty({
    description:
      'Aggregated line item; its investor entries must belong to one investor',
  })
  @IsObject({ message: 'Should be an object' })
  lineItem: Record<string, unknown>;
}

export class CapEventListQueryDto {
  @ApiPropertyOptional({ description: 'Optional Sponsor ID filter' })
  @IsOptional()
  @IsString(STR_MSG)
  sponsorId?: string;

  @ApiPropertyOptional({
    type: [String],
    enum: ['DRAFT', 'SUBMITTED', 'POSTED'],
    description: 'Optional status filter (repeat the parameter for several)',
  })
  @Transform(queryArray)
  @IsOptional()
  @IsString({ each: true, message: 'Should be a list of strings' })
  statuses?: string[];
}

export class MgmtFeeLineItemsQueryDto {
  @ApiProperty({ type: 'integer', example: 6002 })
  @Type(() => Number)
  @IsInt({ message: 'Should be an integer' })
  batchNo: number;

  @ApiProperty({ example: '73301-01' })
  @IsString(STR_MSG)
  @IsNotEmpty({ message: 'Entity ID cannot be empty' })
  entityId: string;
}

export class MgmtFeeJournalEntriesQueryDto {
  @ApiProperty({ type: [String], example: ['73301-01'] })
  @Transform(queryArray)
  @IsArray({ message: 'Should be a list of entity IDs' })
  @IsString({ each: true, message: 'Should be a list of strings' })
  @IsNotEmpty({ each: true, message: 'Entity ID cannot be empty' })
  entityIds: string[];
}

export class MgmtFeeAllocateQueryDto {
  @ApiProperty({ type: 'integer', example: 6002 })
  @Type(() => Number)
  @IsInt({ message: 'Should be an integer' })
  batchNo: number;

  @ApiProperty({ example: '1-3130' })
  @IsString(STR_MSG)
  @IsNotEmpty({ message: 'Account key cannot be empty' })
  accountKey: string;

  @ApiProperty({ example: 'Commitment' })
  @IsString(STR_MSG)
  allocationBasis: string;

  @ApiProperty({ example: 'DS-CMNT' })
  @IsString(STR_MSG)
  allocationBasisId: string;

  @ApiProperty({ example: '73301-01' })
  @IsString(STR_MSG)
  @IsNotEmpty({ message: 'Entity ID cannot be empty' })
  entityId: string;
}
