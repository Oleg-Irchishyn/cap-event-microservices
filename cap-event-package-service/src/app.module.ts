import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AllocationModule } from './allocation/allocation.module';
import { CapEventTypesModule } from './cap-event-types/cap-event-types.module';
import { CapEventsModule } from './cap-events/cap-events.module';
import { validateEnv } from './config/env.validation';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
      }),
    }),
    CapEventTypesModule,
    CapEventsModule,
    AllocationModule,
    DocumentsModule,
  ],
})
export class AppModule {}
