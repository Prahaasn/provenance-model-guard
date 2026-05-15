import type { CheckDefinition, CheckIssue } from '../types.js';

const ASSUMPTION_SHEET_RE = /assumption|input|driver/i;

export const excessiveHardcodes: CheckDefinition = {
  id: 'excessive-hardcodes',
  name: 'Excessive hardcoded numbers in calculation rows',
  description:
    'Outside assumption sheets, flags rows where most numeric cells are hardcoded rather than computed.',
  defaultSeverity: 'LOW',
  passMessage: 'Calculation rows mostly use formulas rather than hardcoded values.',
  run(wb) {
    const issues: CheckIssue[] = [];
    for (const sheet of wb.sheets) {
      if (ASSUMPTION_SHEET_RE.test(sheet.name)) continue;
      for (let r = 0; r < sheet.cells.length; r++) {
        const row = sheet.cells[r];
        if (!row) continue;
        let numerics = 0;
        let hardcodes = 0;
        for (const cell of row) {
          if (cell.type === 'number') {
            numerics++;
            hardcodes++;
          } else if (cell.type === 'formula') {
            // Treat formula cells with numeric value as numeric (not hardcoded).
            if (typeof cell.value === 'number') {
              numerics++;
            }
          }
        }
        if (numerics < 3) continue;
        if (hardcodes / numerics <= 0.5) continue;
        const firstNumeric = row.find((c) => c.type === 'number');
        issues.push({
          checkId: 'excessive-hardcodes',
          severity: 'LOW',
          sheet: sheet.name,
          cell: firstNumeric?.address,
          row: r,
          description: `Row ${r + 1} on '${sheet.name}' has ${hardcodes}/${numerics} hardcoded numbers — consider linking to assumptions.`,
          suggestion:
            'Replace hardcoded numbers with references to a central assumptions block so the row stays auditable.',
          fingerprint: `excessive-hardcodes|${sheet.name}|row-${r}`,
        });
      }
    }
    return issues;
  },
};
