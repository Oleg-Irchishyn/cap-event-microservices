import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';

import { UsersService } from '../users.service';

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RpcException);
    return (error as RpcException).getError();
  }
  throw new Error('expected rejection');
};

describe('UsersService', () => {
  let model: {
    create: jest.Mock;
    findOne: jest.Mock;
    findById: jest.Mock;
    exists: jest.Mock;
  };
  let service: UsersService;

  const execReturns = (fn: jest.Mock, value: unknown) =>
    fn.mockReturnValue({ exec: jest.fn().mockResolvedValue(value) });

  beforeEach(() => {
    model = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn(),
    };
    service = new UsersService(
      model as never,
      new ConfigService({ BCRYPT_ROUNDS: '4' }),
    );
  });

  describe('register', () => {
    it('lowercases the email and stores a bcrypt hash, not the password', async () => {
      model.create.mockImplementation((doc) =>
        Promise.resolve({ _id: 'id-1', ...doc }),
      );

      const user = await service.register({
        email: ' Ada@Example.COM ',
        password: 'correct-horse',
        name: ' Ada ',
      });

      expect(user).toEqual({
        id: 'id-1',
        email: 'ada@example.com',
        name: 'Ada',
      });
      const stored = model.create.mock.calls[0][0];
      expect(stored.password).not.toBe('correct-horse');
      expect(await bcrypt.compare('correct-horse', stored.password)).toBe(true);
    });

    it('maps a duplicate-key error to 409', async () => {
      model.create.mockRejectedValue({ code: 11000 });
      expect(
        await errorOf(
          service.register({
            email: 'a@b.co',
            password: 'password1',
            name: 'A',
          }),
        ),
      ).toMatchObject({ status: 409 });
    });

    it.each([
      [{ email: 'not-an-email', password: 'password1', name: 'A' }],
      [{ email: 'a@b.co', password: 'short', name: 'A' }],
      [{ email: 'a@b.co', password: 'password1', name: '' }],
      [{ email: { $ne: null }, password: 'password1', name: 'A' }],
    ])('rejects invalid input %j with 400', async (input) => {
      expect(await errorOf(service.register(input))).toMatchObject({
        status: 400,
      });
      expect(model.create).not.toHaveBeenCalled();
    });
  });

  describe('validateCredentials', () => {
    it('returns the public user for a correct password', async () => {
      const password = await bcrypt.hash('password1', 4);
      execReturns(model.findOne, {
        _id: 'id-1',
        email: 'a@b.co',
        name: 'A',
        password,
      });

      await expect(
        service.validateCredentials({ email: 'A@b.co', password: 'password1' }),
      ).resolves.toEqual({ id: 'id-1', email: 'a@b.co', name: 'A' });
      expect(model.findOne).toHaveBeenCalledWith({ email: 'a@b.co' });
    });

    it('returns an identical 401 for a wrong password and an unknown email', async () => {
      const password = await bcrypt.hash('password1', 4);
      execReturns(model.findOne, {
        _id: 'i',
        email: 'a@b.co',
        name: 'A',
        password,
      });
      const wrongPassword = await errorOf(
        service.validateCredentials({ email: 'a@b.co', password: 'nope-nope' }),
      );

      execReturns(model.findOne, null);
      const unknownEmail = await errorOf(
        service.validateCredentials({ email: 'x@b.co', password: 'password1' }),
      );

      expect(wrongPassword).toEqual({
        status: 401,
        message: 'Invalid email or password',
      });
      expect(unknownEmail).toEqual(wrongPassword);
    });

    it('never passes a non-string email to Mongo', async () => {
      await errorOf(
        service.validateCredentials({ email: { $ne: null }, password: 'x' }),
      );
      expect(model.findOne).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns 404 when missing or when the id is malformed', async () => {
      execReturns(model.findById, null);
      expect(await errorOf(service.findById('abc'))).toMatchObject({
        status: 404,
      });

      model.findById.mockImplementation(() => {
        throw new Error('CastError');
      });
      expect(await errorOf(service.findById('bad'))).toMatchObject({
        status: 404,
      });
    });
  });
});
