import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';
import { FundGroupsModule } from '../fund-groups/fund-groups.module';
import { Entity, EntitySchema } from './schemas/entity.schema';

@Module({
  imports: [
    FundGroupsModule,
    MongooseModule.forFeature([{ name: Entity.name, schema: EntitySchema }]),
  ],
  controllers: [EntitiesController],
  providers: [EntitiesService],
  exports: [MongooseModule],
})
export class EntitiesModule {}
