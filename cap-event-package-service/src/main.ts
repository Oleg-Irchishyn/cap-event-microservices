import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.TCP_PORT ?? 4003);

  // No HTTP listener: only the api-gateway connects to this TCP socket.
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: { host: process.env.TCP_HOST ?? '127.0.0.1', port },
    },
  );

  await app.listen();
  new Logger('cap-event-package-service').log(
    `Listening for TCP messages on :${port}`,
  );
}

void bootstrap();
