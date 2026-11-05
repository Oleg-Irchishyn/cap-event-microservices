import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthorizationCodeService } from './authorization-code.service';
import {
  AuthorizationCode,
  AuthorizationCodeSchema,
} from './schemas/authorization-code.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuthorizationCode.name, schema: AuthorizationCodeSchema },
    ]),
  ],
  providers: [AuthorizationCodeService],
  exports: [AuthorizationCodeService],
})
export class AuthorizationCodeModule {}
