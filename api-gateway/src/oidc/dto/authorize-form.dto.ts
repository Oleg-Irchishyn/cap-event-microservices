import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Swagger-only description of the HTML form posted to POST /oidc/2/auth.
 * Not validated by class-validator: failures must render HTML (or redirect
 * with an OAuth error), not Nest's JSON 400, so they are handled by
 * AuthorizeRequestService.
 */
export class AuthorizeFormDto {
  @ApiProperty({ enum: ['login', 'register'], default: 'login' })
  mode: 'login' | 'register';

  @ApiProperty({ example: 'demo@example.com' })
  email: string;

  @ApiProperty({ format: 'password' })
  password: string;

  @ApiPropertyOptional({ description: 'Required when mode=register' })
  name?: string;

  @ApiProperty({ example: 'cap-event-ui' })
  client_id: string;

  @ApiProperty({ example: 'http://localhost:3000/cap-event/auth/callback' })
  redirect_uri: string;

  @ApiProperty({ example: 'code' })
  response_type: string;

  @ApiPropertyOptional({ example: 'openid profile email' })
  scope?: string;

  @ApiPropertyOptional()
  state?: string;

  @ApiPropertyOptional()
  resource?: string;

  @ApiProperty({ description: 'base64url(SHA-256(code_verifier))' })
  code_challenge: string;

  @ApiProperty({ enum: ['S256'] })
  code_challenge_method: string;

  @ApiPropertyOptional()
  nonce?: string;

  @ApiPropertyOptional()
  prompt?: string;
}
