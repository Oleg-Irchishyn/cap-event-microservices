import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.TCP_PORT ?? 4002);

  // No HTTP listener: only the api-gateway (and cap-event-package-service)
  // connect to this TCP socket.
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: { host: process.env.TCP_HOST ?? '127.0.0.1', port },
    },
  );

  await app.listen();
  new Logger('reference-data-service').log(
    `Listening for TCP messages on :${port}`,
  );
}

void bootstrap();
