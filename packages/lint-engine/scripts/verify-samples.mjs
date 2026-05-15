#!/usr/bin/env node
/**
 * verify-samples.mjs — end-to-end sanity check for the sample workbooks.
 *
 * Asserts:
 *   - pristine_dcf.xlsx scores >= 90 with 0 CRITICAL / 0 HIGH
 *   - clean_dcf_v1.xlsx scores >= 90
 *   - messy_dcf_v2.xlsx scores < 60
 *   - diff(clean_v1, messy_v2) surfaces 6-9 NEW issues
 *
 * Run after `npm run build -w @pmg/lint-engine` and `npm run generate -w @pmg/samples`.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { parseWorkbook, lintWorkbook, lintDiff } = await import(
  join(__dirname, '..', 'dist', 'index.js')
);

const root = join(__dirname, '..', '..', 'samples', 'files');

const [pBuf, cBuf, mBuf] = await Promise.all([
  readFile(join(root, 'pristine_dcf.xlsx')),
  readFile(join(root, 'clean_dcf_v1.xlsx')),
  readFile(join(root, 'messy_dcf_v2.xlsx')),
]);

const p = parseWorkbook(pBuf);
const c = parseWorkbook(cBuf);
const m = parseWorkbook(mBuf);

const pr = lintWorkbook(p);
const cr = lintWorkbook(c);
const mr = lintWorkbook(m);
const d = lintDiff(c, m);

console.log('pristine:', pr.score, 'issues=', pr.issues.length);
for (const i of pr.issues) {
  console.log(`  [${i.severity}] ${i.sheet}!${i.cell ?? ''} — ${i.description}`);
}
console.log('clean_v1:', cr.score, 'issues=', cr.issues.length);
for (const i of cr.issues) {
  console.log(`  [${i.severity}] ${i.sheet}!${i.cell ?? ''} — ${i.description}`);
}
console.log('messy_v2:', mr.score, 'issues=', mr.issues.length);
console.log(
  'diff: score=', d.score,
  'new=', d.newFingerprints.length,
  'resolved=', d.resolvedFingerprints.length,
  'unchanged=', d.unchangedFingerprints.length,
);
console.log('NEW issues in diff:');
for (const i of d.issues) {
  console.log(`  [${i.severity}] ${i.sheet}!${i.cell ?? ''} — ${i.description}`);
}

// Acceptance assertions
const failures = [];
if (pr.score < 90) failures.push(`pristine score ${pr.score} < 90`);
if (pr.counts.CRITICAL !== 0) failures.push(`pristine CRITICAL = ${pr.counts.CRITICAL}`);
if (pr.counts.HIGH !== 0) failures.push(`pristine HIGH = ${pr.counts.HIGH}`);
if (cr.score < 90) failures.push(`clean_v1 score ${cr.score} < 90`);
if (mr.score >= 60) failures.push(`messy_v2 score ${mr.score} >= 60`);
if (d.newFingerprints.length < 6 || d.newFingerprints.length > 9) {
  failures.push(`diff new=${d.newFingerprints.length} not in [6,9]`);
}

if (failures.length) {
  console.error('\nFAILURES:');
  for (const f of failures) console.error('  -', f);
  process.exit(1);
}
console.log('\nAll acceptance criteria PASS.');
