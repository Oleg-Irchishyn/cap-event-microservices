import type { Investment as InvestmentDto } from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { Investment } from './schemas/investment.schema';

@Injectable()
export class InvestmentsService {
  constructor(
    @InjectModel(Investment.name)
    private readonly investmentModel: Model<Investment>,
  ) {}

  async list(): Promise<InvestmentDto[]> {
    return await this.investmentModel
      .find()
      .select('-_id -__v')
      .sort({ id: 1 })
      .lean();
  }
}
