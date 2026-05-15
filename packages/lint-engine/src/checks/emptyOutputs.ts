import type { CheckDefinition, CheckIssue } from '../types.js';

const OUTPUT_SHEET_RE = /output|summary|returns|valuation|irr|dashboard|results/i;

export const emptyOutputs: CheckDefinition = {
  id: 'empty-outputs',
  name: 'Empty cells in output sheets',
  description:
    'On output-like sheets, flags blank cells that sit between non-empty neighbors in the same row.',
  defaultSeverity: 'MEDIUM',
  passMessage: 'No isolated empty cells found on output-like sheets.',
  run(wb) {
    const issues: CheckIssue[] = [];
    for (const sheet of wb.sheets) {
      if (!OUTPUT_SHEET_RE.test(sheet.name)) continue;
      for (const row of sheet.cells) {
        for (let c = 1; c < row.length - 1; c++) {
          const cell = row[c];
          const left = row[c - 1];
          const right = row[c + 1];
          if (!cell || !left || !right) continue;
          if (cell.type !== 'empty') continue;
          if (left.type === 'empty' || right.type === 'empty') continue;
          issues.push({
            checkId: 'empty-outputs',
            severity: 'MEDIUM',
            sheet: sheet.name,
            cell: cell.address,
            row: cell.row,
            col: cell.col,
            description: `Empty cell ${cell.address} between populated neighbors on an output sheet.`,
            suggestion:
              'Output sheets should be dense — fill in the missing value, add an explicit N/A, or remove the row.',
            fingerprint: `empty-outputs|${sheet.name}|${cell.address}`,
          });
        }
      }
    }
    return issues;
  },
};
