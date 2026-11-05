import { ConfigService } from '@nestjs/config';

import { UsersSeedService } from '../users-seed.service';

describe('UsersSeedService', () => {
  const build = (env: Record<string, string>, exists: boolean) => {
    const users = {
      existsByEmail: jest.fn().mockResolvedValue(exists),
      register: jest.fn().mockResolvedValue({}),
    };
    const seed = new UsersSeedService(users as never, new ConfigService(env));
    return { users, seed };
  };

  it('does nothing without SEED_USER_EMAIL and SEED_USER_PASSWORD', async () => {
    const { users, seed } = build({ SEED_USER_EMAIL: 'a@b.co' }, false);
    await seed.onApplicationBootstrap();
    expect(users.register).not.toHaveBeenCalled();
  });

  it('creates the demo user when missing', async () => {
    const { users, seed } = build(
      { SEED_USER_EMAIL: 'demo@example.com', SEED_USER_PASSWORD: 'password1' },
      false,
    );
    await seed.onApplicationBootstrap();
    expect(users.register).toHaveBeenCalledWith({
      email: 'demo@example.com',
      password: 'password1',
      name: 'Demo User',
    });
  });

  it('is idempotent when the user already exists', async () => {
    const { users, seed } = build(
      { SEED_USER_EMAIL: 'demo@example.com', SEED_USER_PASSWORD: 'password1' },
      true,
    );
    await seed.onApplicationBootstrap();
    expect(users.register).not.toHaveBeenCalled();
  });
});
