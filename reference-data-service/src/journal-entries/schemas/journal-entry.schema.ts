import type { Account, Entity, Investment } from '@cap-event/contracts';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export const JOURNAL_ENTRY_KIND = {
  /** One per management-fee batch and entity (what `mgmt-fee` lists). */
  HEADER: 'HEADER',
  /** The GL lines of a batch (what `mgmt-fee/line-items` and `journal-entries` list). */
  LINE: 'LINE',
} as const;

@Schema({ collection: 'journal_entries' })
export class JournalEntry {
  /** Internal natural key used for idempotent seeding. */
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ type: Object })
  account?: Account;

  @Prop({ type: Object })
  investment?: Investment;

  @Prop()
  prDate?: string;

  @Prop()
  prFlag?: string;

  @Prop()
  agnstCommit?: string;

  @Prop()
  allocationBasis?: string;

  @Prop()
  amount?: number;

  @Prop()
  trType?: number;

  @Prop()
  batchDate?: string;

  @Prop()
  description?: string;

  @Prop({ index: true })
  batchNo?: number;

  @Prop({ type: Object })
  entity?: Entity;

  @Prop()
  exchangeRate?: number;

  @Prop()
  classId?: string;

  @Prop()
  customerId?: string;

  @Prop()
  isRounded?: boolean;

  @Prop()
  optOutInvestors?: string;

  @Prop()
  allocationBasisDate?: string;

  /** Internal filter fields (not part of the API shape). */
  @Prop({ required: true, enum: Object.values(JOURNAL_ENTRY_KIND) })
  kind: string;

  @Prop({ required: true, enum: ['Y', 'N'] })
  calledFlag: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true, index: true })
  entityId: string;
}

export const JournalEntrySchema = SchemaFactory.createForClass(JournalEntry);
export type JournalEntryDocument = HydratedDocument<JournalEntry>;
