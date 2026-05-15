#!/usr/bin/env node
/**
 * stress.mjs — adversarial fixture stress test for the lint engine.
 *
 * Generates ~24 edge-case xlsx workbooks programmatically and exercises
 * parseWorkbook + lintWorkbook (+ lintDiff) on each, reporting per-fixture:
 *   - parsed?  linted?  duration-ms  score  total-issues  per-check counts  error
 *
 * A fixture is considered HANG if it exceeds STRESS_TIMEOUT_MS (default 5000ms)
 * of wall-clock time.
 *
 * Usage:
 *   npm run build -w @pmg/lint-engine   # ensure dist/ is fresh
 *   node packages/lint-engine/scripts/stress.mjs
 *
 * Exits non-zero if any fixture CRASHes or HANGs.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TIMEOUT_MS = Number(process.env.STRESS_TIMEOUT_MS ?? 5000);

const { parseWorkbook, lintWorkbook, lintDiff } = await import(
  join(__dirname, '..', 'dist', 'index.js')
);

// ────────────────────────────────────────────────────────────────────
// Fixture builders. Each returns { name, expectation, buf }.
// ────────────────────────────────────────────────────────────────────

/** Write a workbook to a Uint8Array buffer. */
function write(wb) {
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellFormula: true });
  if (out instanceof Uint8Array) return out;
  if (out instanceof ArrayBuffer) return new Uint8Array(out);
  return new Uint8Array(out);
}

