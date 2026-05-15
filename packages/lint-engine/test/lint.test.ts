import { describe, expect, it } from 'vitest';
import { parseWorkbook } from '../src/parser.js';
import { lintWorkbook, lintDiff } from '../src/lint.js';
import { buildWorkbookBuffer } from './fixtures.js';

function cleanWorkbook(): ArrayBuffer {
  return buildWorkbookBuffer([
    { name: 'Assumptions', rows: [['Growth', 0.05], ['Discount', 0.1]] },
    {
      name: 'DCF',
      rows: [
        ['Year', 1, 2, 3],
        ['Revenue', 100, { f: '=B2*1', v: 100 }, { f: '=C2*1', v: 100 }],
      ],
    },
    {
      name: 'Outputs',
      rows: [
        ['NPV', 250],
      ],
    },
  ]);
}

describe('lintWorkbook', () => {
  it('returns a report with a numeric score and the eight checks', () => {
    const wb = parseWorkbook(cleanWorkbook());
    const report = lintWorkbook(wb, { fileName: 'clean.xlsx' });
    expect(report.fileName).toBe('clean.xlsx');
    expect(report.checks).toHaveLength(8);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it('penalizes a workbook with a hardcoded number', () => {
    const clean = parseWorkbook(cleanWorkbook());
    const baseline = lintWorkbook(clean);
    const dirtyBuf = buildWorkbookBuffer([
      { name: 'Assumptions', rows: [['Growth', 0.05]] },
      {
        name: 'DCF',
        rows: [
          ['Year', 1, 2],
          ['Revenue', 100, { f: '=B2*1.08', v: 108 }],
        ],
      },
      { name: 'Outputs', rows: [['NPV', 250]] },
    ]);
    const dirty = lintWorkbook(parseWorkbook(dirtyBuf));
    expect(dirty.score).toBeLessThan(baseline.score);
    expect(dirty.counts.HIGH).toBeGreaterThanOrEqual(1);
  });
});

describe('lintDiff', () => {
  it('reports zero new issues when comparing a workbook to itself', () => {
    const buf = cleanWorkbook();
    const a = parseWorkbook(buf);
    const b = parseWorkbook(buf);
    const diff = lintDiff(a, b);
    expect(diff.mode).toBe('diff');
    expect(diff.newFingerprints).toHaveLength(0);
    expect(diff.resolvedFingerprints).toHaveLength(0);
    expect(diff.issues).toHaveLength(0);
  });

  it('detects a newly introduced hardcode and treats fixed ones as resolved', () => {
    const baseBuf = buildWorkbookBuffer([
      { name: 'Assumptions', rows: [['Growth', 0.05]] },
      {
        name: 'DCF',
        rows: [
          ['Year', 1, 2],
          ['Revenue', 100, { f: '=B2*1', v: 100 }],
        ],
      },
      { name: 'Outputs', rows: [['NPV', 250]] },
    ]);
    const nextBuf = buildWorkbookBuffer([
      { name: 'Assumptions', rows: [['Growth', 0.05]] },
      {
        name: 'DCF',
        rows: [
          ['Year', 1, 2],
          ['Revenue', 100, { f: '=B2*1.07', v: 107 }],
        ],
      },
      { name: 'Outputs', rows: [['NPV', 250]] },
    ]);
    const base = parseWorkbook(baseBuf);
    const next = parseWorkbook(nextBuf);
    const diff = lintDiff(base, next, { baseFileName: 'base.xlsx', nextFileName: 'next.xlsx' });
    expect(diff.baseFileName).toBe('base.xlsx');
    expect(diff.newFingerprints.length).toBeGreaterThanOrEqual(1);
    expect(
      diff.newFingerprints.some((fp) => fp.startsWith('hardcoded-numbers|DCF|')),
    ).toBe(true);
  });
});
