import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.TCP_PORT ?? 4001);

  // No HTTP listener: this service only speaks Nest's TCP microservice
  // protocol and is reachable only by the api-gateway's ClientProxy.
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: { host: process.env.TCP_HOST ?? '127.0.0.1', port },
    },
  );

  await app.listen();
  new Logger('auth-service').log(`Listening for TCP messages on :${port}`);
}

void bootstrap();