function fixtures() {
  const list = [];

  // 1. empty workbook — single sheet, no cells.
  list.push({
    name: '01-empty-workbook',
    expectation: 'parses, ~0 issues besides sheet-structure',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      return write(wb);
    },
  });

  // 2. single cell — one number in A1.
  list.push({
    name: '02-single-cell',
    expectation: 'parses cleanly',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([[42]]);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      return write(wb);
    },
  });

  // 3. single sheet with only labels (no numbers, no formulas).
  list.push({
    name: '03-labels-only',
    expectation: 'parses cleanly',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['Revenue', 'COGS', 'EBITDA'],
        ['Year 1', 'Year 2', 'Year 3'],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Labels');
      return write(wb);
    },
  });

  // 4. only formulas, no precomputed values.
  list.push({
    name: '04-only-formulas-no-values',
    expectation: 'parses; hardcoded-numbers may flag if formula has literals',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = {};
      ws['A1'] = { t: 'n', f: 'A2+1' };
      ws['A2'] = { t: 'n', f: 'A3+1' };
      ws['A3'] = { t: 'n', f: 'A4+1' };
      ws['A4'] = { t: 'n', f: 'A5+1' };
      ws['A5'] = { t: 'n', f: 'A6+1' };
      ws['A6'] = { t: 'n', f: 'A7+1' };
      ws['A7'] = { t: 'n', f: 'A8+1' };
      ws['!ref'] = 'A1:A7';
      XLSX.utils.book_append_sheet(wb, ws, 'Model');
      return write(wb);
    },
  });

  // 5. only values, no formulas — pure data.
  list.push({
    name: '05-only-values',
    expectation: 'parses cleanly; excessive-hardcodes may flag rows',
    build() {
      const wb = XLSX.utils.book_new();
      const data = [];
      for (let r = 0; r < 10; r++) {
        data.push([r, r * 2, r * 3, r * 4, r * 5]);
      }
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      return write(wb);
    },
  });

  // 6. very wide sheet — 1 row, 200 columns of formulas.
  list.push({
    name: '06-very-wide',
    expectation: 'parses without hanging, finite time',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = {};
      // Row 1: numbers in row 1
      // Row 2: formulas referencing row 1
      for (let c = 0; c < 200; c++) {
        const addr1 = XLSX.utils.encode_cell({ r: 0, c });
        const addr2 = XLSX.utils.encode_cell({ r: 1, c });
        ws[addr1] = { t: 'n', v: c + 1 };
        ws[addr2] = { t: 'n', v: (c + 1) * 2, f: `${addr1}*2` };
      }
      ws['!ref'] = `A1:${XLSX.utils.encode_cell({ r: 1, c: 199 })}`;
      XLSX.utils.book_append_sheet(wb, ws, 'Wide');
      return write(wb);
    },
  });

  // 7. very tall sheet — 5000 rows, 5 cols.
  list.push({
    name: '07-very-tall',
    expectation: 'parses in <5s',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = {};
      for (let r = 0; r < 5000; r++) {
        for (let c = 0; c < 5; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (c === 0) ws[addr] = { t: 'n', v: r };
          else {
            const left = XLSX.utils.encode_cell({ r, c: c - 1 });
            ws[addr] = { t: 'n', v: r * (c + 1), f: `${left}+1` };
          }
        }
      }
      ws['!ref'] = `A1:${XLSX.utils.encode_cell({ r: 4999, c: 4 })}`;
      XLSX.utils.book_append_sheet(wb, ws, 'Tall');
      return write(wb);
    },
  });

  // 8. deeply nested formula — 50+ refs and operators.
  list.push({
    name: '08-deep-formula',
    expectation: 'parses; no crash on long formula',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = {};
      // Row 1: 60 numeric cells.
      const parts = [];
      for (let c = 0; c < 60; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        ws[addr] = { t: 'n', v: c + 1 };
        parts.push(addr);
      }
      const formula = parts.join('+');
      ws['A2'] = { t: 'n', v: 1830, f: formula };
      ws['!ref'] = `A1:${XLSX.utils.encode_cell({ r: 1, c: 59 })}`;
      XLSX.utils.book_append_sheet(wb, ws, 'Deep');
      return write(wb);
    },
  });

  // 9. unicode in sheet names.
  list.push({
    name: '09-unicode-sheet-names',
    expectation: 'parses; sheet names preserved',
    build() {
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet([[1, 2, 3]]);
      const ws2 = XLSX.utils.aoa_to_sheet([['hello', 'world']]);
      XLSX.utils.book_append_sheet(wb, ws1, '测试');
      XLSX.utils.book_append_sheet(wb, ws2, 'Assumptions ✓');
      return write(wb);
    },
  });

  // 10. unicode in cell values.
  list.push({
    name: '10-unicode-cell-values',
    expectation: 'parses; non-ASCII strings preserved',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['名称', '数値', 'Растущий', 'مرحبا'],
        ['αβγ', 100, 200, 300],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Unicode');
      return write(wb);
    },
  });

  // 11. error cells — #DIV/0!, #REF!, #N/A.
  list.push({
    name: '11-error-cells',
    expectation: 'parses; error cells should not crash',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = {};
      ws['A1'] = { t: 'e', v: 0x07 }; // #DIV/0!
      ws['B1'] = { t: 'e', v: 0x17 }; // #N/A
      ws['C1'] = { t: 'e', v: 0x18 }; // #NAME?
      ws['D1'] = { t: 'e', v: 0x23 }; // #REF!
      ws['A2'] = { t: 'n', v: 1 };
      ws['!ref'] = 'A1:D2';
      XLSX.utils.book_append_sheet(wb, ws, 'Errors');
      return write(wb);
    },
  });

  // 12. boolean cells.
  list.push({
    name: '12-boolean-cells',
    expectation: 'parses; booleans handled',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = {};
      ws['A1'] = { t: 'b', v: true };
      ws['B1'] = { t: 'b', v: false };
      ws['C1'] = { t: 'b', v: true, f: 'A1=B1' };
      ws['!ref'] = 'A1:C1';
      XLSX.utils.book_append_sheet(wb, ws, 'Bools');
      return write(wb);
    },
  });

  // 13. date cells.
  list.push({
    name: '13-date-cells',
    expectation: 'parses; date Date objects coerced to text or number',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        [new Date(2026, 0, 1), new Date(2026, 1, 1)],
      ], { cellDates: true });
      XLSX.utils.book_append_sheet(wb, ws, 'Dates');
      return write(wb);
    },
  });

  // 14. percentage formatted cells.
  list.push({
    name: '14-percent-cells',
    expectation: 'parses; 0.05 etc. stay as numbers',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = {};
      ws['A1'] = { t: 'n', v: 0.05, z: '0%' };
      ws['A2'] = { t: 'n', v: 0.10, z: '0%' };
      ws['A3'] = { t: 'n', v: 0.15, z: '0%' };
      ws['!ref'] = 'A1:A3';
      XLSX.utils.book_append_sheet(wb, ws, 'Pct');
      return write(wb);
    },
  });

  // 15. circular ref — 10-cell chain (A1->A2->...->A10->A1).
  list.push({
    name: '15-circular-10-chain',
    expectation: 'parses; circular-refs detects 1 cycle, terminates',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = {};
      for (let r = 0; r < 10; r++) {
        const cur = XLSX.utils.encode_cell({ r, c: 0 });
        const next = XLSX.utils.encode_cell({ r: (r + 1) % 10, c: 0 });
        ws[cur] = { t: 'n', v: 0, f: `${next}+1` };
      }
      ws['!ref'] = 'A1:A10';
      XLSX.utils.book_append_sheet(wb, ws, 'Cycle');
      return write(wb);
    },
  });

  // 16. self-referencing cell — A1 = A1.
  list.push({
    name: '16-self-ref',
    expectation: 'parses; circular-refs detects self-loop',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = {};
      ws['A1'] = { t: 'n', v: 0, f: 'A1' };
      ws['!ref'] = 'A1:A1';
      XLSX.utils.book_append_sheet(wb, ws, 'Self');
      return write(wb);
    },
  });

  // 17. formula referencing non-existent cell.
  list.push({
    name: '17-ref-to-nowhere',
    expectation: 'parses; references to out-of-range cells do not crash',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = {};
      ws['A1'] = { t: 'n', v: 0, f: 'Z99+1' };
      ws['B1'] = { t: 'n', v: 1 };
      ws['!ref'] = 'A1:B1';
      XLSX.utils.book_append_sheet(wb, ws, 'Dangling');
      return write(wb);
    },
  });

  // 18. sheet names with single-quote in formulas.
  list.push({
    name: '18-sheet-with-quote',
    expectation: 'parses; quoted-sheet refs do not corrupt circular-ref detection',
    build() {
      const wb = XLSX.utils.book_new();
      const ws1 = {};
      ws1['A1'] = { t: 'n', v: 100 };
      ws1['!ref'] = 'A1:A1';
      const ws2 = {};
      ws2['A1'] = { t: 'n', v: 200, f: "'With Spaces'!A1*2" };
      ws2['!ref'] = 'A1:A1';
      XLSX.utils.book_append_sheet(wb, ws1, 'With Spaces');
      XLSX.utils.book_append_sheet(wb, ws2, 'Main');
      return write(wb);
    },
  });

  // 19. formula with whitespace and newlines.
  list.push({
    name: '19-whitespace-formula',
    expectation: 'parses; whitespace formula does not crash',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = {};
      ws['A1'] = { t: 'n', v: 1 };
      ws['A2'] = { t: 'n', v: 2 };
      ws['A3'] = { t: 'n', v: 3, f: ' A1 \n+ A2 ' };
      ws['!ref'] = 'A1:A3';
      XLSX.utils.book_append_sheet(wb, ws, 'WS');
      return write(wb);
    },
  });

  // 20. defined names / named ranges — best-effort.
  list.push({
    name: '20-named-range',
    expectation: 'parses; named refs are not local cells so should not break circular-refs',
    build() {
      const wb = XLSX.utils.book_new();
      const ws1 = {};
      ws1['A1'] = { t: 'n', v: 0.10 };
      ws1['!ref'] = 'A1:A1';
      const ws2 = {};
      ws2['A1'] = { t: 'n', v: 100 };
      ws2['B1'] = { t: 'n', v: 110, f: 'A1*(1+GrowthRate)' };
      ws2['!ref'] = 'A1:B1';
      XLSX.utils.book_append_sheet(wb, ws1, 'Assumptions');
      XLSX.utils.book_append_sheet(wb, ws2, 'Model');
      wb.Workbook = wb.Workbook ?? {};
      wb.Workbook.Names = [{ Name: 'GrowthRate', Ref: "'Assumptions'!$A$1" }];
      return write(wb);
    },
  });

  // 21. merged cells.
  list.push({
    name: '21-merged-cells',
    expectation: 'parses; merge ranges do not crash',
    build() {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['Header Spanning Cols', null, null],
        [1, 2, 3],
      ]);
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
      XLSX.utils.book_append_sheet(wb, ws, 'Merges');
      return write(wb);
    },
  });

  // 22. hidden sheet.
  list.push({
    name: '22-hidden-sheet',
    expectation: 'parses; hidden sheet still included',
    build() {
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet([['visible', 1]]);
      const ws2 = XLSX.utils.aoa_to_sheet([['secret', 999]]);
      XLSX.utils.book_append_sheet(wb, ws1, 'Visible');
      XLSX.utils.book_append_sheet(wb, ws2, 'Hidden');
      wb.Workbook = wb.Workbook ?? {};
      wb.Workbook.Sheets = [
        { name: 'Visible', Hidden: 0 },
        { name: 'Hidden', Hidden: 1 },
      ];
      return write(wb);
    },
  });

  // 23. clean realistic DCF.
  list.push({
    name: '23-clean-dcf',
    expectation: 'score >= 90, low false-positives',
    build() {
      const wb = XLSX.utils.book_new();
      // Assumptions
      const assump = {};
      assump['A1'] = { t: 's', v: 'Driver' };
      assump['B1'] = { t: 's', v: 'Value' };
      assump['A2'] = { t: 's', v: 'Revenue growth' };
      assump['B2'] = { t: 'n', v: 0.08 };
      assump['A3'] = { t: 's', v: 'COGS % of revenue' };
      assump['B3'] = { t: 'n', v: 0.4 };
      assump['A4'] = { t: 's', v: 'Tax rate' };
      assump['B4'] = { t: 'n', v: 0.25 };
      assump['A5'] = { t: 's', v: 'Discount rate' };
      assump['B5'] = { t: 'n', v: 0.10 };
      assump['!ref'] = 'A1:B5';
      XLSX.utils.book_append_sheet(wb, assump, 'Assumptions');

      // DCF Model — rows for revenue, COGS, EBITDA across 5 years.
      const dcf = {};
      dcf['A1'] = { t: 's', v: 'Line item' };
      dcf['B1'] = { t: 's', v: 'Y1' };
      dcf['C1'] = { t: 's', v: 'Y2' };
      dcf['D1'] = { t: 's', v: 'Y3' };
      dcf['E1'] = { t: 's', v: 'Y4' };
      dcf['F1'] = { t: 's', v: 'Y5' };
      dcf['A2'] = { t: 's', v: 'Revenue' };
      dcf['B2'] = { t: 'n', v: 1000 };
      // Y2..Y5 = previous * (1+growth)
      for (let c = 2; c < 6; c++) {
        const prev = XLSX.utils.encode_cell({ r: 1, c: c - 1 });
        const cur = XLSX.utils.encode_cell({ r: 1, c });
        dcf[cur] = { t: 'n', v: 1000 * Math.pow(1.08, c - 1), f: `${prev}*(1+Assumptions!$B$2)` };
      }
      dcf['A3'] = { t: 's', v: 'COGS' };
      for (let c = 1; c < 6; c++) {
        const rev = XLSX.utils.encode_cell({ r: 1, c });
        const cur = XLSX.utils.encode_cell({ r: 2, c });
        dcf[cur] = { t: 'n', v: 400, f: `${rev}*Assumptions!$B$3` };
      }
      dcf['A4'] = { t: 's', v: 'EBITDA' };
      for (let c = 1; c < 6; c++) {
        const rev = XLSX.utils.encode_cell({ r: 1, c });
        const cogs = XLSX.utils.encode_cell({ r: 2, c });
        const cur = XLSX.utils.encode_cell({ r: 3, c });
        dcf[cur] = { t: 'n', v: 600, f: `${rev}-${cogs}` };
      }
      dcf['!ref'] = 'A1:F4';
      XLSX.utils.book_append_sheet(wb, dcf, 'DCF');

      // Summary output.
      const sm = {};
      sm['A1'] = { t: 's', v: 'Metric' };
      sm['B1'] = { t: 's', v: 'Value' };
      sm['A2'] = { t: 's', v: 'Total revenue Y1-Y5' };
      sm['B2'] = { t: 'n', v: 5867, f: 'SUM(DCF!B2:F2)' };
      sm['A3'] = { t: 's', v: 'Total EBITDA Y1-Y5' };
      sm['B3'] = { t: 'n', v: 3520, f: 'SUM(DCF!B4:F4)' };
      sm['!ref'] = 'A1:B3';
      XLSX.utils.book_append_sheet(wb, sm, 'Summary');
      return write(wb);
    },
  });

  // 24. self-diff — same workbook diffed against itself.
  list.push({
    name: '24-self-diff',
    expectation: 'lintDiff(x, x) returns 0 new fingerprints',
    isDiff: true,
    build() {
      // Reuse fixture #23.
      return list.find((f) => f.name === '23-clean-dcf').build();
    },
  });

  return list;
}

