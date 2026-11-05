import { CapEventPackagePattern } from '@cap-event/contracts';
import type {
  CapEvent,
  CapEventAggregatedLineItem,
  CapEventIdPayload,
  CapEventListPayload,
  CapEventProcessPayload,
  CapEventUpdatePayload,
  CapEventWritePayload,
} from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { CapEventsService } from './cap-events.service';

@Controller()
export class CapEventsController {
  constructor(private readonly capEvents: CapEventsService) {}

  @MessagePattern(CapEventPackagePattern.LIST)
  list(@Payload() payload: CapEventListPayload): Promise<CapEvent[]> {
    return this.capEvents.list(payload ?? {});
  }

  @MessagePattern(CapEventPackagePattern.GET)
  get(@Payload() { id }: CapEventIdPayload): Promise<CapEvent> {
    return this.capEvents.get(id);
  }

  @MessagePattern(CapEventPackagePattern.CREATE_DRAFT)
  createDraft(@Payload() payload: CapEventWritePayload): Promise<CapEvent> {
    return this.capEvents.createDraft(payload);
  }

  @MessagePattern(CapEventPackagePattern.UPDATE)
  update(@Payload() payload: CapEventUpdatePayload): Promise<CapEvent> {
    return this.capEvents.update(payload);
  }

  @MessagePattern(CapEventPackagePattern.SUBMIT)
  submit(@Payload() payload: CapEventWritePayload): Promise<CapEvent> {
    return this.capEvents.submit(payload);
  }

  @MessagePattern(CapEventPackagePattern.DELETE)
  delete(@Payload() { id }: CapEventIdPayload): Promise<CapEventIdPayload> {
    return this.capEvents.delete(id);
  }

  @MessagePattern(CapEventPackagePattern.PROCESS)
  process(
    @Payload() { capEvent }: CapEventProcessPayload,
  ): CapEventAggregatedLineItem[] {
    return this.capEvents.process(capEvent);
  }
}
