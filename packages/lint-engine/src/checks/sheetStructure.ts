import type { CheckDefinition, CheckIssue } from '../types.js';

interface Category {
  key: string;
  label: string;
  pattern: RegExp;
}

const CATEGORIES: Category[] = [
  { key: 'assumptions', label: 'assumption/input/driver', pattern: /assumption|input|driver/i },
  {
    key: 'outputs',
    label: 'output/summary/returns/valuation',
    pattern: /output|summary|returns|valuation/i,
  },
  {
    key: 'model',
    label: 'dcf/lbo/comps/model/projection',
    pattern: /dcf|lbo|comps|model|projection/i,
  },
];

export const sheetStructure: CheckDefinition = {
  id: 'sheet-structure',
  name: 'Sheet structure',
  description:
    'Checks the workbook contains at least one sheet matching each canonical category (assumptions, outputs, model).',
  defaultSeverity: 'LOW',
  passMessage: 'Workbook has the expected assumption/model/output sheet structure.',
  run(wb) {
    const issues: CheckIssue[] = [];
    for (const category of CATEGORIES) {
      const found = wb.sheetNames.some((n) => category.pattern.test(n));
      if (!found) {
        issues.push({
          checkId: 'sheet-structure',
          severity: 'LOW',
          sheet: '(workbook)',
          description: `No sheet found matching the ${category.label} category.`,
          suggestion: `Add a dedicated sheet whose name matches one of: ${category.label}.`,
          fingerprint: `sheet-structure|workbook|${category.key}`,
        });
      }
    }
    return issues;
  },
};
