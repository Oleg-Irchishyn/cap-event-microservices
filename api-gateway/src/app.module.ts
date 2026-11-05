import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { AuthController } from './auth/auth.controller';
import { validateEnv } from './config/env.validation';
import { JwtGuard } from './guards/jwt.guard';
import { AuthorizeRequestService } from './oidc/authorize-request.service';
import { OidcConfigService } from './oidc/oidc-config.service';
import { OidcController } from './oidc/oidc.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Verification only: the gateway never signs tokens (auth-service does).
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('PRIVATE_KEY'),
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('AUTH_SERVICE_HOST') ?? '127.0.0.1',
            port: Number(config.get<string>('AUTH_SERVICE_PORT') ?? 4001),
          },
        }),
      },
    ]),
  ],
  controllers: [AuthController, OidcController],
  providers: [OidcConfigService, AuthorizeRequestService, JwtGuard],
})
export class AppModule {}
