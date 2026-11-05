import { ReferenceDataPattern } from '@cap-event/contracts';
import type {
  Account,
  AccountsListPayload,
  AccountsMappedPayload,
} from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { AccountsService } from './accounts.service';

@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @MessagePattern(ReferenceDataPattern.ACCOUNTS_LIST)
  list(@Payload() payload: AccountsListPayload): Promise<Account[]> {
    return this.accounts.list(payload);
  }

  @MessagePattern(ReferenceDataPattern.ACCOUNTS_MAPPED)
  mapped(@Payload() payload: AccountsMappedPayload): Promise<Account> {
    return this.accounts.mapped(payload);
  }
}
