#!/usr/bin/env node
/**
 * audit-realworld.mjs — false-positive audit of the lint engine against real-world public models.
 *
 * Usage:
 *   node scripts/audit-realworld.mjs <dir-with-xlsx-files>
 *
 * For each file: prints lint summary + sample issues. Tries to surface the
 * exact formula being flagged so the human (you) can judge true/false-positive.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENGINE = join(ROOT, 'packages', 'lint-engine', 'dist', 'index.js');

const { parseWorkbook, lintWorkbook } = await import(ENGINE);

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/audit-realworld.mjs <dir>');
  process.exit(1);
}

const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.xlsx')).sort();

const N_SAMPLES = 8; // sample issues per file
const checkCounters = {}; // check -> {total, samples: [{file,sheet,cell,formula,desc}]}

function pickSamples(arr, n) {
  if (arr.length <= n) return arr;
  // Deterministic stride sample
  const out = [];
  const step = Math.max(1, Math.floor(arr.length / n));
  for (let i = 0; i < arr.length && out.length < n; i += step) out.push(arr[i]);
  return out;
}

function getCell(wb, sheetName, addr) {
  const sheet = wb.sheets.find((s) => s.name === sheetName);
  if (!sheet) return null;
  for (const row of sheet.cells) {
    for (const c of row) {
      if (c.address === addr) return c;
    }
  }
  return null;
}

function summarizeWorkbook(wb) {
  let formulas = 0;
  let numbers = 0;
  let texts = 0;
  for (const s of wb.sheets) {
    for (const row of s.cells) {
      for (const c of row) {
        if (c.type === 'formula') formulas++;
        else if (c.type === 'number') numbers++;
        else if (c.type === 'text') texts++;
      }
    }
  }
  return { formulas, numbers, texts };
}

const fileSummaries = [];

for (const f of files) {
  const path = join(dir, f);
  let buf;
  try {
    buf = await readFile(path);
  } catch (e) {
    console.log(`\n=== ${f} ===\n  read error: ${e.message}`);
    continue;
  }
  let wb, rep;
  try {
    wb = parseWorkbook(buf, f);
    rep = lintWorkbook(wb);
  } catch (e) {
    console.log(`\n=== ${f} ===\n  parse/lint error: ${e.message}`);
    continue;
  }

  const wbSummary = summarizeWorkbook(wb);

  // Per-check counts
  const perCheck = {};
  for (const issue of rep.issues) {
    perCheck[issue.checkId] = (perCheck[issue.checkId] ?? 0) + 1;
    checkCounters[issue.checkId] = checkCounters[issue.checkId] ?? { total: 0, samples: [] };
    checkCounters[issue.checkId].total += 1;
  }

  console.log(`\n=== ${f} ===`);
  console.log(
    `  size=${(buf.length / 1024).toFixed(1)}KB sheets=${wb.sheets.length} formulas=${wbSummary.formulas} numbers=${wbSummary.numbers} texts=${wbSummary.texts}`,
  );
  console.log(`  sheet names: ${wb.sheetNames.join(' | ')}`);
  console.log(
    `  score=${rep.score}/100 CRIT=${rep.counts.CRITICAL} HIGH=${rep.counts.HIGH} MED=${rep.counts.MEDIUM} LOW=${rep.counts.LOW} total=${rep.issues.length}`,
  );
  console.log(`  per-check: ${JSON.stringify(perCheck)}`);

  // Sample issues per check (so we cover ALL check types, not random)
  console.log(`  --- sample issues ---`);
  const byCheck = {};
  for (const issue of rep.issues) {
    (byCheck[issue.checkId] = byCheck[issue.checkId] ?? []).push(issue);
  }
  let shown = 0;
  for (const [cid, list] of Object.entries(byCheck)) {
    const samples = pickSamples(list, Math.min(3, N_SAMPLES));
    for (const issue of samples) {
      const cell = issue.cell ? getCell(wb, issue.sheet, issue.cell) : null;
      const formulaTxt = cell?.formula ? `=${cell.formula}` : (cell ? `value=${cell.value}` : '');
      console.log(
        `   [${issue.severity}] ${cid} ${issue.sheet}!${issue.cell ?? '-'}  ${formulaTxt}`,
      );
      console.log(`      desc: ${issue.description}`);
      // Also stash for global summary
      checkCounters[cid].samples.push({
        file: f,
        sheet: issue.sheet,
        cell: issue.cell,
        formula: cell?.formula ?? null,
        value: cell?.value ?? null,
        desc: issue.description,
      });
      shown++;
      if (shown >= N_SAMPLES * 3) break;
    }
    if (shown >= N_SAMPLES * 3) break;
  }

  fileSummaries.push({
    file: f,
    sizeKB: (buf.length / 1024).toFixed(1),
    sheets: wb.sheets.length,
    formulas: wbSummary.formulas,
    score: rep.score,
    issues: rep.issues.length,
    perCheck,
  });
}

console.log('\n\n============= SUMMARY TABLE =============');
console.log('file | sizeKB | sheets | formulas | score | total | checks');
for (const s of fileSummaries) {
  console.log(
    `${s.file} | ${s.sizeKB} | ${s.sheets} | ${s.formulas} | ${s.score} | ${s.issues} | ${JSON.stringify(s.perCheck)}`,
  );
}

console.log('\n============= GLOBAL CHECK TOTALS =============');
for (const [cid, info] of Object.entries(checkCounters)) {
  console.log(`${cid}: ${info.total} issues across all files`);
}
