import type { AllocationBasis as AllocationBasisDto } from '@cap-event/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AllocationBasis } from './schemas/allocation-basis.schema';

@Injectable()
export class AllocationBasesService {
  constructor(
    @InjectModel(AllocationBasis.name)
    private readonly basisModel: Model<AllocationBasis>,
  ) {}

  async list(): Promise<AllocationBasisDto[]> {
    return (await this.basisModel
      .find()
      .select('-_id -__v')
      .sort({ allocationId: 1 })
      .lean()) as unknown as AllocationBasisDto[];
  }

  /** Allocation names matching an id or a name (case-insensitive); the input itself is always included. */
  async namesFor(idOrName: string): Promise<string[]> {
    const found = await this.basisModel
      .find({
        $or: [
          { allocationId: idOrName },
          { allocationName: new RegExp(`^${escapeRegex(idOrName)}$`, 'i') },
        ],
      })
      .lean();
    return [idOrName, ...found.map((b) => b.allocationName)];
  }
}

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
