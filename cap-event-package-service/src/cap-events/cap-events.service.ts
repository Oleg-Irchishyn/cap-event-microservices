import { CAP_EVENT_STATUSES } from '@cap-event/contracts';
import type {
  CapEvent,
  CapEventIdPayload,
  CapEventListPayload,
  CapEventStatus,
  CapEventUpdatePayload,
  CapEventWritePayload,
  ActingUser,
} from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';

import { AllocationService } from '../allocation/allocation.service';
import { CapEventRecord } from './schemas/cap-event.schema';
import { UUID_REGEX } from '../common/utils/hash.util';
import { badRequest, notFound } from '../common/utils/rpc-error.util';
import { round2 } from '../common/utils/split.util';

const FALLBACK_USER = 'system@cap-event.local';
const SYSTEM_FIELDS = [
  'id',
  'status',
  'createdAt',
  'createdBy',
  'modifiedAt',
  'modifiedBy',
] as const;

const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Lifecycle: DRAFT (create-draft / update / delete allowed) -> SUBMITTED
 * (submit; immutable). POSTED exists in the spec but no operation reaches it.
 */
@Injectable()
export class CapEventsService {
  constructor(
    @InjectModel(CapEventRecord.name)
    private readonly model: Model<CapEventRecord>,
    private readonly allocation: AllocationService,
  ) {}

  async list({
    sponsorId,
    statuses,
  }: CapEventListPayload): Promise<CapEvent[]> {
    const filter: Record<string, unknown> = {};
    if (sponsorId) filter.sponsorId = sponsorId;
    if (statuses?.length) {
      const invalid = statuses.filter(
        (s) => !(CAP_EVENT_STATUSES as readonly string[]).includes(s),
      );
      if (invalid.length) {
        throw badRequest(`Unknown status: ${invalid.join(', ')}`);
      }
      filter.status = { $in: statuses };
    }
    const records = await this.model
      .find(filter)
      .sort({ modifiedAt: -1, createdAt: -1 })
      .lean();
    return records.map((record) => this.toApi(record));
  }

  async get(id: string): Promise<CapEvent> {
    return this.toApi(await this.findOrFail(id));
  }

  async createDraft({
    capEvent,
    user,
  }: CapEventWritePayload): Promise<CapEvent> {
    return this.create(capEvent, user, 'DRAFT');
  }

  async update({
    id,
    capEvent,
    user,
  }: CapEventUpdatePayload): Promise<CapEvent> {
    const record = await this.findOrFail(id);
    this.assertDraft(record, 'updated');
    return this.replace(record, capEvent, user, 'DRAFT');
  }

  /** Creates a SUBMITTED cap event, or submits the DRAFT with the same id. */
  async submit({ capEvent, user }: CapEventWritePayload): Promise<CapEvent> {
    if (!(capEvent.capEventEntityLineItems ?? []).length) {
      throw badRequest(
        'A submitted cap event needs at least one entity line item',
      );
    }
    const existing = capEvent.id
      ? await this.model.findOne({ id: capEvent.id }).lean()
      : null;
    if (!existing) {
      return this.create(capEvent, user, 'SUBMITTED');
    }
    this.assertDraft(existing, 'submitted');
    return this.replace(existing, capEvent, user, 'SUBMITTED');
  }

  /** Returns the id: a TCP reply must carry a value (an empty reply is an error on the client). */
  async delete(id: string): Promise<CapEventIdPayload> {
    const record = await this.findOrFail(id);
    this.assertDraft(record, 'deleted');
    await this.model.deleteOne({ id });
    return { id };
  }

  /** Stateless: allocates the cap event's line items across investors. */
  process(capEvent: CapEvent) {
    return this.allocation.process(capEvent);
  }

  private async create(
    capEvent: CapEvent,
    user: ActingUser | undefined,
    status: CapEventStatus,
  ): Promise<CapEvent> {
    let id: string = randomUUID();
    if (capEvent.id) {
      if (!UUID_REGEX.test(capEvent.id)) {
        throw badRequest('id must be a UUID');
      }
      if (await this.model.exists({ id: capEvent.id })) {
        throw badRequest(`Cap event ${capEvent.id} already exists`);
      }
      id = capEvent.id;
    }
    const email = user?.email ?? FALLBACK_USER;
    const date = today();
    const record = {
      id,
      status,
      sponsorId: capEvent.sponsor?.id,
      createdAt: date,
      createdBy: email,
      modifiedAt: date,
      modifiedBy: email,
      payload: this.serialize(capEvent, status),
    };
    await this.model.create(record);
    return this.toApi(record);
  }

  private async replace(
    existing: Pick<CapEventRecord, 'id' | 'createdAt' | 'createdBy'>,
    capEvent: CapEvent,
    user: ActingUser | undefined,
    status: CapEventStatus,
  ): Promise<CapEvent> {
    const changes = {
      status,
      sponsorId: capEvent.sponsor?.id,
      modifiedAt: today(),
      modifiedBy: user?.email ?? FALLBACK_USER,
      payload: this.serialize(capEvent, status),
    };
    await this.model.updateOne({ id: existing.id }, { $set: changes });
    return this.toApi({ ...existing, ...changes });
  }

  /**
   * Drops the system fields, fills the derived ones. Aggregated line items are
   * computed by the simulation when the client did not send any.
   */
  private serialize(capEvent: CapEvent, status: CapEventStatus): string {
    const body: Record<string, unknown> = { ...capEvent };
    for (const field of SYSTEM_FIELDS) delete body[field];

    const entityItems = capEvent.capEventEntityLineItems ?? [];
    body.totalAmount = round2(
      entityItems
        .flatMap((item) => item.capEventLineItems ?? [])
        .reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    );
    body.name =
      capEvent.name ??
      [
        capEvent.capEventType?.abbreviation ?? capEvent.capEventType?.name,
        capEvent.fundGroup?.name ?? capEvent.fundGroup?.id,
        capEvent.noticeDate ?? today(),
      ]
        .filter(Boolean)
        .join(' - ');
    if (
      status === 'SUBMITTED' &&
      !(capEvent.capEventAggregatedLineItems ?? []).length
    ) {
      body.capEventAggregatedLineItems = this.allocation.process(capEvent);
    }
    // null (the UI's "no investment") is stored as absent: the spec has no nullable fields.
    if (body.noticeDate === '') delete body.noticeDate;
    return JSON.stringify(body, (_key, value: unknown) =>
      value === null ? undefined : value,
    );
  }

  private toApi(
    record: Pick<
      CapEventRecord,
      | 'id'
      | 'status'
      | 'createdAt'
      | 'createdBy'
      | 'modifiedAt'
      | 'modifiedBy'
      | 'payload'
    >,
  ): CapEvent {
    return {
      ...(JSON.parse(record.payload) as CapEvent),
      id: record.id,
      status: record.status as CapEventStatus,
      createdAt: record.createdAt,
      createdBy: record.createdBy,
      modifiedAt: record.modifiedAt,
      modifiedBy: record.modifiedBy,
    };
  }

  private async findOrFail(id: string) {
    const record = await this.model.findOne({ id }).lean();
    if (!record) {
      throw notFound(`Cap event ${id} not found`);
    }
    return record;
  }

  private assertDraft(
    record: Pick<CapEventRecord, 'status'>,
    verb: string,
  ): void {
    if (record.status !== 'DRAFT') {
      throw badRequest(
        `Only DRAFT cap events can be ${verb} (status is ${record.status})`,
      );
    }
  }
}
