export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type CheckStatus = 'PASS' | 'FAIL' | 'WARN';
export type CheckId =
  | 'hardcoded-numbers'
  | 'circular-refs'
  | 'formula-consistency'
  | 'empty-outputs'
  | 'undocumented-assumptions'
  | 'excessive-hardcodes'
  | 'value-jumps'
  | 'sheet-structure';

export interface CheckIssue {
  checkId: CheckId;
  severity: Severity;
  sheet: string;
  cell?: string; // A1 notation
  row?: number; // 0-indexed
  col?: number; // 0-indexed
  description: string;
  suggestion?: string;
  fingerprint: string; // stable hash for diffing — checkId|sheet|cell|key-detail
}

export type CellValue = string | number | boolean | null;
export type CellType = 'formula' | 'number' | 'text' | 'boolean' | 'empty';

export interface CellData {
  address: string; // A1
  row: number;
  col: number;
  value: CellValue;
  formula: string | null; // without leading "="
  type: CellType;
}

export interface ParsedSheet {
  name: string;
  cells: CellData[][]; // [row][col]
  rowCount: number;
  colCount: number;
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[];
  sheetNames: string[];
  fileName?: string;
}

export interface CheckResult {
  id: CheckId;
  name: string;
  description: string;
  defaultSeverity: Severity;
  status: CheckStatus; // PASS if no issues, FAIL if any CRITICAL/HIGH, WARN if only MEDIUM/LOW
  issues: CheckIssue[];
  passMessage: string;
}

export interface IssueCounts {
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  passed: number;
  failed: number;
  warned: number;
}

export interface HealthReport {
  fileName: string;
  timestamp: string;
  score: number; // 0-100
  checks: CheckResult[];
  issues: CheckIssue[]; // flattened
  counts: IssueCounts;
}

export interface DiffReport extends HealthReport {
  mode: 'diff';
  baseFileName: string;
  newFingerprints: string[]; // issues present in new but not base
  resolvedFingerprints: string[]; // issues present in base but not new
  unchangedFingerprints: string[];
}

export interface CheckDefinition {
  id: CheckId;
  name: string;
  description: string;
  defaultSeverity: Severity;
  passMessage: string;
  run: (wb: ParsedWorkbook) => CheckIssue[];
}
