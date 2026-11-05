import type { CapEventType } from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';

/** Static catalogue (not user data, so it lives in code rather than in MongoDB). */
export const CAP_EVENT_TYPES: readonly CapEventType[] = [
  {
    id: '657475ed-b745-41d3-a864-463847900129',
    abbreviation: 'Call',
    name: 'Capital Call',
    description: 'Calls capital from investors',
  },
  {
    id: '657475ed-b745-41d3-a864-463847900123',
    abbreviation: 'Distr',
    name: 'Distribution',
    description: 'Distributes proceeds to investors',
  },
  {
    id: '657475ed-b745-41d3-a864-463847900131',
    abbreviation: 'RecDist',
    name: 'Recallable Distribution',
    description: 'Distribution that may be called back later',
  },
];

@Injectable()
export class CapEventTypesService {
  list(): CapEventType[] {
    return CAP_EVENT_TYPES.map((type) => ({ ...type }));
  }
}
