import { CapEventPackagePattern } from '@cap-event/contracts';
import type {
  CapEvent,
  CapEventAggregatedLineItem,
  CapEventLineItem,
  InvestorDocumentResult,
  InvestorEntry,
  MgmtFeeJournalEntry,
} from '@cap-event/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  StreamableFile,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import {
  ApiCommonErrors,
  ApiSessionIdHeader,
} from '../common/decorators/api-common-errors.decorator';
import { rpcCall, toStringArray } from '../common/utils/rpc-call.util';
import { ErrorResponseDto } from '../exceptions/dto/error-response.dto';
import { ErrorResponseFilter } from '../exceptions/error-response.filter';
import { JwtGuard } from '../guards/jwt.guard';
import {
  AllocationInputDto,
  CapEventListQueryDto,
  FundGroupAllocationInputDto,
  InvestorDocumentInputDto,
  MgmtFeeAllocateQueryDto,
  MgmtFeeJournalEntriesQueryDto,
  MgmtFeeLineItemsQueryDto,
} from './dto/allocation.dto';
import {
  CapEventAggregatedLineItemDto,
  CapEventDto,
  CapEventLineItemDto,
  CapEventTypeDto,
  InvestorEntryDto,
  MgmtFeeJournalEntryDto,
} from './dto/cap-event.dto';

export const CAP_EVENT_PACKAGE_SERVICE = 'CAP_EVENT_PACKAGE_SERVICE';
const LABEL = 'Cap event package service';
const FALLBACK_EMAIL = 'unknown@cap-event.local';

/**
 * Mirrors capEventPackage.json; the UI reaches it at
 * `${HOSTNAME}/api/v1/cap-event-package/cap-events/...`. The `Session-Id`
 * header is accepted and ignored. Static routes are declared before `:id`.
 */
@ApiTags('Cap event package')
@ApiExtraModels(MgmtFeeJournalEntryDto)
@ApiBearerAuth('bearerAuth')
@ApiCommonErrors()
@UseGuards(JwtGuard)
@UseFilters(ErrorResponseFilter)
@Controller('api/v1/cap-event-package/cap-events')
export class CapEventPackageController {
  constructor(
    @Inject(CAP_EVENT_PACKAGE_SERVICE) private readonly client: ClientProxy,
  ) {}

  private call<T>(pattern: string, payload: unknown = {}): Promise<T> {
    return rpcCall<T>(this.client, pattern, payload, LABEL);
  }

  private user(req: Request) {
    return { email: req.user?.email ?? FALLBACK_EMAIL };
  }

  @ApiOperation({
    operationId: 'getCapEventTypes',
    summary: 'Retrieve list of capital event types',
  })
  @ApiOkResponse({ type: [CapEventTypeDto] })
  @Get('types')
  types() {
    return this.call(CapEventPackagePattern.TYPES);
  }

  @ApiOperation({
    operationId: 'getMgmtFeeLineItems',
    summary:
      'Retrieve list of CELIs represents uncalled management fee entries',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [CapEventLineItemDto] })
  @Get('line-items/mgmt-fees')
  mgmtFeeLineItems(@Query() query: MgmtFeeLineItemsQueryDto) {
    return this.call<CapEventLineItem[]>(
      CapEventPackagePattern.MGMT_FEE_LINE_ITEMS,
      { batchNo: Number(query.batchNo), entityId: query.entityId },
    );
  }

  @ApiOperation({
    operationId: 'getMgmtFeeJournalEntries',
    summary: 'Retrieve management fee journal entries for entities',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({
    description: 'Map of entity ID to its uncalled management fee batches',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'array',
        items: { $ref: '#/components/schemas/MgmtFeeJournalEntryDto' },
      },
    },
  })
  @Get('journal-entries/mgmt-fee')
  mgmtFeeJournalEntries(@Query() query: MgmtFeeJournalEntriesQueryDto) {
    return this.call<Record<string, MgmtFeeJournalEntry[]>>(
      CapEventPackagePattern.MGMT_FEE_JOURNAL_ENTRIES,
      { entityIds: toStringArray(query.entityIds) },
    );
  }

  @ApiOperation({
    operationId: 'getAllocatedMgmtFeeJournalEntries',
    summary: 'Retrieve allocated journal entry',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [InvestorEntryDto] })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get('journal-entries/mgmt-fee/allocate')
  allocatedMgmtFee(@Query() query: MgmtFeeAllocateQueryDto) {
    return this.call<InvestorEntry[]>(
      CapEventPackagePattern.MGMT_FEE_ALLOCATE,
      {
        batchNo: Number(query.batchNo),
        accountKey: query.accountKey,
        allocationBasis: query.allocationBasis,
        allocationBasisId: query.allocationBasisId,
        entityId: query.entityId,
      },
    );
  }

