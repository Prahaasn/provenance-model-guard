import type { CellData, CheckDefinition, CheckIssue } from '../types.js';

const ASSUMPTION_SHEET_RE = /assumption|input|driver/i;

function isSectionHeader(cell: CellData | undefined): boolean {
  if (!cell) return false;
  if (cell.type !== 'text') return false;
  const v = typeof cell.value === 'string' ? cell.value.trim() : '';
  return v.length > 0;
}

export const undocumentedAssumptions: CheckDefinition = {
  id: 'undocumented-assumptions',
  name: 'Undocumented assumption inputs',
  description:
    'On assumption/input/driver sheets, flags numeric cells with no row label and no nearby text context.',
  defaultSeverity: 'MEDIUM',
  passMessage: 'Every assumption appears to have a label or section header.',
  run(wb) {
    const issues: CheckIssue[] = [];
    for (const sheet of wb.sheets) {
      if (!ASSUMPTION_SHEET_RE.test(sheet.name)) continue;
      for (let r = 0; r < sheet.cells.length; r++) {
        const row = sheet.cells[r];
        if (!row) continue;
        for (let c = 1; c < row.length; c++) {
          const cell = row[c];
          if (!cell || cell.type !== 'number') continue;
          const left = row[c - 1];
          if (!left || left.type !== 'empty') continue;
          const labelCol = row[0];
          if (labelCol && labelCol.type !== 'empty') continue;
          const aboveRow = sheet.cells[r - 1];
          const aboveCell = aboveRow ? aboveRow[c] : undefined;
          if (isSectionHeader(aboveCell)) continue;
          issues.push({
            checkId: 'undocumented-assumptions',
            severity: 'MEDIUM',
            sheet: sheet.name,
            cell: cell.address,
            row: cell.row,
            col: cell.col,
            description: `Numeric assumption ${cell.address} has no row label or section header.`,
            suggestion:
              'Add a label in column A or a section header above this value so reviewers know what it represents.',
            fingerprint: `undocumented-assumptions|${sheet.name}|${cell.address}`,
          });
        }
      }
    }
    return issues;
  },
};
