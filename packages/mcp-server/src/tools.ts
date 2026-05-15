import { readFile } from 'node:fs/promises';
import {
  ALL_CHECKS,
  parseWorkbook,
  lintWorkbook,
  lintDiff,
  type CheckId,
  type CheckDefinition,
  type HealthReport,
  type DiffReport,
} from '@pmg/lint-engine';
import { RATIONALES } from './rationales.js';

/**
 * MCP tool responses share this shape: a list of content blocks. We use
 * text blocks with JSON-encoded payloads (plus a one-line human summary).
 */
export interface McpTextContent {
  type: 'text';
  text: string;
}

export interface McpToolResult {
  content: McpTextContent[];
  isError?: boolean;
  // McpServer.registerTool's result type carries an index signature so SDK
  // callers can pass through arbitrary `_meta` etc. We mirror it to stay
  // structurally compatible.
  [key: string]: unknown;
}

/** Serializable summary of a CheckDefinition (drops the `run` function). */
export interface CheckSummary {
  id: CheckId;
  name: string;
  description: string;
  defaultSeverity: CheckDefinition['defaultSeverity'];
  passMessage: string;
}

function summarizeCheck(def: CheckDefinition): CheckSummary {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    defaultSeverity: def.defaultSeverity,
    passMessage: def.passMessage,
  };
}

function textResult(summary: string, payload: unknown): McpToolResult {
  return {
    content: [
      {
        type: 'text',
        text: `${summary}\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
  };
}

/** Tool: list_checks — discover available checks. */
export function handleListChecks(): McpToolResult {
  const checks = ALL_CHECKS.map(summarizeCheck);
  return textResult(
    `Found ${checks.length} lint checks. Use 'explain_check' with a checkId to learn why each one matters.`,
    checks
  );
}

/** Tool: explain_check — full description + rationale paragraph. */
export function handleExplainCheck(args: { checkId: string }): McpToolResult {
  const { checkId } = args;
  const def = ALL_CHECKS.find((c) => c.id === checkId);
  if (!def) {
    const valid = ALL_CHECKS.map((c) => c.id).join(', ');
    throw new Error(
      `Unknown checkId: "${checkId}". Valid ids: ${valid}.`
    );
  }
  const rationale = RATIONALES[def.id];
  const payload = {
    ...summarizeCheck(def),
    rationale,
  };
  return textResult(
    `Check ${def.id} (${def.defaultSeverity}): ${def.name}`,
    payload
  );
}

async function readWorkbookFromDisk(filePath: string) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath must be a non-empty string (absolute path).');
  }
  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read file at ${filePath}: ${msg}`);
  }
  // Buffer is a Uint8Array — parseWorkbook accepts ArrayBuffer | Uint8Array.
  return parseWorkbook(buf, { fileName: filePath });
}

/** Tool: lint_workbook — run all checks on one .xlsx. */
export async function handleLintWorkbook(args: {
  filePath: string;
}): Promise<McpToolResult> {
  const wb = await readWorkbookFromDisk(args.filePath);
  const report: HealthReport = lintWorkbook(wb);
  const summary =
    `Score: ${report.score}/100 — ${report.issues.length} issues ` +
    `(${report.counts.CRITICAL} critical, ${report.counts.HIGH} high, ` +
    `${report.counts.MEDIUM} medium, ${report.counts.LOW} low). ` +
    `${report.counts.passed} checks passed, ${report.counts.failed} failed, ${report.counts.warned} warned.`;
  return textResult(summary, report);
}

/** Tool: lint_diff — diff two .xlsx files; score reflects NEW issues only. */
export async function handleLintDiff(args: {
  basePath: string;
  nextPath: string;
}): Promise<McpToolResult> {
  const [base, next] = await Promise.all([
    readWorkbookFromDisk(args.basePath),
    readWorkbookFromDisk(args.nextPath),
  ]);
  const report: DiffReport = lintDiff(base, next);
  const summary =
    `Diff score: ${report.score}/100. ` +
    `${report.newFingerprints.length} new issues, ` +
    `${report.resolvedFingerprints.length} resolved, ` +
    `${report.unchangedFingerprints.length} unchanged.`;
  return textResult(summary, report);
}
