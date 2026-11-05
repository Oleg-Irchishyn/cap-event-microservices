import { ReferenceDataPattern } from '@cap-event/contracts';
import type {
  Query,
  QueriesExecutePayload,
  QueryResults,
} from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { QueriesService } from './queries.service';

@Controller()
export class QueriesController {
  constructor(private readonly queries: QueriesService) {}

  @MessagePattern(ReferenceDataPattern.QUERIES_LIST)
  list(): Promise<Query[]> {
    return this.queries.list();
  }

  @MessagePattern(ReferenceDataPattern.QUERIES_EXECUTE)
  execute(@Payload() payload: QueriesExecutePayload): Promise<QueryResults> {
    return this.queries.execute(payload);
  }
}
