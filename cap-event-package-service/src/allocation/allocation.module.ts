import { Module } from '@nestjs/common';

import { AllocationController } from './allocation.controller';
import { AllocationService } from './allocation.service';
import { ReferenceDataModule } from '../reference-data/reference-data.module';

@Module({
  imports: [ReferenceDataModule],
  controllers: [AllocationController],
  providers: [AllocationService],
  exports: [AllocationService],
})
export class AllocationModule {}
