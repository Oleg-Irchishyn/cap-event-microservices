import type {
  JournalEntriesListPayload,
  JournalEntry as JournalEntryDto,
  MgmtFeeJournalEntriesPayload,
  MgmtFeeJournalLineItemsPayload,
  TotalAmountJournalEntriesPayload,
} from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AllocationBasesService } from '../allocation-bases/allocation-bases.service';
import {
  JOURNAL_ENTRY_KIND,
  JournalEntry,
} from './schemas/journal-entry.schema';
import { rpcError } from '../common/utils/rpc-error.util';

const PUBLIC_FIELDS = '-_id -__v -key -kind -calledFlag -state -entityId';

/** Accepts Y/N, yes/no and true/false (any case). */
export const normalizeCalledFlag = (raw: string): 'Y' | 'N' => {
  if (/^(y|yes|true)$/i.test(raw)) return 'Y';
  if (/^(n|no|false)$/i.test(raw)) return 'N';
  throw rpcError(400, `calledFlag must be Y or N, got "${raw}"`);
};

@Injectable()
export class JournalEntriesService {
  constructor(
    @InjectModel(JournalEntry.name)
    private readonly entryModel: Model<JournalEntry>,
    private readonly bases: AllocationBasesService,
  ) {}

  /** One header entry per management-fee batch and entity. */
  async mgmtFee({
    entityIds,
    fsLineItems,
    calledFlag,
  }: MgmtFeeJournalEntriesPayload): Promise<JournalEntryDto[]> {
    const filter: Record<string, unknown> = { kind: JOURNAL_ENTRY_KIND.HEADER };
    if (entityIds?.length) filter.entityId = { $in: entityIds };
    if (calledFlag) filter.calledFlag = normalizeCalledFlag(calledFlag);
    if (fsLineItems?.length) {
      // Headers carry no account: keep the batches that have a matching GL line.
      const batchNos = await this.entryModel.distinct('batchNo', {
        kind: JOURNAL_ENTRY_KIND.LINE,
        'account.fsLineItem': { $in: fsLineItems },
      });
      filter.batchNo = { $in: batchNos };
    }
    return this.find(filter);
  }

  /** The GL lines of one batch. */
  async mgmtFeeLineItems({
    batchNo,
    entityId,
    state,
    calledFlag,
    fsLineItems,
  }: MgmtFeeJournalLineItemsPayload): Promise<JournalEntryDto[]> {
    const filter: Record<string, unknown> = {
      kind: JOURNAL_ENTRY_KIND.LINE,
      batchNo,
      entityId,
      state: new RegExp(`^${state.replace(/[^A-Za-z0-9_ -]/g, '')}$`, 'i'),
      calledFlag: normalizeCalledFlag(calledFlag),
    };
    if (fsLineItems?.length) {
      filter['account.fsLineItem'] = { $in: fsLineItems };
    }
    return this.find(filter);
  }

  /** The GL lines of a batch for one account and allocation basis (name or id). */
  async list({
    batchNo,
    accountKey,
    allocationBasis,
    entityId,
  }: JournalEntriesListPayload): Promise<JournalEntryDto[]> {
    return this.find({
      kind: JOURNAL_ENTRY_KIND.LINE,
      batchNo,
      entityId,
      'account.accountKey': accountKey,
      allocationBasis: { $in: await this.bases.namesFor(allocationBasis) },
    });
  }

  /**
   * Total management fee per entity up to and including `toDate` for the given
   * allocation basis: one aggregated entry per entity.
   */
  async totalAmount({
    entityIds,
    allocationBasis,
    toDate,
  }: TotalAmountJournalEntriesPayload): Promise<JournalEntryDto[]> {
    const headers = await this.entryModel
      .find({
        kind: JOURNAL_ENTRY_KIND.HEADER,
        entityId: { $in: entityIds },
        allocationBasis: { $in: await this.bases.namesFor(allocationBasis) },
        batchDate: { $lte: toDate },
      })
      .lean();
    const totals = new Map<string, JournalEntryDto>();
    for (const header of headers) {
      const current = totals.get(header.entityId);
      if (current) {
        current.amount = round2((current.amount ?? 0) + (header.amount ?? 0));
      } else {
        totals.set(header.entityId, {
          entity: header.entity,
          allocationBasis: header.allocationBasis,
          amount: header.amount,
          batchDate: toDate,
          allocationBasisDate: toDate,
          description: `Total management fee through ${toDate}`,
          trType: header.trType,
          exchangeRate: header.exchangeRate,
        });
      }
    }
    return [...totals.values()];
  }

  private async find(
    filter: Record<string, unknown>,
  ): Promise<JournalEntryDto[]> {
    return await this.entryModel
      .find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ batchNo: 1, key: 1 })
      .lean();
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
