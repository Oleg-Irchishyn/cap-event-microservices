import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'accounts' })
export class Account {
  @Prop({ required: true, unique: true })
  accountKey: string;

  @Prop({ required: true })
  accountName: string;

  @Prop({ required: true })
  accountNo: string;

  @Prop()
  capitalCategory?: string;

  @Prop()
  callDistributionReason?: string;

  @Prop()
  defaultDescription?: string;

  @Prop()
  insideCommitment?: string;

  @Prop()
  fsLineItem?: string;

  /** Internal: owning sponsor. */
  @Prop({ required: true, index: true })
  sponsorId: string;

  /** Internal: financial-statement grouping (Capital, Assets, ...). */
  @Prop({ required: true })
  fsGrouping: string;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
export type AccountDocument = HydratedDocument<Account>;
