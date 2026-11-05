import { Module } from '@nestjs/common';

import { CapEventTypesController } from './cap-event-types.controller';
import { CapEventTypesService } from './cap-event-types.service';

@Module({
  controllers: [CapEventTypesController],
  providers: [CapEventTypesService],
})
export class CapEventTypesModule {}
