import { CapEventPackagePattern } from '@cap-event/contracts';
import type { CapEventType } from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { CapEventTypesService } from './cap-event-types.service';

@Controller()
export class CapEventTypesController {
  constructor(private readonly types: CapEventTypesService) {}

  @MessagePattern(CapEventPackagePattern.TYPES)
  list(): CapEventType[] {
    return this.types.list();
  }
}
