import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from './accounts/accounts.module';
import { AllocationBasesModule } from './allocation-bases/allocation-bases.module';
import { validateEnv } from './config/env.validation';
import { EntitiesModule } from './entities/entities.module';
import { FundGroupsModule } from './fund-groups/fund-groups.module';
import { InvestmentsModule } from './investments/investments.module';
import { InvestorAttributesModule } from './investor-attributes/investor-attributes.module';
import { JournalEntriesModule } from './journal-entries/journal-entries.module';
import { QueriesModule } from './queries/queries.module';
import { SeedModule } from './seed/seed.module';
import { SponsorsModule } from './sponsors/sponsors.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
      }),
    }),
    SponsorsModule,
    FundGroupsModule,
    EntitiesModule,
    AccountsModule,
    QueriesModule,
    InvestmentsModule,
    AllocationBasesModule,
    JournalEntriesModule,
    InvestorAttributesModule,
    SeedModule,
  ],
})
export class AppModule {}
