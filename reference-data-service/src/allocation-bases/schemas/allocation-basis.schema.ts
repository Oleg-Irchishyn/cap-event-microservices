import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'allocation_bases' })
export class AllocationBasis {
  @Prop({ required: true, unique: true })
  allocationId: string;

  @Prop({ required: true })
  allocationName: string;

  @Prop()
  type?: string;

  @Prop({ required: true, enum: ['Active', 'Inactive'] })
  allocationBasisStatus: string;
}

export const AllocationBasisSchema =
  SchemaFactory.createForClass(AllocationBasis);
export type AllocationBasisDocument = HydratedDocument<AllocationBasis>;
