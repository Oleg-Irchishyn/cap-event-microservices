import { ReferenceDataPattern } from '@cap-event/contracts';
import type { FundGroup, FundGroupsSearchPayload } from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { FundGroupsService } from './fund-groups.service';

@Controller()
export class FundGroupsController {
  constructor(private readonly fundGroups: FundGroupsService) {}

  @MessagePattern(ReferenceDataPattern.FUND_GROUPS_SEARCH)
  search(@Payload() payload: FundGroupsSearchPayload): Promise<FundGroup[]> {
    return this.fundGroups.search(payload ?? {});
  }
}
