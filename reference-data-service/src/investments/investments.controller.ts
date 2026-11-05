import { ReferenceDataPattern } from '@cap-event/contracts';
import type { Investment } from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { InvestmentsService } from './investments.service';

@Controller()
export class InvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}

  @MessagePattern(ReferenceDataPattern.INVESTMENTS_LIST)
  list(): Promise<Investment[]> {
    return this.investments.list();
  }
}
