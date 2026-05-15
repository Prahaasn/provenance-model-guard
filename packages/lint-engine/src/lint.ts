import { ALL_CHECKS } from './checks/index.js';
import { computeScore, emptyCounts } from './scorer.js';
import type {
  CheckIssue,
  CheckResult,
  CheckStatus,
  DiffReport,
  HealthReport,
  ParsedWorkbook,
} from './types.js';

export interface LintOptions {
  fileName?: string;
}

export interface DiffOptions {
  baseFileName?: string;
  nextFileName?: string;
}

function statusFor(issues: CheckIssue[]): CheckStatus {
  if (issues.length === 0) return 'PASS';
  if (issues.some((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH')) return 'FAIL';
  return 'WARN';
}

function buildReport(
  wb: ParsedWorkbook,
  fileName: string,
  issuesFilter?: (issue: CheckIssue) => boolean,
): HealthReport {
  const checkResults: CheckResult[] = [];
  const allIssues: CheckIssue[] = [];
  for (const def of ALL_CHECKS) {
    const rawIssues = def.run(wb);
    const issues = issuesFilter ? rawIssues.filter(issuesFilter) : rawIssues;
    const status = statusFor(issues);
    checkResults.push({
      id: def.id,
      name: def.name,
      description: def.description,
      defaultSeverity: def.defaultSeverity,
      status,
      issues,
      passMessage: def.passMessage,
    });
    allIssues.push(...issues);
  }

  const counts = emptyCounts();
  for (const issue of allIssues) {
    counts[issue.severity]++;
  }
  for (const result of checkResults) {
    if (result.status === 'PASS') counts.passed++;
    else if (result.status === 'FAIL') counts.failed++;
    else counts.warned++;
  }

  return {
    fileName,
    timestamp: new Date().toISOString(),
    score: computeScore(allIssues),
    checks: checkResults,
    issues: allIssues,
    counts,
  };
}

export function lintWorkbook(wb: ParsedWorkbook, opts: LintOptions = {}): HealthReport {
  const fileName = opts.fileName ?? wb.fileName ?? 'workbook.xlsx';
  return buildReport(wb, fileName);
}

export function lintDiff(
  base: ParsedWorkbook,
  next: ParsedWorkbook,
  opts: DiffOptions = {},
): DiffReport {
  const baseFileName = opts.baseFileName ?? base.fileName ?? 'base.xlsx';
  const nextFileName = opts.nextFileName ?? next.fileName ?? 'next.xlsx';

  // Run all checks against both workbooks to gather fingerprints.
  const baseIssues: CheckIssue[] = [];
  const nextIssues: CheckIssue[] = [];
  for (const def of ALL_CHECKS) {
    baseIssues.push(...def.run(base));
    nextIssues.push(...def.run(next));
  }

  const baseFingerprints = new Set(baseIssues.map((i) => i.fingerprint));
  const nextFingerprints = new Set(nextIssues.map((i) => i.fingerprint));

  const newFingerprints: string[] = [];
  const unchangedFingerprints: string[] = [];
  for (const fp of nextFingerprints) {
    if (baseFingerprints.has(fp)) unchangedFingerprints.push(fp);
    else newFingerprints.push(fp);
  }
  const resolvedFingerprints: string[] = [];
  for (const fp of baseFingerprints) {
    if (!nextFingerprints.has(fp)) resolvedFingerprints.push(fp);
  }

  const newSet = new Set(newFingerprints);
  // Build the "report" from the NEW workbook but filter to only new issues.
  const filtered = buildReport(next, nextFileName, (issue) => newSet.has(issue.fingerprint));

  const diff: DiffReport = {
    ...filtered,
    mode: 'diff',
    baseFileName,
    newFingerprints,
    resolvedFingerprints,
    unchangedFingerprints,
  };
  return diff;
}
