import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthorizationCodeModule } from '../authorization-code/authorization-code.module';
import { TokensModule } from '../tokens/tokens.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule, TokensModule, AuthorizationCodeModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
