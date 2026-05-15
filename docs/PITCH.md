# Provenance Model Guard — Technical Framing for Provenance

---

## The observation

Provenance makes every model change traceable after it lands: cell-level diffs, audit logs, AI review summaries. That is the right layer to build. But there is a cost hidden in the current flow — when an AI review agent runs over a new model version, it has to triage the entire issue surface: every legacy hardcode, every pre-existing formula inconsistency, every structural problem that was there before this analyst touched the file. The signal in the diff gets diluted by the noise of accumulated technical debt.

This is the same problem that code review tools solved years ago. A linter running on a full codebase gives you thousands of warnings. A linter running on a diff gives you five. The second one is what you put in front of a reviewer. For financial models, no tool currently makes this distinction — they all report against the whole workbook.

---

## The proposal

A diff-aware lint layer that runs before the AI review pass changes the artifact the agent is working with. Instead of "your model has 47 hardcoded numbers," the agent gets "this version introduced 3 new hardcoded numbers, one in the DCF terminal value formula, and broke a formula consistency pattern across row 18 of the returns schedule." That is a specific, actionable signal about this changeset — not a health report about the model's history.

The natural place to insert this is at submission time, before the Provenance review queue processes the diff. The lint result becomes a structured field in the review context, not a separate UI surface the analyst has to navigate. The AI review summary can open with "this PR introduced 2 HIGH severity issues" rather than having to synthesize that from raw cell diffs. Humans naturally focus on their own changes; AI agents do not — they need the scope explicitly bounded.

---

## Why MCP

The lint server is MCP-native because the review agent is the primary consumer, not the analyst. The agent calls `lint_diff(v3.1, v3.2)`, gets a typed `DiffReport` back, and includes only the new issues in its review prompt. There is no new UI surface for the analyst to learn and no integration path that requires changes to the Provenance frontend. It drops into a Claude Desktop config in two lines, and the same interface works for any MCP-compatible agent runtime.

---

## What is in the repo

- **`@pmg/lint-engine`** — pure-TS library. Parses `.xlsx` via ExcelJS, runs 8 checks, returns typed `HealthReport` or `DiffReport`. The diff algorithm fingerprints each issue by `checkId|sheet|cell|key-detail` and takes the set difference between two workbook snapshots. No external dependencies beyond ExcelJS.
- **`@pmg/mcp-server`** — stdio MCP server wrapping the engine. Exposes four tools: `lint_workbook`, `lint_diff`, `explain_check`, `list_checks`.
- **`@pmg/web`** — Next.js demo UI. Drag-drop one or two files, toggle diff mode, see a scored health report with expandable check cards and cell addresses.

The 8 checks (hardcoded numbers, circular refs, formula consistency, empty outputs, undocumented assumptions, excessive hardcodes, value jumps, sheet structure) are commodity — OAK, Inquire, and Crunched all cover this ground. The actual contributions here are the diff-awareness and the MCP interface.

---

## What I would build next if doing this for real

- **Assumption-distance severity weighting.** Issues closer to key driver cells (revenue growth, discount rate, exit multiple) should carry higher severity than issues in auxiliary schedules. The engine has cell addresses; the next step is a dependency graph to rank by assumption proximity.
- **Justification-presence check.** When a key driver changes value between versions, verify that the cell has an associated comment, or that a nearby cell contains a text label explaining the change. This is a semantic check that audit tools do not currently do.
- **Formula-level semantic hash for true cross-version diff.** The current fingerprint is structural. A semantic hash would normalize formula expressions so that `=B2*1.05` and `=B2*(1+0.05)` are treated as equivalent — preventing false positives when analysts refactor without changing logic.
- **Provenance review queue webhook integration.** The lint result should be a first-class field on the Provenance diff object, computed at submission time, surfaced in the review summary. The MCP interface is the prototype; the production version is an internal service call.
- **Configurable rule profiles per deal type.** LBO models have different structural conventions than DCF or merger models. A rule profile system would let teams encode their own standards and flag deviations from those, not just from generic best practices.

---

## About me

I am Prahaas, a college student. I built this in one day to demonstrate that I understand the architecture of a diff-native model review system and can translate that understanding into working code. It is a prototype — not a pitch for a competing product, and not something I expect to run in production.

Full code: [GITHUB-LINK]

Demo: [VERCEL-LINK]
