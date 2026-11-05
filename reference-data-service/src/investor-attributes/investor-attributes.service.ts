import type {
  InvestorAttribute as InvestorAttributeDto,
  InvestorAttributesPayload,
} from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { InvestorAttribute } from './schemas/investor-attribute.schema';

@Injectable()
export class InvestorAttributesService {
  constructor(
    @InjectModel(InvestorAttribute.name)
    private readonly attributeModel: Model<InvestorAttribute>,
  ) {}

  /** Unknown investor/entity pairs yield an empty object (the spec defines no 404). */
  async get({
    investorId,
    entityId,
  }: InvestorAttributesPayload): Promise<InvestorAttributeDto> {
    const found = await this.attributeModel
      .findOne({ investorId, entityId })
      .select('-_id secondaryInvestorId')
      .lean();
    return found ?? {};
  }
}
