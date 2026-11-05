import type {
  Account,
  AllocationInput,
  CapEvent,
  CapEventAggregatedLineItem,
  CapEventLineItem,
  FundGroupAllocationInput,
  InvestorEntry,
  JournalEntry,
  MgmtFeeAllocatePayload,
  MgmtFeeJournalEntry,
  MgmtFeeJournalEntriesByEntityPayload,
  MgmtFeeLineItemsPayload,
} from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';

import {
  resolveBasisId,
  RosterInvestor,
  rosterForEntity,
  weightsFor,
} from './investor-roster';
import { deterministicUuid } from '../common/utils/hash.util';
import { badRequest, notFound } from '../common/utils/rpc-error.util';
import { round2, splitByWeights } from '../common/utils/split.util';
import { ReferenceDataClient } from '../reference-data/reference-data.client';

interface EntryContext {
  seed: string;
  lineAmount: number;
  account?: Account;
  investment?: InvestorEntry['investment'];
}

const isYes = (value?: string): boolean =>
  /^(y|yes|true)$/i.test((value ?? '').trim());

/**
 * SIMULATION ONLY - a deterministic stand-in for the real allocation and
 * management-fee business rules. An amount is split across a deterministic
 * investor roster of the entity, proportionally to a per-basis weight
 * (commitment, unfunded, contributions, ...), cent-exact via largest remainder.
 */
@Injectable()
export class AllocationService {
  constructor(private readonly referenceData: ReferenceDataClient) {}

  allocateLineItem(input: AllocationInput): InvestorEntry[] {
    this.assertAmount(input.amount);
    const basisId = resolveBasisId(input.allocationBasisId);
    return this.allocate(input.entityId, basisId, input.amount, {
      seed: `${input.entityId}:${input.dueDate}:${input.accountNo}:${input.investmentId}:${basisId ?? 'equal'}`,
      lineAmount: input.amount,
      account: { accountNo: input.accountNo },
      investment: input.investmentId ? { id: input.investmentId } : undefined,
    });
  }

  /** Splits `amount` across the entities, proportionally to their investors' total weight. */
  allocateEntities(input: FundGroupAllocationInput): Record<string, number> {
    this.assertAmount(input.amount);
    const basisId = resolveBasisId(
      (input as { allocationBasisId?: string }).allocationBasisId,
      input.allocationBasis,
    );
    const entityIds = [
      ...new Set(input.entityAllocationInput.map((e) => e.entityId)),
    ];
    const weights = entityIds.map((id) =>
      weightsFor(basisId, rosterForEntity(id)).reduce((a, b) => a + b, 0),
    );
    const { rounded } = splitByWeights(input.amount, weights);
    return Object.fromEntries(entityIds.map((id, i) => [id, rounded[i]]));
  }

  /** Uncalled management-fee batches per requested entity (from reference-data-service). */
  async mgmtFeeJournalEntries({
    entityIds,
  }: MgmtFeeJournalEntriesByEntityPayload): Promise<
    Record<string, MgmtFeeJournalEntry[]>
  > {
    const entries = await this.referenceData.mgmtFeeJournalEntries({
      entityIds,
      calledFlag: 'N',
    });
    const result: Record<string, MgmtFeeJournalEntry[]> = Object.fromEntries(
      entityIds.map((id) => [id, [] as MgmtFeeJournalEntry[]]),
    );
    for (const entry of entries) {
      const entityId = entry.entity?.id;
      if (!entityId) continue;
      (result[entityId] ??= []).push({
        amount: entry.amount,
        batchDate: entry.batchDate,
        description: entry.description,
        batchNo: entry.batchNo,
      });
    }
    return result;
  }

  /** The GL lines of an uncalled batch, shaped as cap event line items. */
  async mgmtFeeLineItems({
    batchNo,
    entityId,
  }: MgmtFeeLineItemsPayload): Promise<CapEventLineItem[]> {
    const [entries, bases] = await Promise.all([
      this.referenceData.mgmtFeeLineItems({
        batchNo,
        entityId,
        state: 'POSTED',
        calledFlag: 'N',
      }),
      this.referenceData.allocationBases(),
    ]);
    const idByName = new Map(
      bases.map((b) => [b.allocationName?.toLowerCase(), b.allocationId]),
    );
    return entries.map((entry) => ({
      id: deterministicUuid(
        `mf:${entityId}:${batchNo}:${entry.account?.accountKey}`,
      ),
      account: entry.account ?? {},
      allocationBasis: entry.allocationBasis ?? '',
      allocationBasisId:
        idByName.get((entry.allocationBasis ?? '').toLowerCase()) ?? '',
      amount: entry.amount ?? 0,
      isMfLineItem: true,
      batchNo: entry.batchNo,
      originAccountKey: entry.account?.accountKey,
      prDate: entry.prDate ?? entry.batchDate ?? '',
      prFlag: isYes(entry.prFlag),
    }));
  }

