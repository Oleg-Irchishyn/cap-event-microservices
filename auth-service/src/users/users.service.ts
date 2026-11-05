import type { PublicUser } from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import type { Model } from 'mongoose';

import { requireString } from '../common/utils/require-string.util';
import { rpcError } from '../common/utils/rpc-error.util';
import { readPositiveInt } from '../config/config.util';
import { User, UserDocument } from './schemas/user.schema';

const MIN_PASSWORD_LENGTH = 8;
// bcrypt silently truncates past 72 bytes; reject instead.
const MAX_PASSWORD_BYTES = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class UsersService {
  private readonly rounds: number;
  // Compared against when the email is unknown so response time does not
  // reveal whether an account exists.
  private dummyHash?: Promise<string>;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    config: ConfigService,
  ) {
    this.rounds = readPositiveInt(config, 'BCRYPT_ROUNDS', 10);
  }

  static toPublic(user: UserDocument): PublicUser {
    return { id: String(user._id), email: user.email, name: user.name };
  }

  async register(input: {
    email: unknown;
    password: unknown;
    name: unknown;
  }): Promise<PublicUser> {
    const email = requireString(input.email, 'email').trim().toLowerCase();
    const password = requireString(input.password, 'password');
    const name = requireString(input.name, 'name').trim();

    if (!EMAIL_PATTERN.test(email)) {
      throw rpcError(400, 'email must be a valid email address');
    }
    if (
      password.length < MIN_PASSWORD_LENGTH ||
      Buffer.byteLength(password) > MAX_PASSWORD_BYTES
    ) {
      throw rpcError(
        400,
        `password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_BYTES} bytes long`,
      );
    }

    const hash = await bcrypt.hash(password, this.rounds);
    try {
      const created = await this.userModel.create({
        email,
        name,
        password: hash,
      });
      return UsersService.toPublic(created);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw rpcError(409, 'User with this email already exists');
      }
      throw error;
    }
  }

  async validateCredentials(input: {
    email: unknown;
    password: unknown;
  }): Promise<PublicUser> {
    const email = requireString(input.email, 'email').trim().toLowerCase();
    const password = requireString(input.password, 'password');

    const user = await this.userModel.findOne({ email }).exec();
    const hash = user ? user.password : await this.getDummyHash();
    const matches = await bcrypt.compare(password, hash);

    if (!user || !matches) {
      throw rpcError(401, 'Invalid email or password');
    }
    return UsersService.toPublic(user);
  }

  async findById(id: unknown): Promise<PublicUser> {
    const userId = requireString(id, 'userId');
    let user: UserDocument | null = null;
    try {
      user = await this.userModel.findById(userId).exec();
    } catch {
      // malformed ObjectId -> treated as not found
    }
    if (!user) {
      throw rpcError(404, 'User not found');
    }
    return UsersService.toPublic(user);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const found = await this.userModel
      .exists({ email: email.trim().toLowerCase() })
      .exec();
    return found !== null;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= bcrypt.hash('dummy-password-for-timing', this.rounds);
    return this.dummyHash;
  }
}
