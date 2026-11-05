import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'auth_codes', timestamps: true })
export class AuthorizationCode {
  /** sha256 of the one-time code; the code itself is never stored. */
  @Prop({ required: true, unique: true })
  codeHash: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true })
  redirectUri: string;

  @Prop({ required: true })
  codeChallenge: string;

  @Prop()
  nonce?: string;

  /** MongoDB TTL index removes the document once this date passes. */
  @Prop({ required: true, type: Date, expires: 0 })
  expiresAt: Date;
}

export const AuthorizationCodeSchema =
  SchemaFactory.createForClass(AuthorizationCode);
export type AuthorizationCodeDocument = HydratedDocument<AuthorizationCode>;
