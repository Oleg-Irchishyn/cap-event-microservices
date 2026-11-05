import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { JournalEntriesController } from './journal-entries.controller';
import { JournalEntriesService } from './journal-entries.service';
import { AllocationBasesModule } from '../allocation-bases/allocation-bases.module';
import {
  JournalEntry,
  JournalEntrySchema,
} from './schemas/journal-entry.schema';

@Module({
  imports: [
    AllocationBasesModule,
    MongooseModule.forFeature([
      { name: JournalEntry.name, schema: JournalEntrySchema },
    ]),
  ],
  controllers: [JournalEntriesController],
  providers: [JournalEntriesService],
  exports: [MongooseModule],
})
export class JournalEntriesModule {}
