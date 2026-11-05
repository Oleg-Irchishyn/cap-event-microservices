import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { OidcConfigService } from './oidc/oidc-config.service';
import { ValidationPipe } from './pipes/validation.pipe';

/** Everything main.ts and the e2e test share, so they cannot drift apart. */
export function configureApp(app: INestApplication): void {
  const oidc = app.get(OidcConfigService);
  app.enableCors({ origin: oidc.corsOrigins, credentials: true });
  app.useGlobalPipes(new ValidationPipe());
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const oidc = app.get(OidcConfigService);
  const config = new DocumentBuilder()
    .setTitle('cap-event API Gateway')
    .setDescription(
      'Public HTTP surface for cap-event: a fake OneLogin (OIDC, Authorization Code + PKCE) ' +
        'and a spotify-style JSON auth API. This document is the contract for the UI.',
    )
    .setVersion('1.0.0')
    .addServer(oidc.publicUrl)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearerAuth',
    )
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function setupSwagger(app: INestApplication): void {
  // UI at /docs, raw OpenAPI JSON at /docs-json
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app));
}
