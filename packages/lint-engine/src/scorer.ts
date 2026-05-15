import type { CheckIssue, IssueCounts, Severity } from './types.js';

const PENALTY: Record<Severity, number> = {
  CRITICAL: 15,
  HIGH: 8,
  MEDIUM: 4,
  LOW: 2,
};

// Diminishing-returns scoring. A model that repeats the SAME smell 50 times
// (e.g. fifty hardcoded numbers across an income statement) shouldn't score
// worse than a model with five totally different smells — both have one bug
// pattern. To express that, we apply per-(checkId,severity) caps so volume of
// one issue type can't dominate the score. A genuinely-broken model still gets
// hammered (multiple distinct check types pile up), but a model that is just
// noisy in one dimension drops to a reasonable floor.
const PER_CHECK_CAP: Record<Severity, number> = {
  CRITICAL: 45, // 3 cycles is plenty of signal — more is the same disease
  HIGH: 32, // ~4 HIGH issues of one type max
  MEDIUM: 20, // ~5 MEDIUM
  LOW: 10, // ~5 LOW
};

export function computeScore(issues: CheckIssue[]): number {
  let score = 100;
  // Bucket penalty by (checkId|severity)
  const buckets = new Map<string, number>();
  for (const issue of issues) {
    const k = `${issue.checkId}|${issue.severity}`;
    buckets.set(k, (buckets.get(k) ?? 0) + PENALTY[issue.severity]);
  }
  for (const [k, raw] of buckets) {
    const sev = k.split('|')[1] as Severity;
    score -= Math.min(raw, PER_CHECK_CAP[sev]);
  }
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return Math.round(score);
}

export function emptyCounts(): IssueCounts {
  return {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    passed: 0,
    failed: 0,
    warned: 0,
  };
}

export function countIssues(issues: CheckIssue[]): Pick<IssueCounts, Severity> {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const issue of issues) {
    counts[issue.severity]++;
  }
  return counts;
}
