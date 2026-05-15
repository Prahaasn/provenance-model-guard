import { describe, expect, it } from 'vitest';
import { parseWorkbook } from '../src/parser.js';
import {
  hardcodedNumbers,
  circularRefs,
  formulaConsistency,
  emptyOutputs,
  excessiveHardcodes,
  valueJumps,
  sheetStructure,
  undocumentedAssumptions,
} from '../src/checks/index.js';
import { buildWorkbookBuffer } from './fixtures.js';

describe('hardcodedNumbers', () => {
  it('flags non-allowed numeric literals inside formulas', () => {
    const buf = buildWorkbookBuffer([
      {
        name: 'Model',
        rows: [
          [10, 20, { f: '=A1*1.08', v: 10.8 }],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const issues = hardcodedNumbers.run(wb);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0]!.description).toContain('1.08');
  });

  it('ignores allowed constants and cell-row digits', () => {
    const buf = buildWorkbookBuffer([
      {
        name: 'Model',
        rows: [
          [1, 2, { f: '=B12*2', v: 4 }],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const issues = hardcodedNumbers.run(wb);
    expect(issues).toHaveLength(0);
  });
});

describe('circularRefs', () => {
  it('detects a two-cell cycle', () => {
    const buf = buildWorkbookBuffer([
      {
        name: 'Loop',
        rows: [
          [{ f: '=B1', v: 0 }, { f: '=A1', v: 0 }],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const issues = circularRefs.run(wb);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0]!.severity).toBe('CRITICAL');
  });

  it('ignores cross-sheet references (no false self-loops)', () => {
    // Sheet1!A1 = Sheet2!B1; Sheet2!B1 = 42.
    // After stripping cross-sheet refs, Sheet1!A1's formula has no intra-sheet
    // refs, so there is no cycle.
    const buf = buildWorkbookBuffer([
      {
        name: 'Sheet1',
        rows: [
          [{ f: '=Sheet2!B1', v: 42 }],
        ],
      },
      {
        name: 'Sheet2',
        rows: [
          [null, 42],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const issues = circularRefs.run(wb);
    expect(issues).toHaveLength(0);
  });

  it('ignores quoted cross-sheet references with spaces', () => {
    // 'Revenue Build'!B3 used to be wrongly parsed as a local B3 reference,
    // producing a B3 -> B3 self-loop. Confirm this is fixed.
    const buf = buildWorkbookBuffer([
      {
        name: 'Revenue Build',
        rows: [
          [null, null, null],
          [null, null, null],
          [null, 100, 110],
        ],
      },
      {
        name: 'DCF',
        rows: [
          [null, null, null],
          [
            null,
            { f: "='Revenue Build'!B3*Assumptions!B8", v: 100 },
            { f: "='Revenue Build'!C3*Assumptions!B8", v: 110 },
          ],
        ],
      },
      {
        name: 'Assumptions',
        rows: [
          [null, null],
          [null, null],
          [null, null],
          [null, null],
          [null, null],
          [null, null],
          [null, null],
          [null, 0.05],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const issues = circularRefs.run(wb);
    expect(issues).toHaveLength(0);
  });
});

describe('formulaConsistency', () => {
  it('flags the odd-one-out formula in a row', () => {
    const buf = buildWorkbookBuffer([
      {
        name: 'Calc',
        rows: [
          [
            10,
            20,
            30,
            40,
            { f: '=A1*1.1', v: 11 },
            { f: '=B1*1.1', v: 22 },
            { f: '=C1*1.1', v: 33 },
            { f: '=D1+5', v: 45 },
          ],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const issues = formulaConsistency.run(wb);
    const outliers = issues.filter((i) => i.description.includes('D1+5'));
    expect(outliers.length).toBeGreaterThanOrEqual(1);
  });

  it('only compares contiguous formula runs (no false positives across gaps)', () => {
    // Row with formulas in columns B,C,D (one run) and column G (separate run
    // of 1). The G formula is structurally different (SUM vs. multiplication)
    // but it lives in its own run, so it should NOT be flagged.
    const buf = buildWorkbookBuffer([
      {
        name: 'Calc',
        rows: [
          [
            'Label',
            { f: '=B1*B2', v: 10 },
            { f: '=C1*C2', v: 20 },
            { f: '=D1*D2', v: 30 },
            null,
            null,
            { f: '=SUM(B1:D1)', v: 60 },
          ],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const issues = formulaConsistency.run(wb);
    expect(issues).toHaveLength(0);
  });
});

describe('emptyOutputs', () => {
  it('flags isolated empty cells between populated neighbors', () => {
    const buf = buildWorkbookBuffer([
      {
        name: 'Summary',
        rows: [
          ['Revenue', 100, null, 110, 120],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const issues = emptyOutputs.run(wb);
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });
});

describe('excessiveHardcodes', () => {
  it('flags rows dominated by hardcoded numbers on calc sheets', () => {
    const buf = buildWorkbookBuffer([
      {
        name: 'Calc',
        rows: [
          [101, 202, 303, 404, 505],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const issues = excessiveHardcodes.run(wb);
    expect(issues.length).toBe(1);
    expect(issues[0]!.severity).toBe('LOW');
  });
});

describe('valueJumps', () => {
  it('flags >3x adjacent ratios in an output row', () => {
    const buf = buildWorkbookBuffer([
      {
        name: 'Returns',
        rows: [
          ['Cash', 100, 110, 1000, 1050],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const issues = valueJumps.run(wb);
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });
});

describe('sheetStructure', () => {
  it('flags missing categories', () => {
    const buf = buildWorkbookBuffer([
      { name: 'Sheet1', rows: [[1, 2, 3]] },
    ]);
    const wb = parseWorkbook(buf);
    const issues = sheetStructure.run(wb);
    expect(issues.length).toBe(3);
  });

  it('passes when all three categories are present', () => {
    const buf = buildWorkbookBuffer([
      { name: 'Assumptions', rows: [['x', 1]] },
      { name: 'DCF', rows: [['y', 2]] },
      { name: 'Outputs', rows: [['z', 3]] },
    ]);
    const wb = parseWorkbook(buf);
    const issues = sheetStructure.run(wb);
    expect(issues).toHaveLength(0);
  });
});

describe('undocumentedAssumptions', () => {
  it('flags unlabeled numeric assumption cells', () => {
    const buf = buildWorkbookBuffer([
      {
        name: 'Assumptions',
        rows: [
          [null, null, 0.07],
        ],
      },
    ]);
    const wb = parseWorkbook(buf);
    const issues = undocumentedAssumptions.run(wb);
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });
});
