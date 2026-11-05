import { NestFactory } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const subset = (
  document: OpenAPIObject,
  prefixes: string[],
): OpenAPIObject => ({
  ...document,
  paths: Object.fromEntries(
    Object.entries(document.paths).filter(([path]) =>
      prefixes.some((prefix) => path.startsWith(prefix)),
    ),
  ),
});

/**
 * Writes openapi/*.json without needing any service or MongoDB: the app is
 * created but never started, and ClientProxy connects lazily. Placeholder env
 * values below only satisfy startup validation; they never reach the output.
 *
 *   gateway.json            every route
 *   auth.json               /oidc/2/* and /api/v1/auth/*
 *   reference-data.json     /api/v1/reference-data/*
 *   cap-event-package.json  /api/v1/cap-event-package/*
 */
async function main(): Promise<void> {
  process.env.PRIVATE_KEY ??= 'openapi-export-placeholder-key-not-used-0000';
  process.env.CLIENT_ID ??= 'cap-event-ui';

  // Imported only now: ConfigModule validates env when app.module is first loaded.
  const { AppModule } = await import('../app.module.js');
  const { buildOpenApiDocument } = await import('../app.setup.js');

  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  const document = buildOpenApiDocument(app);

  const outputs: Array<[string, OpenAPIObject]> = [
    ['gateway.json', document],
    ['auth.json', subset(document, ['/oidc/', '/api/v1/auth'])],
    ['reference-data.json', subset(document, ['/api/v1/reference-data'])],
    ['cap-event-package.json', subset(document, ['/api/v1/cap-event-package'])],
  ];
  for (const [name, doc] of outputs) {
    const target = resolve(__dirname, '../../openapi', name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`OpenAPI document written to ${target}`);
  }
  await app.close();
}

void main();
