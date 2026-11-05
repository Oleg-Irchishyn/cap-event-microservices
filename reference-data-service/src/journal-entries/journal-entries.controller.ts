import { ReferenceDataPattern } from '@cap-event/contracts';
import type {
  JournalEntriesListPayload,
  JournalEntry,
  MgmtFeeJournalEntriesPayload,
  MgmtFeeJournalLineItemsPayload,
  TotalAmountJournalEntriesPayload,
} from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { JournalEntriesService } from './journal-entries.service';

@Controller()
export class JournalEntriesController {
  constructor(private readonly entries: JournalEntriesService) {}

  @MessagePattern(ReferenceDataPattern.JOURNAL_ENTRIES_MGMT_FEE)
  mgmtFee(
    @Payload() payload: MgmtFeeJournalEntriesPayload,
  ): Promise<JournalEntry[]> {
    return this.entries.mgmtFee(payload ?? {});
  }

  @MessagePattern(ReferenceDataPattern.JOURNAL_ENTRIES_MGMT_FEE_LINE_ITEMS)
  mgmtFeeLineItems(
    @Payload() payload: MgmtFeeJournalLineItemsPayload,
  ): Promise<JournalEntry[]> {
    return this.entries.mgmtFeeLineItems(payload);
  }

  @MessagePattern(ReferenceDataPattern.JOURNAL_ENTRIES_TOTAL_AMOUNT)
  totalAmount(
    @Payload() payload: TotalAmountJournalEntriesPayload,
  ): Promise<JournalEntry[]> {
    return this.entries.totalAmount(payload);
  }

  @MessagePattern(ReferenceDataPattern.JOURNAL_ENTRIES_LIST)
  list(@Payload() payload: JournalEntriesListPayload): Promise<JournalEntry[]> {
    return this.entries.list(payload);
  }
}
