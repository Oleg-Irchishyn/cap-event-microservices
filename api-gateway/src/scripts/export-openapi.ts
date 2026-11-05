import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Writes openapi/auth.json without needing auth-service or MongoDB: the app is
 * created but never started, and ClientProxy connects lazily. Placeholder env
 * values below only satisfy startup validation; they never reach the output.
 */
async function main(): Promise<void> {
  process.env.PRIVATE_KEY ??= 'openapi-export-placeholder-key-not-used-0000';
  process.env.CLIENT_ID ??= 'cap-event-ui';

  // Imported only now: ConfigModule validates env when app.module is first loaded.
  const { AppModule } = await import('../app.module.js');
  const { buildOpenApiDocument } = await import('../app.setup.js');

  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  const document = buildOpenApiDocument(app);

  const target = resolve(__dirname, '../../openapi/auth.json');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`OpenAPI document written to ${target}`);
}

void main();
