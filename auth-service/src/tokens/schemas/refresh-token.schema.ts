import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'refresh_tokens', timestamps: true })
export class RefreshToken {
  /** sha256 of the opaque token; the token itself is never stored. */
  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  clientId: string;

  /** MongoDB TTL index removes the document once this date passes. */
  @Prop({ required: true, type: Date, expires: 0 })
  expiresAt: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
