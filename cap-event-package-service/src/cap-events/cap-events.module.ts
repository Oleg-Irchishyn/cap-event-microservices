import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CapEventsController } from './cap-events.controller';
import { CapEventsService } from './cap-events.service';
import { AllocationModule } from '../allocation/allocation.module';
import {
  CapEventRecord,
  CapEventRecordSchema,
} from './schemas/cap-event.schema';

@Module({
  imports: [
    AllocationModule,
    MongooseModule.forFeature([
      { name: CapEventRecord.name, schema: CapEventRecordSchema },
    ]),
  ],
  controllers: [CapEventsController],
  providers: [CapEventsService],
})
export class CapEventsModule {}
