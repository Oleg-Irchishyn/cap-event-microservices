import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'cap_events' })
export class CapEventRecord {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true, enum: ['DRAFT', 'SUBMITTED', 'POSTED'], index: true })
  status: string;

  /** Denormalised for the list filter. */
  @Prop({ index: true })
  sponsorId?: string;

  @Prop({ required: true })
  createdAt: string;

  @Prop({ required: true })
  createdBy: string;

  @Prop({ required: true, index: true })
  modifiedAt: string;

  @Prop({ required: true })
  modifiedBy: string;

  /**
   * The CapEvent body as JSON text (without the system fields above). Stored
   * as a string so arbitrary keys (footnotes, UI extras) never clash with
   * MongoDB field-name rules.
   */
  @Prop({ required: true })
  payload: string;
}

export const CapEventRecordSchema =
  SchemaFactory.createForClass(CapEventRecord);
export type CapEventRecordDocument = HydratedDocument<CapEventRecord>;