  @ApiOperation({
    operationId: 'getCapEventList',
    summary:
      'Retrieve Capital event list with optional filters: Sponsor ID and Status list',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [CapEventDto] })
  @Get()
  list(@Query() query: CapEventListQueryDto) {
    return this.call<CapEvent[]>(CapEventPackagePattern.LIST, {
      sponsorId: query.sponsorId || undefined,
      statuses: toStringArray(query.statuses),
    });
  }

  @ApiOperation({
    operationId: 'submit',
    summary: 'Submits capital event',
    description:
      'Creates a SUBMITTED cap event, or submits the DRAFT with the same id.',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: CapEventDto })
  @HttpCode(200)
  @Post()
  submit(@Body() capEvent: CapEventDto, @Req() req: Request) {
    return this.call<CapEvent>(CapEventPackagePattern.SUBMIT, {
      capEvent,
      user: this.user(req),
    });
  }

  @ApiOperation({
    operationId: 'createDraft',
    summary: 'Creates capital event as draft',
  })
  @ApiOkResponse({ type: CapEventDto })
  @HttpCode(200)
  @Post('draft')
  createDraft(@Body() capEvent: CapEventDto, @Req() req: Request) {
    return this.call<CapEvent>(CapEventPackagePattern.CREATE_DRAFT, {
      capEvent,
      user: this.user(req),
    });
  }

  @ApiOperation({
    operationId: 'process',
    summary: 'Process capital event',
    description:
      'Simulation: allocates every entity line item across a deterministic investor roster.',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [CapEventAggregatedLineItemDto] })
  @HttpCode(200)
  @Post('process')
  process(@Body() capEvent: CapEventDto) {
    return this.call<CapEventAggregatedLineItem[]>(
      CapEventPackagePattern.PROCESS,
      { capEvent },
    );
  }

  @ApiOperation({
    operationId: 'allocateLineItem',
    summary: 'Allocate investors for cap event line item',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: [InvestorEntryDto] })
  @HttpCode(200)
  @Post('line-items/allocate')
  allocateLineItem(@Body() input: AllocationInputDto) {
    return this.call<InvestorEntry[]>(
      CapEventPackagePattern.LINE_ITEM_ALLOCATE,
      input,
    );
  }

  @ApiOperation({
    operationId: 'allocateEntities',
    summary: 'Allocate entities for fund group data',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({
    description: 'Map of entity IDs to allocated amounts',
    schema: { type: 'object', additionalProperties: { type: 'number' } },
  })
  @HttpCode(200)
  @Post('fund-group/allocate')
  allocateEntities(@Body() input: FundGroupAllocationInputDto) {
    return this.call<Record<string, number>>(
      CapEventPackagePattern.FUND_GROUP_ALLOCATE,
      input,
    );
  }

  @ApiOperation({
    operationId: 'investorDocumentContent',
    summary: 'Generate document content for Investor',
    description:
      'Request line item should contain plInvestorEntries related to only one Investor. Returns a placeholder PDF.',
  })
  @ApiSessionIdHeader()
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({
    description: 'Binary data of generated investor document',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiBody({ type: InvestorDocumentInputDto })
  @HttpCode(200)
  @Post('investors/document')
  async investorDocument(
    @Body() input: InvestorDocumentInputDto,
  ): Promise<StreamableFile> {
    const result = await this.call<InvestorDocumentResult>(
      CapEventPackagePattern.INVESTOR_DOCUMENT,
      input,
    );
    return new StreamableFile(Buffer.from(result.contentBase64, 'base64'), {
      type: result.contentType,
      disposition: 'attachment; filename="investor-notice.pdf"',
    });
  }

  @ApiOperation({
    operationId: 'getCapEventById',
    summary: 'Get capital event by ID',
  })
  @ApiSessionIdHeader()
  @ApiOkResponse({ type: CapEventDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.call<CapEvent>(CapEventPackagePattern.GET, { id });
  }

  @ApiOperation({
    operationId: 'deleteCapEvent',
    summary: 'Delete capital event and related files by ID',
    description: 'Only DRAFT cap events can be deleted.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @HttpCode(204)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.call<void>(CapEventPackagePattern.DELETE, { id });
  }

  @ApiOperation({
    operationId: 'update',
    summary: 'Update capital event in status draft',
  })
  @ApiOkResponse({ type: CapEventDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @HttpCode(200)
  @Post(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() capEvent: CapEventDto,
    @Req() req: Request,
  ) {
    return this.call<CapEvent>(CapEventPackagePattern.UPDATE, {
      id,
      capEvent,
      user: this.user(req),
    });
  }
}
