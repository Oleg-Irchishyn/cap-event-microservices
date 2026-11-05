import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { InvestorAttributesController } from './investor-attributes.controller';
import { InvestorAttributesService } from './investor-attributes.service';
import {
  InvestorAttribute,
  InvestorAttributeSchema,
} from './schemas/investor-attribute.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InvestorAttribute.name, schema: InvestorAttributeSchema },
    ]),
  ],
  controllers: [InvestorAttributesController],
  providers: [InvestorAttributesService],
  exports: [MongooseModule],
})
export class InvestorAttributesModule {}
