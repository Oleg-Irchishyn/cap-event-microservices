import { ReferenceDataPattern } from '@cap-event/contracts';
import type {
  InvestorAttribute,
  InvestorAttributesPayload,
} from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { InvestorAttributesService } from './investor-attributes.service';

@Controller()
export class InvestorAttributesController {
  constructor(private readonly attributes: InvestorAttributesService) {}

  @MessagePattern(ReferenceDataPattern.INVESTOR_ATTRIBUTES_GET)
  get(
    @Payload() payload: InvestorAttributesPayload,
  ): Promise<InvestorAttribute> {
    return this.attributes.get(payload);
  }
}
