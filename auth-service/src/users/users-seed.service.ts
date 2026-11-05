import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UsersService } from './users.service';

/** Creates the demo user on startup when SEED_USER_EMAIL/SEED_USER_PASSWORD are set. Idempotent. */
@Injectable()
export class UsersSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersSeedService.name);

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('SEED_USER_EMAIL');
    const password = this.config.get<string>('SEED_USER_PASSWORD');
    if (!email || !password) {
      return;
    }
    if (await this.users.existsByEmail(email)) {
      this.logger.log(`Seed user ${email} already exists`);
      return;
    }
    await this.users.register({
      email,
      password,
      name: this.config.get<string>('SEED_USER_NAME') || 'Demo User',
    });
    this.logger.log(`Seeded demo user ${email}`);
  }
}
