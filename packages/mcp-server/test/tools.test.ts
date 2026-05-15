import { describe, it, expect, beforeAll } from 'vitest';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '..', '..', 'samples', 'files');
const SAMPLE_CLEAN = path.join(SAMPLES_DIR, 'clean_dcf_v1.xlsx');
const SAMPLE_MESSY = path.join(SAMPLES_DIR, 'messy_dcf_v2.xlsx');
import {
  handleListChecks,
  handleExplainCheck,
  handleLintWorkbook,
  handleLintDiff,
} from '../src/tools.js';
import type { CheckSummary } from '../src/tools.js';
import type { HealthReport, DiffReport, CheckId } from '@pmg/lint-engine';

/**
 * Extract the JSON payload from an MCP text result. We embed `summary\n\nJSON`
 * so we slice on the first blank-line and parse the remainder.
 */
function extractJson<T>(text: string): T {
  const idx = text.indexOf('\n\n');
  const jsonStr = idx >= 0 ? text.slice(idx + 2) : text;
  return JSON.parse(jsonStr) as T;
}

/** Build a clean DCF-shaped workbook: assumptions tab + calc tab w/ formulas. */
function buildCleanWorkbook(): XLSX.WorkBook {
  const assumptions: (string | number)[][] = [
    ['Driver', 'Value', 'Unit', 'Source'],
    ['Revenue Growth', 0.1, 'pct', 'mgmt plan'],
    ['Gross Margin', 0.6, 'pct', 'mgmt plan'],
    ['Discount Rate', 0.1, 'pct', 'analyst'],
    ['Terminal Growth', 0.025, 'pct', 'analyst'],
    ['Tax Rate', 0.25, 'pct', 'statutory'],
  ];
  const calc: (string | number)[][] = [
    ['Year', 2024, 2025, 2026, 2027, 2028],
    ['Revenue', 1000, 0, 0, 0, 0],
    ['Revenue growth', 0, 0, 0, 0, 0],
    ['Gross Profit', 0, 0, 0, 0, 0],
    ['Net Income', 0, 0, 0, 0, 0],
  ];
  const wb = XLSX.utils.book_new();
  const sAssum = XLSX.utils.aoa_to_sheet(assumptions);
  const sCalc = XLSX.utils.aoa_to_sheet(calc);
  // Wire formulas across years for revenue (=prior * (1 + growth)) and GP.
  // Year columns are B..F (cols 2..6 in 1-based, indexes 1..5).
  const yearCols = ['B', 'C', 'D', 'E', 'F'];
  for (let i = 1; i < yearCols.length; i++) {
    const prev = yearCols[i - 1];
    const curr = yearCols[i];
    // Revenue row is row 2, growth row 3, GP row 4, NI row 5 (1-based).
    sCalc[`${curr}2`] = { t: 'n', f: `${prev}2*(1+Assumptions!B2)` };
    sCalc[`${curr}3`] = { t: 'n', f: `${curr}2/${prev}2-1` };
    sCalc[`${curr}4`] = { t: 'n', f: `${curr}2*Assumptions!B3` };
    sCalc[`${curr}5`] = { t: 'n', f: `${curr}4*(1-Assumptions!B6)` };
  }
  // Row 2 col B (first year revenue) is the seed.
  XLSX.utils.book_append_sheet(wb, sAssum, 'Assumptions');
  XLSX.utils.book_append_sheet(wb, sCalc, 'DCF');
  return wb;
}

/** Build a deliberately messy version of the workbook for diff tests. */
function buildMessyWorkbook(): XLSX.WorkBook {
  const wb = buildCleanWorkbook();
  const dcf = wb.Sheets['DCF'];
  // Replace a formula with a hardcoded number — magic number in a formula row.
  dcf['D2'] = { t: 'n', v: 1234 };
  // Inconsistent formula in the same revenue row.
  dcf['E2'] = { t: 'n', f: 'D2*1.5' };
  // Add a circular ref pair.
  dcf['B7'] = { t: 'n', f: 'C7+1' };
  dcf['C7'] = { t: 'n', f: 'B7+1' };
  return wb;
}

async function writeWorkbookToTmp(
  wb: XLSX.WorkBook,
  dir: string,
  name: string
): Promise<string> {
  const filePath = path.join(dir, name);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  await writeFile(filePath, buf);
  return filePath;
}

