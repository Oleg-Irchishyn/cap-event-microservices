import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { QueriesController } from './queries.controller';
import { QueriesService } from './queries.service';
import { Query, QuerySchema } from './schemas/query.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Query.name, schema: QuerySchema }]),
  ],
  controllers: [QueriesController],
  providers: [QueriesService],
  exports: [MongooseModule],
})
export class QueriesModule {}
