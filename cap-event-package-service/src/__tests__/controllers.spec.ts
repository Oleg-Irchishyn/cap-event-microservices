import { CapEventPackagePattern } from '@cap-event/contracts';

import { AllocationController } from '../allocation/allocation.controller';
import { CapEventTypesController } from '../cap-event-types/cap-event-types.controller';
import { CapEventsController } from '../cap-events/cap-events.controller';
import { DocumentsController } from '../documents/documents.controller';

const svc = (...methods: string[]) =>
  Object.fromEntries(
    methods.map((m) => [m, jest.fn().mockReturnValue(`${m}-result`)]),
  );

describe('controllers delegate to their services', () => {
  it('cap events', () => {
    const s = svc(
      'list',
      'get',
      'createDraft',
      'update',
      'submit',
      'delete',
      'process',
    );
    const c = new CapEventsController(s as never);
    c.list(undefined as never);
    c.list({ sponsorId: '1' });
    c.get({ id: 'i' });
    c.createDraft({ capEvent: {}, user: { email: 'e' } } as never);
    c.update({ id: 'i' } as never);
    c.submit({} as never);
    c.delete({ id: 'i' });
    c.process({ capEvent: { name: 'x' } } as never);
    expect(s.list).toHaveBeenNthCalledWith(1, {});
    expect(s.list).toHaveBeenNthCalledWith(2, { sponsorId: '1' });
    expect(s.get).toHaveBeenCalledWith('i');
    expect(s.delete).toHaveBeenCalledWith('i');
    expect(s.process).toHaveBeenCalledWith({ name: 'x' });
    expect(s.createDraft).toHaveBeenCalled();
    expect(s.update).toHaveBeenCalled();
    expect(s.submit).toHaveBeenCalled();
  });

  it('allocation', () => {
    const s = svc(
      'allocateLineItem',
      'allocateEntities',
      'mgmtFeeJournalEntries',
      'mgmtFeeLineItems',
      'allocateMgmtFee',
    );
    const c = new AllocationController(s as never);
    expect(c.allocateLineItem({} as never)).toBe('allocateLineItem-result');
    expect(c.allocateEntities({} as never)).toBe('allocateEntities-result');
    expect(c.mgmtFeeJournalEntries({} as never)).toBe(
      'mgmtFeeJournalEntries-result',
    );
    expect(c.mgmtFeeLineItems({} as never)).toBe('mgmtFeeLineItems-result');
    expect(c.allocateMgmtFee({} as never)).toBe('allocateMgmtFee-result');
  });

  it('registers exactly one handler per pattern', () => {
    const handled = [
      CapEventsController,
      AllocationController,
      CapEventTypesController,
      DocumentsController,
    ].flatMap((ctl) =>
      Object.getOwnPropertyNames(ctl.prototype)
        .filter((n) => n !== 'constructor')
        .flatMap(
          (n) =>
            Reflect.getMetadata(
              'microservices:pattern',
              ctl.prototype[n as keyof typeof ctl.prototype],
            ) as string[],
        ),
    );
    expect(handled.sort()).toEqual(
      Object.values(CapEventPackagePattern).sort(),
    );
  });
});
