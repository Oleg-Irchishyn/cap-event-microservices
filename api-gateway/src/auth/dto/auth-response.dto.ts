import type { AuthSession, PublicUser, TokenSet } from '@cap-event/contracts';
import { ApiProperty } from '@nestjs/swagger';

export class UserDto implements PublicUser {
  @ApiProperty({ example: '665f1c2e9b1e8a0012345678' })
  id: string;

  @ApiProperty({ example: 'demo@example.com' })
  email: string;

  @ApiProperty({ example: 'Demo User' })
  name: string;
}

/** Response of POST /oidc/2/token (and the token part of /api/v1/auth/login). */
export class TokenResponseDto implements TokenSet {
  @ApiProperty({ description: 'HS256 JWT with sub, email, name claims' })
  access_token: string;

  @ApiProperty({ example: 'Bearer', enum: ['Bearer'] })
  token_type: 'Bearer';

  @ApiProperty({
    example: 3600,
    description: 'Access token lifetime in seconds',
  })
  expires_in: number;

  @ApiProperty({ description: 'Opaque, single-use; rotated on every refresh' })
  refresh_token: string;

  @ApiProperty({ description: 'HS256 JWT with sub, email, name, aud, iss' })
  id_token: string;
}

export class AuthSessionDto extends TokenResponseDto implements AuthSession {
  @ApiProperty({ type: UserDto })
  user: UserDto;
}
