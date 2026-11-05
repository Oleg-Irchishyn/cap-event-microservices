import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'mapped_accounts' })
export class MappedAccount {
  @Prop({ required: true, unique: true })
  sourceAccountKey: string;

  @Prop({ required: true })
  mappedAccountKey: string;
}

export const MappedAccountSchema = SchemaFactory.createForClass(MappedAccount);
export type MappedAccountDocument = HydratedDocument<MappedAccount>;
