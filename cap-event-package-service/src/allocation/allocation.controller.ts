import { CapEventPackagePattern } from '@cap-event/contracts';
import type {
  AllocationInput,
  CapEventLineItem,
  FundGroupAllocationInput,
  InvestorEntry,
  MgmtFeeAllocatePayload,
  MgmtFeeJournalEntriesByEntityPayload,
  MgmtFeeJournalEntry,
  MgmtFeeLineItemsPayload,
} from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { AllocationService } from './allocation.service';

@Controller()
export class AllocationController {
  constructor(private readonly allocation: AllocationService) {}

  @MessagePattern(CapEventPackagePattern.LINE_ITEM_ALLOCATE)
  allocateLineItem(@Payload() input: AllocationInput): InvestorEntry[] {
    return this.allocation.allocateLineItem(input);
  }

  @MessagePattern(CapEventPackagePattern.FUND_GROUP_ALLOCATE)
  allocateEntities(
    @Payload() input: FundGroupAllocationInput,
  ): Record<string, number> {
    return this.allocation.allocateEntities(input);
  }

  @MessagePattern(CapEventPackagePattern.MGMT_FEE_JOURNAL_ENTRIES)
  mgmtFeeJournalEntries(
    @Payload() payload: MgmtFeeJournalEntriesByEntityPayload,
  ): Promise<Record<string, MgmtFeeJournalEntry[]>> {
    return this.allocation.mgmtFeeJournalEntries(payload);
  }

  @MessagePattern(CapEventPackagePattern.MGMT_FEE_LINE_ITEMS)
  mgmtFeeLineItems(
    @Payload() payload: MgmtFeeLineItemsPayload,
  ): Promise<CapEventLineItem[]> {
    return this.allocation.mgmtFeeLineItems(payload);
  }

  @MessagePattern(CapEventPackagePattern.MGMT_FEE_ALLOCATE)
  allocateMgmtFee(
    @Payload() payload: MgmtFeeAllocatePayload,
  ): Promise<InvestorEntry[]> {
    return this.allocation.allocateMgmtFee(payload);
  }
}
