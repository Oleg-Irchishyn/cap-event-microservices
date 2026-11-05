import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'demo@example.com', description: 'Email (login)' })
  @IsString({ message: 'Should be in string format' })
  @IsEmail({}, { message: 'Should be a valid email address' })
  readonly email: string;

  @ApiProperty({ example: 'correct-horse-battery', description: 'Password' })
  @IsString({ message: 'Should be in string format' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  @MaxLength(72, { message: 'Should be at most 72 characters' })
  readonly password: string;
}
