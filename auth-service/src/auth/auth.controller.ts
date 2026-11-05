import { AuthPattern } from '@cap-event/contracts';
import type {
  AuthSession,
  IssueCodePayload,
  IssueCodeResult,
  LoginPayload,
  LogoutPayload,
  LogoutResult,
  MePayload,
  PublicUser,
  RegisterPayload,
  TokenExchangePayload,
  TokenRefreshPayload,
  TokenSet,
  ValidateCredentialsPayload,
} from '@cap-event/contracts';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(AuthPattern.REGISTER)
  register(@Payload() payload: RegisterPayload): Promise<PublicUser> {
    return this.auth.register(payload);
  }

  @MessagePattern(AuthPattern.LOGIN)
  login(@Payload() payload: LoginPayload): Promise<AuthSession> {
    return this.auth.login(payload);
  }

  @MessagePattern(AuthPattern.VALIDATE_CREDENTIALS)
  validateCredentials(
    @Payload() payload: ValidateCredentialsPayload,
  ): Promise<PublicUser> {
    return this.auth.validateCredentials(payload);
  }

  @MessagePattern(AuthPattern.CODE_ISSUE)
  issueCode(@Payload() payload: IssueCodePayload): Promise<IssueCodeResult> {
    return this.auth.issueCode(payload);
  }

  @MessagePattern(AuthPattern.TOKEN_EXCHANGE)
  exchange(@Payload() payload: TokenExchangePayload): Promise<TokenSet> {
    return this.auth.exchangeCode(payload);
  }

  @MessagePattern(AuthPattern.TOKEN_REFRESH)
  refresh(@Payload() payload: TokenRefreshPayload): Promise<TokenSet> {
    return this.auth.refresh(payload);
  }

  @MessagePattern(AuthPattern.ME)
  me(@Payload() payload: MePayload): Promise<PublicUser> {
    return this.auth.me(payload);
  }

  @MessagePattern(AuthPattern.LOGOUT)
  logout(@Payload() payload: LogoutPayload): Promise<LogoutResult> {
    return this.auth.logout(payload);
  }
}
