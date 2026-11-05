import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FundGroupsController } from './fund-groups.controller';
import { FundGroupsService } from './fund-groups.service';
import { SponsorsModule } from '../sponsors/sponsors.module';
import { FundGroup, FundGroupSchema } from './schemas/fund-group.schema';

@Module({
  imports: [
    SponsorsModule,
    MongooseModule.forFeature([
      { name: FundGroup.name, schema: FundGroupSchema },
    ]),
  ],
  controllers: [FundGroupsController],
  providers: [FundGroupsService],
  exports: [FundGroupsService, MongooseModule],
})
export class FundGroupsModule {}
