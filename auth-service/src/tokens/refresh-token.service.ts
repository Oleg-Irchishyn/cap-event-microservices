import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { generateOpaqueToken, sha256Hex } from '../common/utils/hash.util';
import { invalidGrant } from '../common/utils/rpc-error.util';
import { readPositiveInt } from '../config/config.util';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';

@Injectable()
export class RefreshTokenService {
  private readonly ttlSeconds: number;

  constructor(
    @InjectModel(RefreshToken.name)
    private readonly model: Model<RefreshTokenDocument>,
    config: ConfigService,
  ) {
    this.ttlSeconds = readPositiveInt(
      config,
      'REFRESH_TOKEN_TTL_SECONDS',
      60 * 60 * 24 * 30,
    );
  }

  async issue(userId: string, clientId: string): Promise<string> {
    const token = generateOpaqueToken();
    await this.model.create({
      tokenHash: sha256Hex(token),
      userId,
      clientId,
      expiresAt: new Date(Date.now() + this.ttlSeconds * 1000),
    });
    return token;
  }

  /**
   * Consumes a refresh token (single use) and returns its owner. The caller
   * issues the replacement, which is what makes this a rotation. Deletion is
   * a single atomic findOneAndDelete, so two concurrent refreshes with the
   * same token cannot both succeed.
   */
  async consume(token: string, clientId: string): Promise<{ userId: string }> {
    const record = await this.model
      .findOneAndDelete({ tokenHash: sha256Hex(token) })
      .exec();

    // The TTL monitor only runs about once a minute, so check expiry here too.
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw invalidGrant('Refresh token is invalid or expired');
    }
    if (record.clientId !== clientId) {
      throw invalidGrant('Refresh token was not issued to this client');
    }
    return { userId: record.userId };
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.model.deleteMany({ userId }).exec();
    return result.deletedCount;
  }
}
