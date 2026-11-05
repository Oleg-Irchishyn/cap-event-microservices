import type { AllocationBasis } from '@cap-event/contracts';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'entities' })
export class Entity {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  dueDateDays?: string;

  @Prop()
  dueDateType?: string;

  @Prop()
  mfBasis?: string;

  @Prop({ type: Object })
  allocationBasis?: AllocationBasis;

  @Prop({ type: Object })
  allocationBasisPostInvPeriod?: AllocationBasis;

  @Prop()
  mfBasisDateDefault?: string;

  @Prop()
  yearFractionApproach?: string;

  @Prop()
  mfPercent?: string;

  @Prop()
  mfStartDate?: string;

  @Prop()
  mfStepDownDate?: string;

  @Prop()
  mfPercentPostInvPeriod?: string;

  /** Internal: owning fund group. */
  @Prop({ required: true, index: true })
  fundGroupId: string;

  /** Internal: ACTIVE / INACTIVE (filter of the entities endpoint). */
  @Prop({ required: true })
  status: string;

  /** Internal: FUND / ADMIN / ELIMINATION (typesToExclude filter). */
  @Prop({ required: true })
  type: string;
}

export const EntitySchema = SchemaFactory.createForClass(Entity);
export type EntityDocument = HydratedDocument<Entity>;