// ────────────────────────────────────────────────────────────────────
// Runner.
// ────────────────────────────────────────────────────────────────────

function runWithTimeout(fn) {
  const start = performance.now();
  let result, error;
  try {
    result = fn();
  } catch (e) {
    error = e;
  }
  const duration = performance.now() - start;
  return { result, error, duration };
}

function summarize(report) {
  const perCheck = {};
  for (const ch of report.checks) perCheck[ch.id] = ch.issues.length;
  return perCheck;
}

function fmtPerCheck(perCheck) {
  return Object.entries(perCheck)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}=${n}`)
    .join(',') || '-';
}

const fxs = fixtures();
console.log(`\nStress test: ${fxs.length} fixtures, timeout=${TIMEOUT_MS}ms\n`);

const rows = [];
let pass = 0, fail = 0, hang = 0;

for (const fx of fxs) {
  let parsed = false, linted = false, score = '-', issueCount = '-', perCheckStr = '-';
  let error = null, durMs = 0;
  let hung = false;

  // Build the buffer.
  let buf;
  try {
    buf = fx.build();
  } catch (e) {
    error = `build failed: ${e.message}`;
    rows.push({ name: fx.name, parsed, linted, durMs, score, issueCount, perCheckStr, error });
    fail++;
    continue;
  }

  // Parse.
  const start = performance.now();
  let wb;
  try {
    wb = parseWorkbook(buf);
    parsed = true;
  } catch (e) {
    error = `parse: ${e.message}`;
    durMs = performance.now() - start;
    if (durMs > TIMEOUT_MS) { hung = true; hang++; } else { fail++; }
    rows.push({ name: fx.name, parsed, linted, durMs, score, issueCount, perCheckStr, error });
    continue;
  }

  // Lint (or diff).
  try {
    if (fx.isDiff) {
      const report = lintDiff(wb, wb);
      linted = true;
      score = report.score;
      issueCount = `new=${report.newFingerprints.length}`;
      perCheckStr = `resolved=${report.resolvedFingerprints.length},unchanged=${report.unchangedFingerprints.length}`;
      // Validate: self-diff must return 0 new.
      if (report.newFingerprints.length !== 0) {
        error = `self-diff returned ${report.newFingerprints.length} new fingerprints (expected 0)`;
      }
    } else {
      const report = lintWorkbook(wb);
      linted = true;
      score = report.score;
      issueCount = report.issues.length;
      perCheckStr = fmtPerCheck(summarize(report));
    }
  } catch (e) {
    error = `lint: ${e.message}`;
  }
  durMs = performance.now() - start;

  if (durMs > TIMEOUT_MS) {
    hung = true;
    hang++;
    error = `hang: ${durMs.toFixed(0)}ms > ${TIMEOUT_MS}ms${error ? '; ' + error : ''}`;
  } else if (error) {
    fail++;
  } else {
    pass++;
  }

  rows.push({ name: fx.name, parsed, linted, durMs, score, issueCount, perCheckStr, error });
}

// Print table.
const colW = {
  name: 28,
  parsed: 7,
  linted: 7,
  dur: 9,
  score: 6,
  issues: 9,
  perCheck: 60,
};

function pad(s, w) {
  s = String(s);
  if (s.length >= w) return s.slice(0, w);
  return s + ' '.repeat(w - s.length);
}

console.log(
  pad('fixture', colW.name),
  pad('parsed?', colW.parsed),
  pad('linted?', colW.linted),
  pad('dur(ms)', colW.dur),
  pad('score', colW.score),
  pad('issues', colW.issues),
  pad('per-check', colW.perCheck),
  'error',
);
console.log('-'.repeat(140));
for (const r of rows) {
  console.log(
    pad(r.name, colW.name),
    pad(r.parsed ? 'yes' : 'NO', colW.parsed),
    pad(r.linted ? 'yes' : 'NO', colW.linted),
    pad(r.durMs.toFixed(1), colW.dur),
    pad(r.score, colW.score),
    pad(r.issueCount, colW.issues),
    pad(r.perCheckStr, colW.perCheck),
    r.error ?? '',
  );
}

console.log('\nSummary');
console.log(`  PASS: ${pass}`);
console.log(`  FAIL: ${fail}`);
console.log(`  HANG: ${hang}`);

if (fail > 0 || hang > 0) {
  console.log('\nFailures / hangs:');
  for (const r of rows) {
    if (r.error) console.log(`  ${r.name}: ${r.error}`);
  }
  process.exit(1);
}
console.log('\nAll stress fixtures green.');
