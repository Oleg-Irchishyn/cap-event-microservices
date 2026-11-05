import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'sponsors' })
export class Sponsor {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  status: string;

  @Prop()
  salesforceId?: string;

  @Prop({ type: [String], default: [] })
  companyIds: string[];
}

export const SponsorSchema = SchemaFactory.createForClass(Sponsor);
export type SponsorDocument = HydratedDocument<Sponsor>;
