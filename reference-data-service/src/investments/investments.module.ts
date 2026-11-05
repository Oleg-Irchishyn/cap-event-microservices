import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';
import { Investment, InvestmentSchema } from './schemas/investment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Investment.name, schema: InvestmentSchema },
    ]),
  ],
  controllers: [InvestmentsController],
  providers: [InvestmentsService],
  exports: [MongooseModule],
})
export class InvestmentsModule {}