  /** Allocates the amount of a seeded management-fee journal entry across investors. */
  async allocateMgmtFee(
    payload: MgmtFeeAllocatePayload,
  ): Promise<InvestorEntry[]> {
    const entries: JournalEntry[] = await this.referenceData.journalEntries({
      batchNo: payload.batchNo,
      accountKey: payload.accountKey,
      allocationBasis: payload.allocationBasis,
      entityId: payload.entityId,
    });
    if (entries.length === 0) {
      throw notFound(
        `No journal entry for batch ${payload.batchNo}, account ${payload.accountKey}, entity ${payload.entityId}`,
      );
    }
    const amount = round2(entries.reduce((s, e) => s + (e.amount ?? 0), 0));
    const basisId = resolveBasisId(
      payload.allocationBasisId,
      payload.allocationBasis,
    );
    return this.allocate(payload.entityId, basisId, amount, {
      seed: `mf:${payload.entityId}:${payload.batchNo}:${payload.accountKey}:${basisId ?? 'equal'}`,
      lineAmount: amount,
      account: entries[0].account,
      investment: entries[0].investment,
    }).map((entry) => ({
      ...entry,
      managementFee: entry.allocatedAmount,
    }));
  }

  /**
   * "Process" a cap event: per entity line item, allocate every line across
   * the entity's investors (detail entries) and add one aggregated entry per
   * investor with the totals - what the preview screen lists.
   */
  process(capEvent: CapEvent): CapEventAggregatedLineItem[] {
    return (capEvent.capEventEntityLineItems ?? [])
      .filter((item) => (item.capEventLineItems ?? []).length > 0)
      .map((item) => {
        const entityId = item.entity?.id ?? '';
        const roster = rosterForEntity(entityId);
        const details: InvestorEntry[] = [];
        const totals = roster.map(() => ({ rounded: 0, raw: 0, lines: 0 }));

        for (const line of item.capEventLineItems) {
          if (!Number.isFinite(line.amount)) {
            throw badRequest('Line item amount must be a finite number');
          }
          const basisId = resolveBasisId(
            line.allocationBasisId,
            line.allocationBasis,
          );
          const entries = this.allocate(entityId, basisId, line.amount, {
            seed: `${entityId}:${item.dueDate}:${line.account?.accountNo}:${line.investment?.id}:${line.allocationBasis}:${line.amount}`,
            lineAmount: line.amount,
            account: line.account,
            investment: line.investment ?? undefined,
          });
          entries.forEach((entry, i) => {
            details.push(entry);
            totals[i].rounded = round2(
              totals[i].rounded + (entry.allocatedAmount ?? 0),
            );
            totals[i].raw += entry.allocatedAmountNotRounded ?? 0;
            totals[i].lines += line.amount;
          });
        }

        const aggregated: InvestorEntry[] = roster.map((investor, i) => ({
          ...this.baseEntry(investor),
          id: deterministicUuid(
            `agg:${entityId}:${item.dueDate}:${investor.customerId}`,
          ),
          amount: totals[i].rounded,
          originalAmount: totals[i].rounded,
          allocatedAmount: totals[i].rounded,
          allocatedAmountNotRounded: Math.round(totals[i].raw * 1e6) / 1e6,
          hasZeroCtb: totals[i].rounded === 0,
          isAggregated: true,
          lineItemAmount: round2(totals[i].lines),
        }));

        return {
          id: deterministicUuid(`pli:${entityId}:${item.dueDate}`),
          entity: item.entity,
          dueDate: item.dueDate,
          plInvestorEntries: [...details, ...aggregated],
        };
      });
  }

  private allocate(
    entityId: string,
    basisId: string | undefined,
    amount: number,
    ctx: EntryContext,
  ): InvestorEntry[] {
    const roster = rosterForEntity(entityId);
    const { rounded, raw } = splitByWeights(
      amount,
      weightsFor(basisId, roster),
    );
    return roster.map((investor, i) => {
      const entry: InvestorEntry = {
        ...this.baseEntry(investor),
        id: deterministicUuid(`${ctx.seed}:${investor.customerId}`),
        amount: rounded[i],
        originalAmount: rounded[i],
        allocatedAmount: rounded[i],
        allocatedAmountNotRounded: raw[i],
        hasZeroCtb: rounded[i] === 0,
        isAggregated: false,
        lineItemAmount: ctx.lineAmount,
      };
      if (ctx.account) entry.account = ctx.account;
      if (ctx.investment) entry.investment = ctx.investment;
      return entry;
    });
  }

  private baseEntry(
    investor: RosterInvestor,
  ): Omit<InvestorEntry, 'isAggregated'> {
    return {
      optOut: false,
      readOnly: false,
      rounded: true,
      investor: investor.investor,
      classID: investor.classID,
      additionalInvestorType: investor.additionalInvestorType,
      customerId: investor.customerId,
      customerName: investor.customerName,
      department: investor.department,
      commitment: investor.commitment,
      investedCapital: investor.investedCapital,
      unfunded: investor.unfunded,
      managementFee: investor.managementFee,
      managementFeePercentage: investor.managementFeePercentage,
      isTransferEntry: false,
      trType: 1,
      investorToRound: false,
      location: investor.location,
      dataPoints: '',
    };
  }

  private assertAmount(amount: number): void {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw badRequest('amount must be a finite number');
    }
  }
}
