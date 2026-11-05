import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'demo@example.com', description: 'Email (login)' })
  @IsString({ message: 'Should be in string format' })
  @IsEmail({}, { message: 'Should be a valid email address' })
  @MaxLength(254, { message: 'Email is too long' })
  readonly email: string;

  @ApiProperty({
    example: 'correct-horse-battery',
    description: 'Password, 8-72 characters',
    minLength: 8,
    maxLength: 72,
  })
  @IsString({ message: 'Should be in string format' })
  @MinLength(8, { message: 'Should be at least 8 characters' })
  @MaxLength(72, { message: 'Should be at most 72 characters' })
  readonly password: string;

  @ApiProperty({ example: 'Demo User', description: 'Display name' })
  @IsString({ message: 'Should be in string format' })
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @MaxLength(100, { message: 'Name is too long' })
  readonly name: string;
}
