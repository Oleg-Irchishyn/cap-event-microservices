import { AuthPattern } from '@cap-event/contracts';
import type { AuthSession, PublicUser } from '@cap-event/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { firstValueFrom } from 'rxjs';

import { toHttpException } from '../common/utils/rpc-error.util';
import { ValidationErrorDto } from '../exceptions/dto/validation-error.dto';
import { JwtGuard } from '../guards/jwt.guard';
import { OidcConfigService } from '../oidc/oidc-config.service';
import { AuthSessionDto, UserDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Authorization')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    private readonly oidc: OidcConfigService,
  ) {}

  @ApiOperation({
    summary: 'Register a user and log in (auth.register + auth.login)',
  })
  @ApiCreatedResponse({ type: AuthSessionDto })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  @ApiConflictResponse({ description: 'User with this email already exists' })
  @Post('registration')
  async registration(@Body() dto: RegisterDto): Promise<AuthSession> {
    try {
      await firstValueFrom(
        this.authClient.send<PublicUser>(AuthPattern.REGISTER, dto),
      );
    } catch (error) {
      throw toHttpException(error);
    }
    return this.login({ email: dto.email, password: dto.password });
  }

  @ApiOperation({ summary: 'Log in with email and password (auth.login)' })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiBadRequestResponse({ type: ValidationErrorDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthSession> {
    try {
      return await firstValueFrom(
        this.authClient.send<AuthSession>(AuthPattern.LOGIN, {
          email: dto.email,
          password: dto.password,
          clientId: this.oidc.clientId,
          issuer: this.oidc.issuer,
        }),
      );
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @ApiOperation({ summary: 'Get the currently authenticated user (auth.me)' })
  @ApiBearerAuth('bearerAuth')
  @ApiOkResponse({ type: UserDto })
  @ApiUnauthorizedResponse({ description: 'User is not authorized' })
  @Get('me')
  @UseGuards(JwtGuard)
  async me(@Req() req: Request): Promise<PublicUser> {
    try {
      return await firstValueFrom(
        this.authClient.send<PublicUser>(AuthPattern.ME, {
          userId: req.user?.sub,
        }),
      );
    } catch (error) {
      throw toHttpException(error);
    }
  }
}
