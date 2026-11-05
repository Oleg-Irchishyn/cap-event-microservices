import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  setupSwagger(app);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('api-gateway').log(
    `Listening on :${port} - Swagger at /docs, OpenAPI JSON at /docs-json`,
  );
}

void bootstrap();
