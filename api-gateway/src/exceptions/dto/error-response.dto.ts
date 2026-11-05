import { ApiPropertyOptional } from '@nestjs/swagger';

export const ERROR_REASONS = [
  'VALIDATION_ERROR',
  'RESOURCE_NOT_FOUND',
  'INTERNAL_SERVER_ERROR',
  'CONFLICT',
  'FORBIDDEN',
  'ACCESS_DENIED',
  'BAD_REQUEST',
] as const;
export type ErrorReason = (typeof ERROR_REASONS)[number];

export class ErrorDetailDto {
  @ApiPropertyOptional({ example: 'batchNo' })
  field?: string;

  @ApiPropertyOptional({ example: 'INVALID_VALUE' })
  reason?: string;

  @ApiPropertyOptional({ example: 'Should be an integer' })
  message?: string;
}

/** `ErrorResponse` of the OpenAPI specs (common.json). */
export class ErrorResponseDto {
  @ApiPropertyOptional({ enum: ERROR_REASONS, example: 'VALIDATION_ERROR' })
  reason?: ErrorReason;

  @ApiPropertyOptional({ example: 'Validation failed' })
  message?: string;

  @ApiPropertyOptional({ type: [ErrorDetailDto] })
  details?: ErrorDetailDto[];

  @ApiPropertyOptional({ example: '2026-11-05T10:15:30.123Z' })
  timestamp?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    example: '9b173b09-7a85-4c58-b127-7e8a9a564400',
  })
  requestId?: string;
}
