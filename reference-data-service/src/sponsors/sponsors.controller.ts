import { ReferenceDataPattern } from '@cap-event/contracts';
import type { Sponsor } from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { SponsorsService } from './sponsors.service';

@Controller()
export class SponsorsController {
  constructor(private readonly sponsors: SponsorsService) {}

  @MessagePattern(ReferenceDataPattern.SPONSORS_LIST)
  list(): Promise<Sponsor[]> {
    return this.sponsors.list();
  }
}
