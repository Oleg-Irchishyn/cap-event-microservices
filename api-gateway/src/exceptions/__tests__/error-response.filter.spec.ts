import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { mockRes } from '../../test-utils/mocks';
import { ErrorResponseFilter } from '../error-response.filter';
import { ValidationException } from '../validation.exception';

const run = (exception: unknown) => {
  const res = mockRes();
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  new ErrorResponseFilter().catch(exception, host);
  return {
    status: res.status.mock.calls[0][0] as number,
    body: res.json.mock.calls[0][0],
  };
};

describe('ErrorResponseFilter', () => {
  it('always adds timestamp and requestId', () => {
    const { body } = run(new NotFoundException('nope'));
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    [new UnauthorizedException('User is not authorized'), 401, 'ACCESS_DENIED'],
    [new NotFoundException('x'), 404, 'RESOURCE_NOT_FOUND'],
    [new HttpException('x', 403), 403, 'FORBIDDEN'],
    [new HttpException('x', 409), 409, 'CONFLICT'],
    [new HttpException('x', 503), 503, 'INTERNAL_SERVER_ERROR'],
    [new BadRequestException('x'), 400, 'BAD_REQUEST'],
  ])('maps %s to %s / %s', (exception, status, reason) => {
    const result = run(exception);
    expect(result.status).toBe(status);
    expect(result.body.reason).toBe(reason);
  });

  it('turns pipe validation errors into VALIDATION_ERROR with field details', () => {
    const { status, body } = run(
      new ValidationException([
        'batchNo - Should be an integer',
        'something odd',
      ]),
    );
    expect(status).toBe(400);
    expect(body).toMatchObject({
      reason: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [
        {
          field: 'batchNo',
          reason: 'INVALID_VALUE',
          message: 'Should be an integer',
        },
        { reason: 'INVALID_VALUE', message: 'something odd' },
      ],
    });
  });

  it('keeps the message of Nest built-in pipes (e.g. ParseUUIDPipe)', () => {
    const { body } = run(
      new BadRequestException('Validation failed (uuid is expected)'),
    );
    expect(body.message).toBe('Validation failed (uuid is expected)');
  });

  it('never echoes unknown errors', () => {
    const { status, body } = run(new Error('db password is hunter2'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});
