import type { CheckDefinition, CheckIssue } from '../types.js';

interface Category {
  key: string;
  label: string;
  pattern: RegExp;
}

const CATEGORIES: Category[] = [
  {
    key: 'assumptions',
    label: 'assumption/input/driver/wacc',
    // WACC, schedules, and "data sheet" tabs all functionally serve the role
    // of a driver/input block in real-world IB models. A separate "Inputs" tab
    // is the FAST convention; everyone else mixes it in differently.
    pattern:
      /assumption|input|driver|wacc|schedule|data\s*sheet|cover|control|toggle|params?/i,
  },
  {
    key: 'outputs',
    label: 'output/summary/returns/valuation/dashboard',
    pattern:
      /output|summary|return|valuation|dashboard|result|fcff|fcfe|free\s*cash|charts?/i,
  },
  {
    key: 'model',
    label: 'dcf/lbo/comps/model/projection/financial-statements',
    // Three-statement models (Income Statement / Balance Sheet / Cash Flow)
    // are themselves the "model" — so are P&L, BS, CF abbreviations, and any
    // sheet hinting at projections, financials, or operating builds.
    pattern:
      /dcf|lbo|comps?|model|projection|p\s*&\s*l|p&l|income\s*statement|balance\s*sheet|cash\s*flow|financials?|operating|revenue|capex|debt|three.?statement|3.?statement/i,
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
