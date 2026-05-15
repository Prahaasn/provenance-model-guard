import { describe, expect, it } from 'vitest';
import { parseWorkbook } from '../src/parser.js';
import { buildWorkbookBuffer } from './fixtures.js';

describe('parseWorkbook', () => {
  it('parses sheet names and basic dimensions', () => {
    const buf = buildWorkbookBuffer([
      {
        name: 'Inputs',
        rows: [
          ['Label', 'Value'],
          ['Growth', 0.05],
        ],
      },
      {
        name: 'Outputs',
        rows: [
          ['Year', 1, 2, 3],
          ['Revenue', 100, 105, 110],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    expect(wb.sheetNames).toEqual(['Inputs', 'Outputs']);
    expect(wb.sheets).toHaveLength(2);
    const outputs = wb.sheets[1]!;
    expect(outputs.rowCount).toBe(2);
    expect(outputs.colCount).toBe(4);
    expect(outputs.cells[1]![0]!.value).toBe('Revenue');
    expect(outputs.cells[1]![1]!.value).toBe(100);
  });

  it('classifies cell types correctly', () => {
    const buf = buildWorkbookBuffer([
      {
        name: 'Sheet1',
        rows: [
          ['text', 42, true, null, { f: '=A1', v: 'text' }],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const row = wb.sheets[0]!.cells[0]!;
    expect(row[0]!.type).toBe('text');
    expect(row[1]!.type).toBe('number');
    expect(row[2]!.type).toBe('boolean');
    expect(row[3]!.type).toBe('empty');
    expect(row[4]!.type).toBe('formula');
    expect(row[4]!.formula).toBe('A1');
  });

  it('accepts Uint8Array input', () => {
    const ab = buildWorkbookBuffer([
      { name: 'S', rows: [[1, 2, 3]] },
    ]);
    const u8 = new Uint8Array(ab);
    const wb = parseWorkbook(u8);
    expect(wb.sheets[0]!.cells[0]![2]!.value).toBe(3);
  });

  it('handles empty sheets without throwing', () => {
    const buf = buildWorkbookBuffer([{ name: 'Empty', rows: [[]] }]);
    const wb = parseWorkbook(buf);
    expect(wb.sheets[0]!.name).toBe('Empty');
  });
});
