import type { Sponsor as SponsorDto } from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { Sponsor } from './schemas/sponsor.schema';

@Injectable()
export class SponsorsService {
  constructor(
    @InjectModel(Sponsor.name) private readonly sponsorModel: Model<Sponsor>,
  ) {}

  async list(): Promise<SponsorDto[]> {
    return (await this.sponsorModel
      .find()
      .select('-_id -__v')
      .sort({ id: 1 })
      .lean()) as unknown as SponsorDto[];
  }

  async exists(id: string): Promise<boolean> {
    return (await this.sponsorModel.exists({ id })) !== null;
  }
}
