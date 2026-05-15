import type { CheckDefinition } from '../types.js';
import { hardcodedNumbers } from './hardcodedNumbers.js';
import { circularRefs } from './circularRefs.js';
import { formulaConsistency } from './formulaConsistency.js';
import { emptyOutputs } from './emptyOutputs.js';
import { undocumentedAssumptions } from './undocumentedAssumptions.js';
import { excessiveHardcodes } from './excessiveHardcodes.js';
import { valueJumps } from './valueJumps.js';
import { sheetStructure } from './sheetStructure.js';

export const ALL_CHECKS: CheckDefinition[] = [
  hardcodedNumbers,
  circularRefs,
  formulaConsistency,
  emptyOutputs,
  undocumentedAssumptions,
  excessiveHardcodes,
  valueJumps,
  sheetStructure,
];

export {
  hardcodedNumbers,
  circularRefs,
  formulaConsistency,
  emptyOutputs,
  undocumentedAssumptions,
  excessiveHardcodes,
  valueJumps,
  sheetStructure,
};
