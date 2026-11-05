import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ collection: 'queries' })
export class Query {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  query: string;

  @Prop()
  description?: string;

  /** Internal: canned result of "executing" the query. */
  @Prop({ type: Object, default: {} })
  results: Record<string, string>;
}

export const QuerySchema = SchemaFactory.createForClass(Query);
export type QueryDocument = HydratedDocument<Query>;
