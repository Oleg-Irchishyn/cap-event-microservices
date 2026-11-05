import type {
  AllocationBasis,
  JournalEntriesListPayload,
  JournalEntry,
  MgmtFeeJournalEntriesPayload,
  MgmtFeeJournalLineItemsPayload,
} from '@cap-event/contracts';
import { ReferenceDataPattern } from '@cap-event/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { rpcError } from '../common/utils/rpc-error.util';

export const REFERENCE_DATA_SERVICE = 'REFERENCE_DATA_SERVICE';

/** Thin typed wrapper over the TCP client of reference-data-service. */
@Injectable()
export class ReferenceDataClient {
  constructor(
    @Inject(REFERENCE_DATA_SERVICE) private readonly client: ClientProxy,
  ) {}

  mgmtFeeJournalEntries(
    payload: MgmtFeeJournalEntriesPayload,
  ): Promise<JournalEntry[]> {
    return this.send(ReferenceDataPattern.JOURNAL_ENTRIES_MGMT_FEE, payload);
  }

  mgmtFeeLineItems(
    payload: MgmtFeeJournalLineItemsPayload,
  ): Promise<JournalEntry[]> {
    return this.send(
      ReferenceDataPattern.JOURNAL_ENTRIES_MGMT_FEE_LINE_ITEMS,
      payload,
    );
  }

  journalEntries(payload: JournalEntriesListPayload): Promise<JournalEntry[]> {
    return this.send(ReferenceDataPattern.JOURNAL_ENTRIES_LIST, payload);
  }

  allocationBases(): Promise<AllocationBasis[]> {
    return this.send(ReferenceDataPattern.ALLOCATION_BASES_LIST, {});
  }

  /** RPC errors of reference-data-service pass through; connection problems become a 503. */
  private async send<T>(pattern: string, payload: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.client.send<T>(pattern, payload));
    } catch (error) {
      const shape = error as { status?: unknown; message?: unknown };
      if (
        typeof shape?.status === 'number' &&
        typeof shape.message === 'string'
      ) {
        throw rpcError(shape.status, shape.message);
      }
      throw rpcError(503, 'reference-data-service unavailable');
    }
  }
}