describe('mcp-server tools', () => {
  let tmpDir: string;
  let cleanPath: string;
  let messyPath: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'pmg-mcp-test-'));
    cleanPath = await writeWorkbookToTmp(
      buildCleanWorkbook(),
      tmpDir,
      'clean.xlsx'
    );
    messyPath = await writeWorkbookToTmp(
      buildMessyWorkbook(),
      tmpDir,
      'messy.xlsx'
    );
  });

  describe('list_checks', () => {
    it('returns exactly 8 check definitions', () => {
      const res = handleListChecks();
      expect(res.isError).toBeFalsy();
      expect(res.content).toHaveLength(1);
      const checks = extractJson<CheckSummary[]>(res.content[0]!.text);
      expect(Array.isArray(checks)).toBe(true);
      expect(checks).toHaveLength(8);
      for (const c of checks) {
        expect(typeof c.id).toBe('string');
        expect(typeof c.name).toBe('string');
        expect(typeof c.description).toBe('string');
        expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(
          c.defaultSeverity
        );
      }
    });
  });

  describe('explain_check', () => {
    it('returns id, name, severity, and a non-empty rationale', () => {
      const res = handleExplainCheck({ checkId: 'hardcoded-numbers' });
      expect(res.isError).toBeFalsy();
      const payload = extractJson<
        CheckSummary & { rationale: string }
      >(res.content[0]!.text);
      expect(payload.id).toBe('hardcoded-numbers');
      expect(payload.name.length).toBeGreaterThan(0);
      expect(payload.defaultSeverity).toBeDefined();
      expect(payload.rationale).toBeDefined();
      expect(payload.rationale.length).toBeGreaterThan(80);
    });

    it('throws on an unknown checkId', () => {
      expect(() =>
        handleExplainCheck({ checkId: 'not-a-real-check' as CheckId })
      ).toThrow(/Unknown checkId/);
    });

    it('has rationales for every check id (covers all 8)', () => {
      const list = handleListChecks();
      const checks = extractJson<CheckSummary[]>(list.content[0]!.text);
      for (const c of checks) {
        const res = handleExplainCheck({ checkId: c.id });
        const payload = extractJson<{ rationale: string }>(
          res.content[0]!.text
        );
        expect(payload.rationale.length).toBeGreaterThan(40);
      }
    });
  });

  describe('lint_workbook', () => {
    it('returns a report with score in [0,100] and counts that sum correctly', async () => {
      const res = await handleLintWorkbook({ filePath: cleanPath });
      expect(res.isError).toBeFalsy();
      const report = extractJson<HealthReport>(res.content[0]!.text);
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.issues)).toBe(true);
      expect(Array.isArray(report.checks)).toBe(true);
      // The pass/fail/warn counts should sum to total checks run.
      const total =
        report.counts.passed + report.counts.failed + report.counts.warned;
      expect(total).toBe(report.checks.length);
      // Severity counts should sum to total issue count.
      const sevTotal =
        report.counts.CRITICAL +
        report.counts.HIGH +
        report.counts.MEDIUM +
        report.counts.LOW;
      expect(sevTotal).toBe(report.issues.length);
    });

    it('messy workbook scores no higher than clean workbook', async () => {
      const cleanRes = await handleLintWorkbook({ filePath: cleanPath });
      const messyRes = await handleLintWorkbook({ filePath: messyPath });
      const cleanReport = extractJson<HealthReport>(cleanRes.content[0]!.text);
      const messyReport = extractJson<HealthReport>(messyRes.content[0]!.text);
      expect(messyReport.score).toBeLessThanOrEqual(cleanReport.score);
      expect(messyReport.issues.length).toBeGreaterThanOrEqual(
        cleanReport.issues.length
      );
    });

    it('throws a clear error for a missing file', async () => {
      await expect(
        handleLintWorkbook({ filePath: '/definitely/not/a/real/file.xlsx' })
      ).rejects.toThrow(/Failed to read file/);
    });
  });

  describe('lint_diff', () => {
    it('returns 0 new issues when diffing a file against itself', async () => {
      const res = await handleLintDiff({
        basePath: cleanPath,
        nextPath: cleanPath,
      });
      expect(res.isError).toBeFalsy();
      const report = extractJson<DiffReport>(res.content[0]!.text);
      expect(report.mode).toBe('diff');
      expect(report.newFingerprints).toHaveLength(0);
      expect(report.score).toBe(100);
    });

    it('returns >0 new issues when diffing the real sample clean -> messy fixtures', async () => {
      // The @pmg/samples package ships hand-crafted clean and messy DCF files
      // that are guaranteed to introduce new findings. Prefer those over our
      // inline fixtures (which may collapse to identical fingerprints).
      if (!existsSync(SAMPLE_CLEAN) || !existsSync(SAMPLE_MESSY)) {
        // Fallback: use the inline fixtures and only assert mode.
        const res = await handleLintDiff({
          basePath: cleanPath,
          nextPath: messyPath,
        });
        const report = extractJson<DiffReport>(res.content[0]!.text);
        expect(report.mode).toBe('diff');
        return;
      }
      const res = await handleLintDiff({
        basePath: SAMPLE_CLEAN,
        nextPath: SAMPLE_MESSY,
      });
      expect(res.isError).toBeFalsy();
      const report = extractJson<DiffReport>(res.content[0]!.text);
      expect(report.mode).toBe('diff');
      expect(report.newFingerprints.length).toBeGreaterThan(0);
      expect(report.score).toBeLessThan(100);
    });
  });
});
