import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'investor_attributes' })
export class InvestorAttribute {
  @Prop({ required: true })
  investorId: string;

  @Prop({ required: true })
  entityId: string;

  @Prop()
  secondaryInvestorId?: string;
}

export const InvestorAttributeSchema =
  SchemaFactory.createForClass(InvestorAttribute);
InvestorAttributeSchema.index({ investorId: 1, entityId: 1 }, { unique: true });
export type InvestorAttributeDocument = HydratedDocument<InvestorAttribute>;
