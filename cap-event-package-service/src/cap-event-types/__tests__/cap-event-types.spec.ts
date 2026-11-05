import { CapEventTypesController } from '../cap-event-types.controller';
import {
  CAP_EVENT_TYPES,
  CapEventTypesService,
} from '../cap-event-types.service';

describe('cap event types', () => {
  it('lists copies of the static catalogue with unique uuid ids', () => {
    const service = new CapEventTypesService();
    const list = service.list();
    expect(list).toEqual(CAP_EVENT_TYPES);
    expect(list[0]).not.toBe(CAP_EVENT_TYPES[0]);
    expect(new Set(list.map((t) => t.id)).size).toBe(list.length);
    expect(list.map((t) => t.abbreviation)).toEqual(
      expect.arrayContaining(['Call', 'Distr']),
    );
  });

  it('controller delegates', () => {
    const list = jest.fn().mockReturnValue([]);
    expect(new CapEventTypesController({ list }).list()).toEqual([]);
  });
});
