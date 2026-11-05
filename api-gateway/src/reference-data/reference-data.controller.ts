import { ReferenceDataPattern } from '@cap-event/contracts';
import type {
  Account,
  AllocationBasis,
  Entity,
  FundGroup,
  Investment,
  InvestorAttribute,
  JournalEntry,
  Query as QueryType,
  QueryResults,
  Sponsor,
} from '@cap-event/contracts';
import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import {
  ApiCommonErrors,
  ApiSessionIdHeader,
} from '../common/decorators/api-common-errors.decorator';
import { rpcCall, toStringArray } from '../common/utils/rpc-call.util';
import { ErrorResponseDto } from '../exceptions/dto/error-response.dto';
import { ErrorResponseFilter } from '../exceptions/error-response.filter';
import { JwtGuard } from '../guards/jwt.guard';
import {
  AccountsQueryDto,
  EntitiesQueryDto,
  FundGroupSearchQueryDto,
  InvestorAttributesQueryDto,
  JournalEntriesQueryDto,
  MgmtFeeJournalQueryDto,
  MgmtFeeLineItemsQueryDto,
  TotalAmountQueryDto,
} from './dto/reference-data-query.dto';
import {
  AccountDto,
  AllocationBasisDto,
  EntityDto,
  FundGroupDto,
  InvestmentDto,
  InvestorAttributeDto,
  JournalEntryDto,
  QueryDto,
  SponsorDto,
} from './dto/reference-data-response.dto';

export const REFERENCE_DATA_SERVICE = 'REFERENCE_DATA_SERVICE';
const LABEL = 'Reference data service';

/** Mirrors referenceData.json; the UI reaches it at `${HOSTNAME}/api/v1/reference-data`. */
@ApiTags('Reference data')
@ApiBearerAuth('bearerAuth')
@ApiCommonErrors()
@UseGuards(JwtGuard)
@UseFilters(ErrorResponseFilter)
@Controller('api/v1/reference-data')
export class ReferenceDataController {
  constructor(
    @Inject(REFERENCE_DATA_SERVICE) private readonly client: ClientProxy,
  ) {}

  private call<T>(pattern: string, payload: unknown = {}): Promise<T> {
    return rpcCall<T>(this.client, pattern, payload, LABEL);
  }

  @ApiOperation({
    operationId: 'searchFundGroupsBySponsor',
    summary: 'Search fund groups by sponsor ID',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [FundGroupDto] })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get('fund-groups/search')
  searchFundGroups(@Query() query: FundGroupSearchQueryDto) {
    return this.call<FundGroup[]>(ReferenceDataPattern.FUND_GROUPS_SEARCH, {
      sponsorId: query.sponsorId || undefined,
    });
  }

  @ApiOperation({
    operationId: 'getEntitiesByFundGroup',
    summary: 'Get entities by fund group ID',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [EntityDto] })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get('fund-groups/:fundGroupId/entities')
  entitiesByFundGroup(
    @Param('fundGroupId') fundGroupId: string,
    @Query() query: EntitiesQueryDto,
  ) {
    return this.call<Entity[]>(ReferenceDataPattern.ENTITIES_BY_FUND_GROUP, {
      fundGroupId,
      statuses: toStringArray(query.statuses),
      typesToExclude: toStringArray(query.typesToExclude),
    });
  }

  @ApiOperation({
    operationId: 'getAccounts',
    summary: 'Retrieve list of accounts',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [AccountDto] })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get('accounts')
  accounts(@Query() query: AccountsQueryDto) {
    return this.call<Account[]>(ReferenceDataPattern.ACCOUNTS_LIST, {
      sponsorId: query.sponsorId,
      fsGroupings: toStringArray(query.fsGroupings),
      capitalCategories: toStringArray(query.capitalCategories),
    });
  }

