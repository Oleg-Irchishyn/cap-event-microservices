import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

import {
  DATE_REGEX,
  queryArray,
} from '../../common/utils/query-validation.util';

const STRING_MSG = { message: 'Should be in string format' };
const STRINGS_MSG = { each: true, message: 'Should be a list of strings' };
const INT_MSG = { message: 'Should be an integer' };

export class FundGroupSearchQueryDto {
  @ApiPropertyOptional({ description: 'Sponsor ID used to filter fund groups' })
  @IsOptional()
  @IsString(STRING_MSG)
  readonly sponsorId?: string;
}

export class EntitiesQueryDto {
  @ApiPropertyOptional({
    type: [String],
    example: ['ACTIVE'],
    description: 'Filter by entity statuses',
  })
  @Transform(queryArray)
  @IsOptional()
  @IsString(STRINGS_MSG)
  readonly statuses?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['ADMIN', 'ELIMINATION'],
    description: 'Exclude specific entity types',
  })
  @Transform(queryArray)
  @IsOptional()
  @IsString(STRINGS_MSG)
  readonly typesToExclude?: string[];
}

export class AccountsQueryDto {
  @ApiProperty({ description: 'Sponsor ID which accounts to retrieve' })
  @IsString(STRING_MSG)
  @IsNotEmpty({ message: 'Sponsor ID cannot be empty' })
  readonly sponsorId: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Capital'],
    description: 'Financial Groupings to include',
  })
  @Transform(queryArray)
  @IsOptional()
  @IsString(STRINGS_MSG)
  readonly fsGroupings?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Capital Categories to exclude',
  })
  @Transform(queryArray)
  @IsOptional()
  @IsString(STRINGS_MSG)
  readonly capitalCategories?: string[];
}

export class MgmtFeeJournalQueryDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'List of entity IDs to filter journal entries',
  })
  @Transform(queryArray)
  @IsOptional()
  @IsString(STRINGS_MSG)
  readonly entityIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'List of financial statement line items to filter',
  })
  @Transform(queryArray)
  @IsOptional()
  @IsString(STRINGS_MSG)
  readonly fsLineItems?: string[];

  @ApiPropertyOptional({
    example: 'N',
    description: 'Called flag to filter journal entries (Y or N)',
  })
  @IsOptional()
  @IsString(STRING_MSG)
  readonly calledFlag?: string;
}

export class MgmtFeeLineItemsQueryDto {
  @ApiProperty({ type: 'integer', example: 6001 })
  @Type(() => Number)
  @IsInt(INT_MSG)
  readonly batchNo: number;

  @ApiProperty({ example: '73301-01' })
  @IsString(STRING_MSG)
  @IsNotEmpty({ message: 'Entity ID cannot be empty' })
  readonly entityId: string;

  @ApiProperty({ example: 'POSTED' })
  @IsString(STRING_MSG)
  @IsNotEmpty({ message: 'State cannot be empty' })
  readonly state: string;

  @ApiProperty({ example: 'N', description: 'Called flag (Y or N)' })
  @IsString(STRING_MSG)
  @IsNotEmpty({ message: 'Called flag cannot be empty' })
  readonly calledFlag: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'List of financial statement line items to filter',
  })
  @Transform(queryArray)
  @IsOptional()
  @IsString(STRINGS_MSG)
  readonly fsLineItems?: string[];
}

export class TotalAmountQueryDto {
  @ApiProperty({ type: [String], example: ['73301-01'] })
  @Transform(queryArray)
  @IsArray({ message: 'Should be a list of entity IDs' })
  @ArrayNotEmpty({ message: 'At least one entity ID is required' })
  @IsString(STRINGS_MSG)
  readonly entityIds: string[];

  @ApiProperty({ example: 'Commitment' })
  @IsString(STRING_MSG)
  @IsNotEmpty({ message: 'Allocation basis cannot be empty' })
  readonly allocationBasis: string;

  @ApiProperty({
    format: 'date',
    example: '2026-06-30',
    description: 'Date up to which transactions are included (inclusive)',
  })
  @Matches(DATE_REGEX, { message: 'Should be a date in YYYY-MM-DD format' })
  readonly toDate: string;
}

export class JournalEntriesQueryDto {
  @ApiProperty({ type: 'integer', example: 6001 })
  @Type(() => Number)
  @IsInt(INT_MSG)
  readonly batchNo: number;

  @ApiProperty({ example: '1-3130' })
  @IsString(STRING_MSG)
  @IsNotEmpty({ message: 'Account key cannot be empty' })
  readonly accountKey: string;

  @ApiProperty({ example: 'Commitment' })
  @IsString(STRING_MSG)
  @IsNotEmpty({ message: 'Allocation basis cannot be empty' })
  readonly allocationBasis: string;

  @ApiProperty({ example: '73301-01' })
  @IsString(STRING_MSG)
  @IsNotEmpty({ message: 'Entity ID cannot be empty' })
  readonly entityId: string;
}

export class InvestorAttributesQueryDto {
  @ApiProperty({ example: 'CUST001' })
  @IsString(STRING_MSG)
  @IsNotEmpty({ message: 'Investor ID cannot be empty' })
  readonly investorId: string;

  @ApiProperty({ example: '73301-01' })
  @IsString(STRING_MSG)
  @IsNotEmpty({ message: 'Entity ID cannot be empty' })
  readonly entityId: string;
}
