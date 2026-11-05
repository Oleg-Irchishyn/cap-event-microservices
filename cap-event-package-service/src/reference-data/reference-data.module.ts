import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import {
  REFERENCE_DATA_SERVICE,
  ReferenceDataClient,
} from './reference-data.client';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: REFERENCE_DATA_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('REFERENCE_DATA_HOST') ?? '127.0.0.1',
            port: Number(config.get<string>('REFERENCE_DATA_PORT') ?? 4002),
          },
        }),
      },
    ]),
  ],
  providers: [ReferenceDataClient],
  exports: [ReferenceDataClient],
})
export class ReferenceDataModule {}
