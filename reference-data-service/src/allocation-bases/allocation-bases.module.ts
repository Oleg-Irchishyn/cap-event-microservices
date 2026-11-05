import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AllocationBasesController } from './allocation-bases.controller';
import { AllocationBasesService } from './allocation-bases.service';
import {
  AllocationBasis,
  AllocationBasisSchema,
} from './schemas/allocation-basis.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AllocationBasis.name, schema: AllocationBasisSchema },
    ]),
  ],
  controllers: [AllocationBasesController],
  providers: [AllocationBasesService],
  exports: [AllocationBasesService, MongooseModule],
})
export class AllocationBasesModule {}
