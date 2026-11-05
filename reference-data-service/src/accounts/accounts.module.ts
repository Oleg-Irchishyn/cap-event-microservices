import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { SponsorsModule } from '../sponsors/sponsors.module';
import { Account, AccountSchema } from './schemas/account.schema';
import {
  MappedAccount,
  MappedAccountSchema,
} from './schemas/mapped-account.schema';

@Module({
  imports: [
    SponsorsModule,
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: MappedAccount.name, schema: MappedAccountSchema },
    ]),
  ],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [MongooseModule],
})
export class AccountsModule {}
