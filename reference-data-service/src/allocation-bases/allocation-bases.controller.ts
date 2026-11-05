import { ReferenceDataPattern } from '@cap-event/contracts';
import type { AllocationBasis } from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { AllocationBasesService } from './allocation-bases.service';

@Controller()
export class AllocationBasesController {
  constructor(private readonly bases: AllocationBasesService) {}

  @MessagePattern(ReferenceDataPattern.ALLOCATION_BASES_LIST)
  list(): Promise<AllocationBasis[]> {
    return this.bases.list();
  }
}
