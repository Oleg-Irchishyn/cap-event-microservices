import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'investments' })
export class Investment {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  title?: string;

  @Prop()
  type?: string;
}

export const InvestmentSchema = SchemaFactory.createForClass(Investment);
export type InvestmentDocument = HydratedDocument<Investment>;
