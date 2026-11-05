import { ReferenceDataPattern } from '@cap-event/contracts';
import type { Entity, EntitiesByFundGroupPayload } from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { EntitiesService } from './entities.service';

@Controller()
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @MessagePattern(ReferenceDataPattern.ENTITIES_BY_FUND_GROUP)
  byFundGroup(
    @Payload() payload: EntitiesByFundGroupPayload,
  ): Promise<Entity[]> {
    return this.entities.byFundGroup(payload);
  }
}
