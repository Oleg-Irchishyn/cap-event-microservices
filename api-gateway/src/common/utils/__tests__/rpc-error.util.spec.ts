import {
  toFormError,
  toHttpException,
  toOAuthException,
} from '../rpc-error.util';

describe('rpc-error.util', () => {
  describe('toHttpException', () => {
    it('keeps status and message of an RpcException payload', () => {
      const e = toHttpException({ status: 409, message: 'exists' });
      expect(e.getStatus()).toBe(409);
      expect(e.message).toBe('exists');
    });

    it('maps connection failures to 503 without leaking details', () => {
      const e = toHttpException({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 10.0.0.1:4001',
      });
      expect(e.getStatus()).toBe(503);
      expect(e.message).toBe('Authentication service unavailable');
    });

    it('maps anything else (incl. Nest string status "error") to a generic 500', () => {
      const e = toHttpException({
        status: 'error',
        message: 'stack trace here',
      });
      expect(e.getStatus()).toBe(500);
      expect(e.message).toBe('Internal server error');
      expect(toHttpException(undefined).getStatus()).toBe(500);
    });
  });

  describe('toOAuthException', () => {
    it('keeps the OAuth error code from the service', () => {
      const e = toOAuthException({
        status: 400,
        message: 'bad',
        error: 'invalid_grant',
      });
      expect(e.getResponse()).toEqual({
        error: 'invalid_grant',
        error_description: 'bad',
      });
    });

    it('defaults to invalid_request / server_error', () => {
      expect(toOAuthException({ status: 400, message: 'x' }).error).toBe(
        'invalid_request',
      );
      const down = toOAuthException({ code: 'ECONNREFUSED' });
      expect(down.error).toBe('server_error');
      expect(down.getStatus()).toBe(503);
    });
  });

  describe('toFormError', () => {
    it('shows 4xx service messages but hides 5xx ones', () => {
      expect(
        toFormError({ status: 401, message: 'Invalid email or password' }),
      ).toEqual({
        status: 401,
        message: 'Invalid email or password',
      });
      expect(
        toFormError({ status: 500, message: 'boom' }).message,
      ).not.toContain('boom');
    });
  });
});
