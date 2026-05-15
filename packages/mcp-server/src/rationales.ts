import type { CheckId } from '@pmg/lint-engine';

/**
 * Long-form rationale strings explaining why each check matters in real-world
 * IB / PE / corp-dev model review. These are returned by the `explain_check`
 * MCP tool so an LLM agent can reason about *why* a finding deserves attention.
 */
export const RATIONALES: Record<CheckId, string> = {
  'hardcoded-numbers':
    'Magic numbers buried inside formulas break the assumption-to-output chain. ' +
    'When a reviewer or AI updates a driver on the assumptions tab, hardcoded constants in ' +
    'downstream formulas do not move with it, silently producing stale outputs. The diff ' +
    'looks clean because the cell technically did not change — but the model is now lying.',

  'circular-refs':
    "Excel's iterative calculation hides circular references behind a converged value. " +
    "The model 'works' until a small input change pushes it to a different convergence " +
    'point — or fails to converge at all — and the audit trail will not show why. ' +
    'Circular refs are also a classic vector for accidentally-different answers across machines.',

  'formula-consistency':
    'Within a row of a schedule (revenue, COGS, working capital), every period column ' +
    'should share the same formula structure. A single inconsistent cell — copy-paste error, ' +
    'manual override, or a forgotten plug — produces a wrong number that survives because ' +
    'the row LOOKS right. This is the single most common source of material model errors found in diligence.',

  'empty-outputs':
    'A summary tab or output cell that resolves to blank or zero often means a broken link, ' +
    'a deleted source range, or an unfinished section. If the deal team is reading off these ' +
    'cells, an empty output is worse than a wrong output: it gets ignored, and the underlying ' +
    'analysis never gets done.',

  'undocumented-assumptions':
    'Every assumption needs a label, a unit, and ideally a source. An un-labeled driver ' +
    'cell is a cell nobody can defend in committee — and a cell the next analyst will quietly ' +
    'change without anyone noticing. Documentation density is the strongest single predictor ' +
    'of whether a model survives a partner review.',

  'excessive-hardcodes':
    'A healthy model has assumptions on input tabs and formulas everywhere else. When a ' +
    'calculation tab is more than ~20% hardcoded numbers, the model has effectively become a ' +
    'static report: sensitivities will not flow, scenarios will not update, and the work to ' +
    'refresh it for a new period is being silently deferred to whoever inherits it.',

  'value-jumps':
    "A value that jumps order-of-magnitude period-over-period — 10x, 100x, sign flip — is " +
    'almost always a units error, a broken link, or a misplaced decimal. Reviewers skim ' +
    'past these because the formula looks right; an automated jump-detector catches what ' +
    'human pattern-matching misses on tab 7 at 11pm.',

  'sheet-structure':
    'IB and PE shops have conventions: assumptions, calculations, outputs separated; ' +
    'consistent period columns; a clear cover or summary tab. A model that violates these ' +
    'norms is harder to review, harder to hand off, and more likely to contain errors no ' +
    'one will find. Structure is a leading indicator of model quality.',
};