  @ApiOperation({
    operationId: 'getMappedAccount',
    summary: 'Get mapped account',
    description: 'The id is the accountKey of the source account.',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: AccountDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get('accounts/mapped/:id')
  mappedAccount(@Param('id') id: string) {
    return this.call<Account>(ReferenceDataPattern.ACCOUNTS_MAPPED, { id });
  }

  @ApiOperation({
    operationId: 'executeQuery',
    summary:
      'Execute query with id and arguments from request and obtain results',
    description:
      'Every query-string parameter is passed to the query as an argument.',
  })
  @ApiSessionIdHeader()
  @ApiQuery({
    name: 'arguments',
    required: false,
    style: 'form',
    explode: true,
    schema: { type: 'object', additionalProperties: { type: 'string' } },
    description: 'Arguments for query execution (any query-string keys)',
  })
  @ApiOkResponse({
    schema: { type: 'object', additionalProperties: { type: 'string' } },
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get('queries/:queryId/filters')
  executeQuery(
    @Param('queryId', ParseUUIDPipe) queryId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const args = Object.fromEntries(
      Object.entries(query).map(([key, value]) => [
        key,
        String(Array.isArray(value) ? value[value.length - 1] : value),
      ]),
    );
    return this.call<QueryResults>(ReferenceDataPattern.QUERIES_EXECUTE, {
      queryId,
      arguments: args,
    });
  }

  @ApiOperation({ operationId: 'getAllQueries', summary: 'Get all queries' })
  @ApiOkResponse({ type: [QueryDto] })
  @Get('queries')
  queries() {
    return this.call<QueryType[]>(ReferenceDataPattern.QUERIES_LIST);
  }

  @ApiOperation({
    operationId: 'getInvestments',
    summary: 'Retrieve list of investments',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [InvestmentDto] })
  @Get('investments')
  investments() {
    return this.call<Investment[]>(ReferenceDataPattern.INVESTMENTS_LIST);
  }

  @ApiOperation({
    operationId: 'getSponsors',
    summary: 'Retrieve list of sponsors',
  })
  @ApiOkResponse({ type: [SponsorDto] })
  @Get('sponsors')
  sponsors() {
    return this.call<Sponsor[]>(ReferenceDataPattern.SPONSORS_LIST);
  }

  @ApiOperation({
    operationId: 'getMgmtFeeJournalEntries',
    summary: 'Get management fee journal entries',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [JournalEntryDto] })
  @Get('journal-entries/mgmt-fee')
  mgmtFeeJournalEntries(@Query() query: MgmtFeeJournalQueryDto) {
    return this.call<JournalEntry[]>(
      ReferenceDataPattern.JOURNAL_ENTRIES_MGMT_FEE,
      {
        entityIds: toStringArray(query.entityIds),
        fsLineItems: toStringArray(query.fsLineItems),
        calledFlag: query.calledFlag || undefined,
      },
    );
  }

  @ApiOperation({
    operationId: 'getMgmtFeeGLLineItems',
    summary: 'Get management fee journal entry line items',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [JournalEntryDto] })
  @Get('journal-entries/mgmt-fee/line-items')
  mgmtFeeLineItems(@Query() query: MgmtFeeLineItemsQueryDto) {
    return this.call<JournalEntry[]>(
      ReferenceDataPattern.JOURNAL_ENTRIES_MGMT_FEE_LINE_ITEMS,
      {
        batchNo: Number(query.batchNo),
        entityId: query.entityId,
        state: query.state,
        calledFlag: query.calledFlag,
        fsLineItems: toStringArray(query.fsLineItems),
      },
    );
  }

  @ApiOperation({
    operationId: 'getTotalAmountJeForEntities',
    summary:
      'Get total amount journal entries by entityIds and allocationBasis',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [JournalEntryDto] })
  @Get('journal-entries/entities/total-amount')
  totalAmount(@Query() query: TotalAmountQueryDto) {
    return this.call<JournalEntry[]>(
      ReferenceDataPattern.JOURNAL_ENTRIES_TOTAL_AMOUNT,
      {
        entityIds: toStringArray(query.entityIds),
        allocationBasis: query.allocationBasis,
        toDate: query.toDate,
      },
    );
  }

  @ApiOperation({
    operationId: 'getJournalEntries',
    summary: 'Get journal entries by parameters',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [JournalEntryDto] })
  @Get('journal-entries')
  journalEntries(@Query() query: JournalEntriesQueryDto) {
    return this.call<JournalEntry[]>(
      ReferenceDataPattern.JOURNAL_ENTRIES_LIST,
      {
        batchNo: Number(query.batchNo),
        accountKey: query.accountKey,
        allocationBasis: query.allocationBasis,
        entityId: query.entityId,
      },
    );
  }

  @ApiOperation({
    operationId: 'getAllocationBases',
    summary: 'Retrieve list of AllocationBasis',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [AllocationBasisDto] })
  @Get('allocation-bases')
  allocationBases() {
    return this.call<AllocationBasis[]>(
      ReferenceDataPattern.ALLOCATION_BASES_LIST,
    );
  }

  @ApiOperation({
    operationId: 'getInvestorAttributes',
    summary: 'Get investor attributes',
    description:
      'Returns investor attributes for provided investorId and entityId',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: InvestorAttributeDto })
  @Get('investor-attributes')
  investorAttributes(@Query() query: InvestorAttributesQueryDto) {
    return this.call<InvestorAttribute>(
      ReferenceDataPattern.INVESTOR_ATTRIBUTES_GET,
      { investorId: query.investorId, entityId: query.entityId },
    );
  }
}
