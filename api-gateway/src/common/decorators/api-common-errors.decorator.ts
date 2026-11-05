import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ErrorResponseDto } from '../../exceptions/dto/error-response.dto';

/** Swagger docs shared by every JwtGuard-protected spec route. */
export const ApiCommonErrors = () =>
  applyDecorators(
    ApiBadRequestResponse({ type: ErrorResponseDto }),
    ApiUnauthorizedResponse({ type: ErrorResponseDto }),
    ApiInternalServerErrorResponse({ type: ErrorResponseDto }),
  );

/** The UI sends it on every call; it is accepted and ignored. */
export const ApiSessionIdHeader = () =>
  ApiHeader({
    name: 'Session-Id',
    required: false,
    description:
      'Session identifier (accepted for compatibility with the UI client, ignored)',
  });
