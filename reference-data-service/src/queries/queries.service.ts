import type {
  Query as QueryDto,
  QueriesExecutePayload,
  QueryResults,
} from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { Query } from './schemas/query.schema';
import { notFound } from '../common/utils/rpc-error.util';

@Injectable()
export class QueriesService {
  constructor(
    @InjectModel(Query.name) private readonly queryModel: Model<Query>,
  ) {}

  async list(): Promise<QueryDto[]> {
    return await this.queryModel
      .find()
      .select('-_id -__v -results')
      .sort({ name: 1 })
      .lean();
  }

  /**
   * Stand-in for query execution: returns the query's canned result map, with
   * the request arguments echoed on top (arguments win on key clashes).
   */
  async execute({
    queryId,
    arguments: args,
  }: QueriesExecutePayload): Promise<QueryResults> {
    const query = await this.queryModel.findOne({ id: queryId }).lean();
    if (!query) {
      throw notFound(`Query ${queryId} not found`);
    }
    return { ...query.results, ...(args ?? {}) };
  }
}
