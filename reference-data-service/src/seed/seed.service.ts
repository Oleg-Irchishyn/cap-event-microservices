import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { buildSeedData } from './seed-data';
import { Account } from '../accounts/schemas/account.schema';
import { MappedAccount } from '../accounts/schemas/mapped-account.schema';
import { AllocationBasis } from '../allocation-bases/schemas/allocation-basis.schema';
import { Entity } from '../entities/schemas/entity.schema';
import { FundGroup } from '../fund-groups/schemas/fund-group.schema';
import { Investment } from '../investments/schemas/investment.schema';
import { InvestorAttribute } from '../investor-attributes/schemas/investor-attribute.schema';
import { JournalEntry } from '../journal-entries/schemas/journal-entry.schema';
import { Query } from '../queries/schemas/query.schema';
import { Sponsor } from '../sponsors/schemas/sponsor.schema';

/**
 * Upserts the demo data on every startup. Each document is replaced by its
 * natural key, so running this any number of times yields the same database.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(Sponsor.name) private readonly sponsors: Model<Sponsor>,
    @InjectModel(FundGroup.name) private readonly fundGroups: Model<FundGroup>,
    @InjectModel(Entity.name) private readonly entities: Model<Entity>,
    @InjectModel(Account.name) private readonly accounts: Model<Account>,
    @InjectModel(MappedAccount.name)
    private readonly mappedAccounts: Model<MappedAccount>,
    @InjectModel(Query.name) private readonly queries: Model<Query>,
    @InjectModel(Investment.name)
    private readonly investments: Model<Investment>,
    @InjectModel(AllocationBasis.name)
    private readonly allocationBases: Model<AllocationBasis>,
    @InjectModel(JournalEntry.name)
    private readonly journalEntries: Model<JournalEntry>,
    @InjectModel(InvestorAttribute.name)
    private readonly investorAttributes: Model<InvestorAttribute>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    const data = buildSeedData();
    await Promise.all([
      this.upsert(this.sponsors, data.sponsors, (d) => ({ id: d.id })),
      this.upsert(this.fundGroups, data.fundGroups, (d) => ({ id: d.id })),
      this.upsert(this.entities, data.entities, (d) => ({ id: d.id })),
      this.upsert(this.accounts, data.accounts, (d) => ({
        accountKey: d.accountKey,
      })),
      this.upsert(this.mappedAccounts, data.mappedAccounts, (d) => ({
        sourceAccountKey: d.sourceAccountKey,
      })),
      this.upsert(this.queries, data.queries, (d) => ({ id: d.id })),
      this.upsert(this.investments, data.investments, (d) => ({ id: d.id })),
      this.upsert(this.allocationBases, data.allocationBases, (d) => ({
        allocationId: d.allocationId,
      })),
      this.upsert(this.journalEntries, data.journalEntries, (d) => ({
        key: d.key,
      })),
      this.upsert(this.investorAttributes, data.investorAttributes, (d) => ({
        investorId: d.investorId,
        entityId: d.entityId,
      })),
    ]);
    this.logger.log(
      `Seeded reference data: ${data.sponsors.length} sponsors, ${data.fundGroups.length} fund groups, ` +
        `${data.entities.length} entities, ${data.accounts.length} accounts, ` +
        `${data.journalEntries.length} journal entries`,
    );
  }

  private async upsert<T extends object>(
    model: Model<any>,
    docs: T[],
    keyOf: (doc: T) => Record<string, unknown>,
  ): Promise<void> {
    if (docs.length === 0) return;
    await model.bulkWrite(
      docs.map((doc) => ({
        replaceOne: { filter: keyOf(doc), replacement: doc, upsert: true },
      })),
    );
  }
}
