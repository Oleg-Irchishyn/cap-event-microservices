import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** application/x-www-form-urlencoded body of POST /oidc/2/token. */
export class TokenRequestDto {
  @ApiProperty({
    enum: ['authorization_code', 'refresh_token'],
    example: 'authorization_code',
  })
  @IsString({ message: 'Should be in string format' })
  @IsNotEmpty({ message: 'grant_type is required' })
  readonly grant_type: string;

  @ApiProperty({ example: 'cap-event-ui', description: 'Must equal CLIENT_ID' })
  @IsString({ message: 'Should be in string format' })
  @IsNotEmpty({ message: 'client_id is required' })
  readonly client_id: string;

  @ApiPropertyOptional({
    description: 'authorization_code grant: the one-time code',
  })
  @IsOptional()
  @IsString({ message: 'Should be in string format' })
  @MaxLength(512, { message: 'Too long' })
  readonly code?: string;

  @ApiPropertyOptional({
    description:
      'authorization_code grant: must equal the redirect_uri of the auth request',
  })
  @IsOptional()
  @IsString({ message: 'Should be in string format' })
  @MaxLength(2048, { message: 'Too long' })
  readonly redirect_uri?: string;

  @ApiPropertyOptional({
    description: 'authorization_code grant: PKCE verifier',
  })
  @IsOptional()
  @IsString({ message: 'Should be in string format' })
  @MaxLength(256, { message: 'Too long' })
  readonly code_verifier?: string;

  @ApiPropertyOptional({
    description: 'refresh_token grant: the current refresh token',
  })
  @IsOptional()
  @IsString({ message: 'Should be in string format' })
  @MaxLength(512, { message: 'Too long' })
  readonly refresh_token?: string;
}
