import {
  IssueCodePayload,
  IssueCodeResult,
  PKCE_METHOD_S256,
  TokenExchangePayload,
} from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { generateOpaqueToken, sha256Hex } from '../common/utils/hash.util';
import {
  isValidCodeChallenge,
  verifyPkceS256,
} from '../common/utils/pkce.util';
import { requireString } from '../common/utils/require-string.util';
import { invalidGrant, rpcError } from '../common/utils/rpc-error.util';
import { readPositiveInt } from '../config/config.util';
import {
  AuthorizationCode,
  AuthorizationCodeDocument,
} from './schemas/authorization-code.schema';

@Injectable()
export class AuthorizationCodeService {
  private readonly ttlSeconds: number;

  constructor(
    @InjectModel(AuthorizationCode.name)
    private readonly model: Model<AuthorizationCodeDocument>,
    config: ConfigService,
  ) {
    this.ttlSeconds = readPositiveInt(config, 'AUTH_CODE_TTL_SECONDS', 120);
  }

  async issue(payload: IssueCodePayload): Promise<IssueCodeResult> {
    const userId = requireString(payload.userId, 'userId');
    const clientId = requireString(payload.clientId, 'clientId');
    const redirectUri = requireString(payload.redirectUri, 'redirectUri');
    const codeChallenge = requireString(payload.codeChallenge, 'codeChallenge');

    if (payload.codeChallengeMethod !== PKCE_METHOD_S256) {
      throw rpcError(
        400,
        'Only code_challenge_method=S256 is supported',
        'invalid_request',
      );
    }
    if (!isValidCodeChallenge(codeChallenge)) {
      throw rpcError(400, 'code_challenge is malformed', 'invalid_request');
    }

    const code = generateOpaqueToken();
    await this.model.create({
      codeHash: sha256Hex(code),
      userId,
      clientId,
      redirectUri,
      codeChallenge,
      ...(typeof payload.nonce === 'string' ? { nonce: payload.nonce } : {}),
      expiresAt: new Date(Date.now() + this.ttlSeconds * 1000),
    });
    return { code, expiresIn: this.ttlSeconds };
  }

  /**
   * Redeems a code. The record is removed by one atomic findOneAndDelete
   * BEFORE any check, so a code is single-use even when the attempt fails
   * (wrong verifier, wrong redirect_uri) and cannot be brute-forced or raced.
   */
  async consume(
    payload: Pick<
      TokenExchangePayload,
      'code' | 'clientId' | 'redirectUri' | 'codeVerifier'
    >,
  ): Promise<{ userId: string; nonce?: string }> {
    const code = requireString(payload.code, 'code');
    const record = await this.model
      .findOneAndDelete({ codeHash: sha256Hex(code) })
      .exec();

    // The TTL monitor only runs about once a minute, so check expiry here too.
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw invalidGrant('Authorization code is invalid or expired');
    }
    if (record.clientId !== payload.clientId) {
      throw invalidGrant('Authorization code was not issued to this client');
    }
    if (record.redirectUri !== payload.redirectUri) {
      throw invalidGrant(
        'redirect_uri does not match the authorization request',
      );
    }
    if (
      typeof payload.codeVerifier !== 'string' ||
      !verifyPkceS256(payload.codeVerifier, record.codeChallenge)
    ) {
      throw invalidGrant('PKCE verification failed');
    }
    return { userId: record.userId, nonce: record.nonce };
  }
}
