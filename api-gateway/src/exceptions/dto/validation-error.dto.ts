import { ApiProperty } from '@nestjs/swagger';

/** Swagger-only typing for 400 validation responses. */
export class ValidationErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: ['email - Should be a valid email address'],
    type: [String],
  })
  message: string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}
