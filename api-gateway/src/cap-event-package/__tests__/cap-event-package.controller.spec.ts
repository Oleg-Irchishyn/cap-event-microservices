import { CapEventPackagePattern } from '@cap-event/contracts';
import { HttpException, StreamableFile } from '@nestjs/common';
import type { Request } from 'express';

import { failWith, mockClient, replyWith } from '../../test-utils/mocks';
import { CapEventPackageController } from '../cap-event-package.controller';
import type { CapEventDto } from '../dto/cap-event.dto';

const req = (email?: string) =>
  ({ user: email ? { email } : undefined }) as unknown as Request;
const capEvent = { name: 'x' } as unknown as CapEventDto;

describe('CapEventPackageController', () => {
  let client: ReturnType<typeof mockClient>;
  let controller: CapEventPackageController;

  beforeEach(() => {
    client = mockClient();
    client.send.mockReturnValue(replyWith('ok'));
    controller = new CapEventPackageController(client as never);
  });

  it('types', async () => {
    await expect(controller.types()).resolves.toBe('ok');
    expect(client.send).toHaveBeenCalledWith(CapEventPackagePattern.TYPES, {});
  });

  it('list normalises statuses and drops an empty sponsor', async () => {
    await controller.list({ sponsorId: '', statuses: 'DRAFT' as never });
    expect(client.send).toHaveBeenCalledWith(CapEventPackagePattern.LIST, {
      sponsorId: undefined,
      statuses: ['DRAFT'],
    });
  });

  it('write routes forward the body and the acting user (with a fallback)', async () => {
    await controller.submit(capEvent, req('demo@cap-event.local'));
    expect(client.send).toHaveBeenLastCalledWith(
      CapEventPackagePattern.SUBMIT,
      {
        capEvent,
        user: { email: 'demo@cap-event.local' },
      },
    );
    await controller.createDraft(capEvent, req());
    expect(client.send).toHaveBeenLastCalledWith(
      CapEventPackagePattern.CREATE_DRAFT,
      {
        capEvent,
        user: { email: 'unknown@cap-event.local' },
      },
    );
    await controller.update('id-1', capEvent, req('a@b.c'));
    expect(client.send).toHaveBeenLastCalledWith(
      CapEventPackagePattern.UPDATE,
      {
        id: 'id-1',
        capEvent,
        user: { email: 'a@b.c' },
      },
    );
  });

  it('get / delete / process', async () => {
    await controller.getById('id-1');
    expect(client.send).toHaveBeenLastCalledWith(CapEventPackagePattern.GET, {
      id: 'id-1',
    });
    await expect(controller.remove('id-1')).resolves.toBeUndefined();
    expect(client.send).toHaveBeenLastCalledWith(
      CapEventPackagePattern.DELETE,
      { id: 'id-1' },
    );
    await controller.process(capEvent);
    expect(client.send).toHaveBeenLastCalledWith(
      CapEventPackagePattern.PROCESS,
      { capEvent },
    );
  });

  it('allocation and management fee routes', async () => {
    const lineInput = {
      entityId: 'E1',
      dueDate: '2026-12-15',
      allocationBasisId: 'DS-CMNT',
      accountNo: '3110',
      investmentId: 'INV-001',
      amount: 5,
    };
    await controller.allocateLineItem(lineInput);
    expect(client.send).toHaveBeenLastCalledWith(
      CapEventPackagePattern.LINE_ITEM_ALLOCATE,
      lineInput,
    );

    const groupInput = {
      entityAllocationInput: [],
      allocationBasis: 'Commitment',
      amount: 1,
    };
    await controller.allocateEntities(groupInput);
    expect(client.send).toHaveBeenLastCalledWith(
      CapEventPackagePattern.FUND_GROUP_ALLOCATE,
      groupInput,
    );

    await controller.mgmtFeeLineItems({
      batchNo: '6002' as never,
      entityId: 'E1',
    });
    expect(client.send).toHaveBeenLastCalledWith(
      CapEventPackagePattern.MGMT_FEE_LINE_ITEMS,
      {
        batchNo: 6002,
        entityId: 'E1',
      },
    );

    await controller.mgmtFeeJournalEntries({ entityIds: 'E1' as never });
    expect(client.send).toHaveBeenLastCalledWith(
      CapEventPackagePattern.MGMT_FEE_JOURNAL_ENTRIES,
      {
        entityIds: ['E1'],
      },
    );

    await controller.allocatedMgmtFee({
      batchNo: '6002' as never,
      accountKey: '1-3130',
      allocationBasis: 'Commitment',
      allocationBasisId: 'DS-CMNT',
      entityId: 'E1',
    });
    expect(client.send).toHaveBeenLastCalledWith(
      CapEventPackagePattern.MGMT_FEE_ALLOCATE,
      {
        batchNo: 6002,
        accountKey: '1-3130',
        allocationBasis: 'Commitment',
        allocationBasisId: 'DS-CMNT',
        entityId: 'E1',
      },
    );
  });

  it('investor document streams the decoded bytes as octet-stream', async () => {
    client.send.mockReturnValue(
      replyWith({
        contentBase64: Buffer.from('%PDF-1.4 x').toString('base64'),
        contentType: 'application/octet-stream',
      }),
    );
    const file = await controller.investorDocument({
      capEvent,
      lineItem: {},
    });
    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders().type).toBe('application/octet-stream');
    expect(file.getHeaders().disposition).toContain('investor-notice.pdf');
  });

  it('translates RPC errors and unavailability', async () => {
    client.send.mockReturnValue(
      failWith({
        status: 400,
        message: 'Only DRAFT cap events can be updated',
      }),
    );
    const bad = (await controller
      .update('i', capEvent, req())
      .catch((e: unknown) => e)) as HttpException;
    expect(bad.getStatus()).toBe(400);

    client.send.mockReturnValue(failWith({ code: 'ECONNRESET', message: 'x' }));
    const down = (await controller
      .types()
      .catch((e: unknown) => e)) as HttpException;
    expect(down.getStatus()).toBe(503);
    expect(down.message).toBe('Cap event package service unavailable');
  });
});
