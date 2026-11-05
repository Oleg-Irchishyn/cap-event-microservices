import { ArgumentsHost, HttpException } from '@nestjs/common';

import { RegisterDto } from '../../auth/dto/register.dto';
import { ValidationPipe } from '../../pipes/validation.pipe';
import { OAuthExceptionFilter } from '../oauth-exception.filter';
import { OAuthException } from '../oauth.exception';
import { ValidationException } from '../validation.exception';

const run = (exception: HttpException) => {
  const res = { status: jest.fn(), set: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.set.mockReturnValue(res);
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  new OAuthExceptionFilter().catch(exception, host);
  return res;
};

describe('OAuthExceptionFilter', () => {
  it('renders OAuthException as { error, error_description } with no-store', () => {
    const res = run(new OAuthException('invalid_grant', 'expired'));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.set).toHaveBeenCalledWith({
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    });
    expect(res.json).toHaveBeenCalledWith({
      error: 'invalid_grant',
      error_description: 'expired',
    });
  });

  it('turns validation errors into invalid_request', () => {
    const res = run(
      new ValidationException([
        'grant_type - required',
        'client_id - required',
      ]),
    );
    expect(res.json).toHaveBeenCalledWith({
      error: 'invalid_request',
      error_description: 'grant_type - required; client_id - required',
    });
  });
});

describe('ValidationPipe', () => {
  const pipe = new ValidationPipe();

  it('throws "field - message" errors for invalid DTOs', async () => {
    const error = await pipe
      .transform(
        { email: 'nope', password: 'x', name: '' },
        {
          type: 'body',
          metatype: RegisterDto,
        },
      )
      .catch((e: ValidationException) => e);
    expect(error).toBeInstanceOf(ValidationException);
    expect((error as ValidationException).getStatus()).toBe(400);
    expect(
      [(error as ValidationException).messages].flat().join('|'),
    ).toContain('email - ');
  });

  it('passes valid DTOs and plain objects through', async () => {
    const dto = { email: 'a@b.co', password: 'password1', name: 'A' };
    await expect(
      pipe.transform(dto, { type: 'body', metatype: RegisterDto }),
    ).resolves.toBe(dto);
    await expect(
      pipe.transform({ any: 1 }, { type: 'body', metatype: Object }),
    ).resolves.toEqual({ any: 1 });
  });
});
