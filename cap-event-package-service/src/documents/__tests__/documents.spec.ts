import type { InvestorDocumentInput } from '@cap-event/contracts';

import { rpcStatus } from '../../test-utils/fake-model';
import { DocumentsController } from '../documents.controller';
import { DocumentsService } from '../documents.service';
import { buildSimplePdf } from '../pdf.util';

describe('buildSimplePdf', () => {
  const pdf = buildSimplePdf('Title (x)', ['line \\ one', 'Ünïcode']);
  const text = pdf.toString('latin1');

  it('produces a PDF with header, trailer and consistent xref offsets', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    );
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, i) => {
      expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(
        `${i + 1} 0 obj`,
      );
    });
  });

  it('escapes PDF text and replaces non-ASCII', () => {
    expect(text).toContain('(Title \\(x\\)) Tj');
    expect(text).toContain('(line \\\\ one) Tj');
    expect(text).toContain('(?n?code) Tj');
  });
});

describe('DocumentsService', () => {
  const service = new DocumentsService();
  const input = (entries: unknown[]) =>
    ({
      capEvent: {
        name: 'Call - FG001',
        capEventType: { name: 'Capital Call' },
        sponsor: { id: '1', name: 'Golden Dev Test' },
        fundGroup: { id: 'FG001', name: 'Global Equity' },
        noticeDate: '2026-12-01',
      },
      lineItem: {
        entity: { id: 'E1', name: 'Fund' },
        dueDate: '2026-12-15',
        plInvestorEntries: entries,
      },
    }) as unknown as InvestorDocumentInput;

  it('returns a base64 PDF as octet-stream for a single investor', () => {
    const result = service.generate(
      input([
        {
          customerId: 'CUST001',
          investor: 'ABC Pension Fund',
          allocatedAmount: 1234.5,
          isAggregated: true,
        },
        { customerId: 'CUST001', allocatedAmount: 1 },
      ]),
    );
    expect(result.contentType).toBe('application/octet-stream');
    const bytes = Buffer.from(result.contentBase64, 'base64');
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.toString('latin1')).toContain('1,234.50');
  });

  it('rejects empty and multi-investor line items with 400', async () => {
    expect(await rpcStatus(() => service.generate(input([])))).toMatchObject({
      status: 400,
    });
    expect(
      await rpcStatus(() =>
        service.generate(input([{ customerId: 'A' }, { customerId: 'B' }])),
      ),
    ).toMatchObject({ status: 400 });
  });

  it('controller delegates', () => {
    const generate = jest.fn().mockReturnValue('r');
    expect(new DocumentsController({ generate }).generate({} as never)).toBe(
      'r',
    );
  });
});
