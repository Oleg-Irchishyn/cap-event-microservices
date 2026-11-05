import type {
  FundGroup as FundGroupDto,
  FundGroupsSearchPayload,
} from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { notFound } from '../common/utils/rpc-error.util';
import { SponsorsService } from '../sponsors/sponsors.service';
import { FundGroup } from './schemas/fund-group.schema';

@Injectable()
export class FundGroupsService {
  constructor(
    @InjectModel(FundGroup.name)
    private readonly fundGroupModel: Model<FundGroup>,
    private readonly sponsors: SponsorsService,
  ) {}

  /**
   * Without `sponsorId` (the spec resolves it from the Session-Id header,
   * which this stand-in ignores) every fund group is returned.
   */
  async search({
    sponsorId,
  }: FundGroupsSearchPayload): Promise<FundGroupDto[]> {
    if (sponsorId && !(await this.sponsors.exists(sponsorId))) {
      throw notFound(`Sponsor ${sponsorId} not found`);
    }
    return await this.fundGroupModel
      .find(sponsorId ? { sponsorId } : {})
      .select('-_id -__v -sponsorId')
      .sort({ id: 1 })
      .lean();
  }

  async exists(id: string): Promise<boolean> {
    return (await this.fundGroupModel.exists({ id })) !== null;
  }
}
