import type { CapEvent } from '@cap-event/contracts';

import { fakeModel, rpcStatus } from '../../test-utils/fake-model';
import { CapEventsService } from '../cap-events.service';

const USER = { email: 'demo@cap-event.local' };

const body = (overrides: Record<string, unknown> = {}): CapEvent => ({
  sponsor: { id: '1', name: 'Golden Dev Test' },
  capEventType: { id: 't', abbreviation: 'Call', name: 'Capital Call' },
  fundGroup: { id: 'FG001', name: 'Global Equity' },
  entities: [{ id: '73301-01', name: 'Fund' }],
  noticeDate: '2026-12-01',
  footnotes: { 'a.b$c': 'dots and dollars survive' },
  capEventEntityLineItems: [
    {
      entity: { id: '73301-01' },
      noticeDate: '2026-12-01',
      dueDate: '2026-12-15',
      capEventLineItems: [
        {
          account: { accountNo: '3110' },
          allocationBasis: 'Commitment',
          allocationBasisId: 'DS-CMNT',
          amount: 1000.1,
          prDate: '2026-12-15',
          prFlag: true,
        },
        {
          account: { accountNo: '3120' },
          allocationBasis: 'Commitment',
          allocationBasisId: 'DS-CMNT',
          amount: 500.2,
          prDate: '2026-12-15',
          prFlag: true,
        },
      ],
    },
  ],
  ...overrides,
});

describe('CapEventsService', () => {
  const build = () => {
    const model = fakeModel();
    const allocation = { process: jest.fn().mockReturnValue([{ id: 'agg' }]) };
    return {
      model,
      allocation,
      service: new CapEventsService(model as never, allocation as never),
    };
  };

  it('createDraft: stores a DRAFT with generated id, audit fields, total and name', async () => {
    const { service, model, allocation } = build();
    const created = await service.createDraft({
      capEvent: body({ status: 'SUBMITTED', createdBy: 'x@y.z' }),
      user: USER,
    });
    expect(created).toMatchObject({
      status: 'DRAFT',
      createdBy: USER.email,
      modifiedBy: USER.email,
      totalAmount: 1500.3,
      name: 'Call - Global Equity - 2026-12-01',
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(model.store[0].sponsorId).toBe('1');
    expect(allocation.process).not.toHaveBeenCalled();
    expect(await service.get(created.id as string)).toEqual(created);
  });

  it('createDraft: honours a free UUID, rejects bad and duplicate ids', async () => {
    const { service } = build();
    const id = '657475ed-b745-41d3-a864-463847902229';
    expect(
      (await service.createDraft({ capEvent: body({ id }), user: USER })).id,
    ).toBe(id);
    expect(
      await rpcStatus(
        service.createDraft({ capEvent: body({ id }), user: USER }),
      ),
    ).toMatchObject({ status: 400 });
    expect(
      await rpcStatus(
        service.createDraft({ capEvent: body({ id: 'nope' }), user: USER }),
      ),
    ).toMatchObject({ status: 400 });
  });

  it('falls back to a system user when none is forwarded', async () => {
    const { service } = build();
    const created = await service.createDraft({
      capEvent: body(),
      user: undefined as never,
    });
    expect(created.createdBy).toBe('system@cap-event.local');
  });

  it('update: only DRAFTs; keeps createdAt/createdBy; 404 for unknown', async () => {
    const { service } = build();
    const draft = await service.createDraft({ capEvent: body(), user: USER });
    const updated = await service.update({
      id: draft.id as string,
      capEvent: body({ comment: 'changed' }),
      user: { email: 'other@cap-event.local' },
    });
    expect(updated).toMatchObject({
      id: draft.id,
      status: 'DRAFT',
      comment: 'changed',
      createdBy: USER.email,
      modifiedBy: 'other@cap-event.local',
    });
    expect(
      await rpcStatus(
        service.update({
          id: '657475ed-b745-41d3-a864-463847902230',
          capEvent: body(),
          user: USER,
        }),
      ),
    ).toMatchObject({ status: 404 });
  });

  it('submit: creates a SUBMITTED event with aggregated line items', async () => {
    const { service, allocation } = build();
    const submitted = await service.submit({
      capEvent: body({ status: 'DRAFT' }),
      user: USER,
    });
    expect(submitted.status).toBe('SUBMITTED');
    expect(submitted.capEventAggregatedLineItems).toEqual([{ id: 'agg' }]);
    expect(allocation.process).toHaveBeenCalledTimes(1);
  });

  it('submit: keeps client-sent aggregated items; promotes an existing DRAFT; then locks it', async () => {
    const { service, allocation } = build();
    const draft = await service.createDraft({ capEvent: body(), user: USER });
    const submitted = await service.submit({
      capEvent: body({
        id: draft.id,
        capEventAggregatedLineItems: [{ id: 'mine' }],
      }),
      user: USER,
    });
    expect(submitted).toMatchObject({
      id: draft.id,
      status: 'SUBMITTED',
      capEventAggregatedLineItems: [{ id: 'mine' }],
    });
    expect(allocation.process).not.toHaveBeenCalled();
    expect(
      await rpcStatus(
        service.submit({ capEvent: body({ id: draft.id }), user: USER }),
      ),
    ).toMatchObject({ status: 400 });
    expect(
      await rpcStatus(
        service.update({
          id: draft.id as string,
          capEvent: body(),
          user: USER,
        }),
      ),
    ).toMatchObject({ status: 400 });
    expect(await rpcStatus(service.delete(draft.id as string))).toMatchObject({
      status: 400,
    });
  });

  it('submit: needs at least one entity line item', async () => {
    const { service } = build();
    expect(
      await rpcStatus(
        service.submit({
          capEvent: body({ capEventEntityLineItems: [] }),
          user: USER,
        }),
      ),
    ).toMatchObject({ status: 400 });
  });

  it('delete: removes a DRAFT; 404 afterwards', async () => {
    const { service } = build();
    const draft = await service.createDraft({ capEvent: body(), user: USER });
    await expect(service.delete(draft.id as string)).resolves.toEqual({
      id: draft.id,
    });
    expect(await rpcStatus(service.get(draft.id as string))).toMatchObject({
      status: 404,
    });
    expect(await rpcStatus(service.delete(draft.id as string))).toMatchObject({
      status: 404,
    });
  });

  it('list: filters by sponsor and statuses, rejects unknown statuses', async () => {
    const { service } = build();
    await service.createDraft({ capEvent: body(), user: USER });
    await service.createDraft({
      capEvent: body({ sponsor: { id: '2', name: 'Other' } }),
      user: USER,
    });
    await service.submit({ capEvent: body(), user: USER });

    expect(await service.list({})).toHaveLength(3);
    expect(await service.list({ sponsorId: '2' })).toHaveLength(1);
    expect(await service.list({ statuses: ['SUBMITTED'] })).toHaveLength(1);
    expect(
      await service.list({ statuses: ['DRAFT', 'SUBMITTED'], sponsorId: '1' }),
    ).toHaveLength(2);
    expect(await service.list({ statuses: ['POSTED'] })).toEqual([]);
    expect(
      await rpcStatus(service.list({ statuses: ['BOGUS'] })),
    ).toMatchObject({ status: 400 });
  });

  it('process delegates to the allocation simulation', () => {
    const { service, allocation } = build();
    expect(service.process(body())).toEqual([{ id: 'agg' }]);
    expect(allocation.process).toHaveBeenCalled();
  });
});
