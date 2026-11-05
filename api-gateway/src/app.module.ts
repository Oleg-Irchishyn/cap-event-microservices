import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { AuthController } from './auth/auth.controller';
import {
  CAP_EVENT_PACKAGE_SERVICE,
  CapEventPackageController,
} from './cap-event-package/cap-event-package.controller';
import { validateEnv } from './config/env.validation';
import { JwtGuard } from './guards/jwt.guard';
import { AuthorizeRequestService } from './oidc/authorize-request.service';
import { OidcConfigService } from './oidc/oidc-config.service';
import { OidcController } from './oidc/oidc.controller';
import {
  REFERENCE_DATA_SERVICE,
  ReferenceDataController,
} from './reference-data/reference-data.controller';

const tcpClient = (
  name: string,
  hostKey: string,
  portKey: string,
  port: number,
) => ({
  name,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    transport: Transport.TCP as const,
    options: {
      host: config.get<string>(hostKey) ?? '127.0.0.1',
      port: Number(config.get<string>(portKey) ?? port),
    },
  }),
});

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
      tcpClient('AUTH_SERVICE', 'AUTH_SERVICE_HOST', 'AUTH_SERVICE_PORT', 4001),
      tcpClient(
        REFERENCE_DATA_SERVICE,
        'REFERENCE_DATA_SERVICE_HOST',
        'REFERENCE_DATA_SERVICE_PORT',
        4002,
      ),
      tcpClient(
        CAP_EVENT_PACKAGE_SERVICE,
        'CAP_EVENT_PACKAGE_SERVICE_HOST',
        'CAP_EVENT_PACKAGE_SERVICE_PORT',
        4003,
      ),
    ]),
  ],
  controllers: [
    AuthController,
    OidcController,
    ReferenceDataController,
    CapEventPackageController,
  ],
  providers: [OidcConfigService, AuthorizeRequestService, JwtGuard],
})
export class AppModule {}
