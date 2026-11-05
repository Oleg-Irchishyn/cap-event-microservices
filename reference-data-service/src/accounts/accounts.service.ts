import type {
  Account as AccountDto,
  AccountsListPayload,
  AccountsMappedPayload,
} from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { notFound } from '../common/utils/rpc-error.util';
import { SponsorsService } from '../sponsors/sponsors.service';
import { Account } from './schemas/account.schema';
import { MappedAccount } from './schemas/mapped-account.schema';

const PUBLIC_FIELDS = '-_id -__v -sponsorId -fsGrouping';

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(Account.name) private readonly accountModel: Model<Account>,
    @InjectModel(MappedAccount.name)
    private readonly mappedModel: Model<MappedAccount>,
    private readonly sponsors: SponsorsService,
  ) {}

  /** `fsGroupings` are included, `capitalCategories` are EXCLUDED (as the spec describes). */
  async list({
    sponsorId,
    fsGroupings,
    capitalCategories,
  }: AccountsListPayload): Promise<AccountDto[]> {
    if (!(await this.sponsors.exists(sponsorId))) {
      throw notFound(`Sponsor ${sponsorId} not found`);
    }
    const filter: Record<string, unknown> = { sponsorId };
    if (fsGroupings?.length) filter.fsGrouping = { $in: fsGroupings };
    if (capitalCategories?.length) {
      filter.capitalCategory = { $nin: capitalCategories };
    }
    return await this.accountModel
      .find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ accountNo: 1 })
      .lean();
  }

  /** `id` is the source account's accountKey. */
  async mapped({ id }: AccountsMappedPayload): Promise<AccountDto> {
    const mapping = await this.mappedModel
      .findOne({ sourceAccountKey: id })
      .lean();
    const account = mapping
      ? await this.accountModel
          .findOne({ accountKey: mapping.mappedAccountKey })
          .select(PUBLIC_FIELDS)
          .lean()
      : null;
    if (!account) {
      throw notFound(`No mapped account for ${id}`);
    }
    return account;
  }
}
