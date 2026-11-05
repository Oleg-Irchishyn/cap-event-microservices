import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'fund_groups' })
export class FundGroup {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  name: string;

  /** Internal: owning sponsor (not part of the API shape). */
  @Prop({ required: true, index: true })
  sponsorId: string;
}

export const FundGroupSchema = SchemaFactory.createForClass(FundGroup);
export type FundGroupDocument = HydratedDocument<FundGroup>;
