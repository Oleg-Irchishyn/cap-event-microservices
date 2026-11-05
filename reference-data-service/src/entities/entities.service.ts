import type {
  Entity as EntityDto,
  EntitiesByFundGroupPayload,
} from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { notFound } from '../common/utils/rpc-error.util';
import { FundGroupsService } from '../fund-groups/fund-groups.service';
import { Entity } from './schemas/entity.schema';

@Injectable()
export class EntitiesService {
  constructor(
    @InjectModel(Entity.name) private readonly entityModel: Model<Entity>,
    private readonly fundGroups: FundGroupsService,
  ) {}

  async byFundGroup({
    fundGroupId,
    statuses,
    typesToExclude,
  }: EntitiesByFundGroupPayload): Promise<EntityDto[]> {
    if (!(await this.fundGroups.exists(fundGroupId))) {
      throw notFound(`Fund group ${fundGroupId} not found`);
    }
    const filter: Record<string, unknown> = { fundGroupId };
    if (statuses?.length) filter.status = { $in: statuses };
    if (typesToExclude?.length) filter.type = { $nin: typesToExclude };
    return await this.entityModel
      .find(filter)
      .select('-_id -__v -fundGroupId -status -type')
      .sort({ id: 1 })
      .lean();
  }
}
