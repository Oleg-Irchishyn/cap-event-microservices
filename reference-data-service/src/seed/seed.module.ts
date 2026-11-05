import { Module } from '@nestjs/common';

import { SeedService } from './seed.service';
import { AccountsModule } from '../accounts/accounts.module';
import { AllocationBasesModule } from '../allocation-bases/allocation-bases.module';
import { EntitiesModule } from '../entities/entities.module';
import { FundGroupsModule } from '../fund-groups/fund-groups.module';
import { InvestmentsModule } from '../investments/investments.module';
import { InvestorAttributesModule } from '../investor-attributes/investor-attributes.module';
import { JournalEntriesModule } from '../journal-entries/journal-entries.module';
import { QueriesModule } from '../queries/queries.module';
import { SponsorsModule } from '../sponsors/sponsors.module';

@Module({
  imports: [
    SponsorsModule,
    FundGroupsModule,
    EntitiesModule,
    AccountsModule,
    QueriesModule,
    InvestmentsModule,
    AllocationBasesModule,
    JournalEntriesModule,
    InvestorAttributesModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
