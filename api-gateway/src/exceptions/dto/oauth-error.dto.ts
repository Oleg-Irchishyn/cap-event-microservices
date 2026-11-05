import { ApiProperty } from '@nestjs/swagger';

/** Swagger-only typing for OAuth2 error responses. */
export class OAuthErrorDto {
  @ApiProperty({ example: 'invalid_grant', description: 'OAuth2 error code' })
  error: string;

  @ApiProperty({
    example: 'Authorization code is invalid or expired',
    description: 'Human-readable explanation',
  })
  error_description: string;
}
