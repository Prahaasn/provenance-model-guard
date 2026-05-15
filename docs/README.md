# Provenance Model Guard

MCP lint server for pre-submission Excel model health checks. Diff-aware, so it only flags what *this* version introduced.

---

## Why this exists

Every major Excel audit tool — Operis OAK, Spreadsheet Detective, Incisive Xcellerator, PerfectXL, and the free Inquire add-in — checks a whole workbook and returns all findings. That works for one-time audits. It breaks for version-controlled review workflows: when a model has 200 existing issues and you're reviewing a change that added 3 more, the signal is buried.

Diff-aware lint inverts this. Given two workbook snapshots, it fingerprints every issue in both, takes the set difference, and returns only what the new version introduced. A reviewer sees "this PR added 2 hardcoded numbers in the DCF sheet and broke a formula consistency pattern in row 18" rather than a 200-item audit report.

This was built as an MCP building block for diff-native model review tools — specifically the kind of AI review agent that already has access to version history and wants a structured lint artifact to include in its review prompt, not a separate GUI to install.

---

## What it checks

| Check ID | Severity | What it flags |
|---|---|---|
| `hardcoded-numbers` | HIGH | Numeric literals hardcoded directly into formulas (not in assumption cells) |
| `circular-refs` | CRITICAL | Circular reference chains detected across the sheet graph |
| `formula-consistency` | HIGH | Rows where a formula pattern breaks mid-range (one cell uses a different formula from its neighbors) |
| `empty-outputs` | MEDIUM | Output or summary cells that resolve to empty or zero when they should have a value |
| `undocumented-assumptions` | MEDIUM | Cells identified as assumption inputs that have no associated comment or label |
| `excessive-hardcodes` | MEDIUM | Sheets where more than 30% of non-empty cells are plain numbers with no formula |
| `value-jumps` | LOW | Period-over-period percentage changes that exceed a configurable threshold (default 5x) |
| `sheet-structure` | LOW | Missing standard sheets (e.g., no Assumptions tab) or sheet naming inconsistencies |

---

## Architecture

```
provenance-model-guard/
├── packages/
│   ├── lint-engine/          @pmg/lint-engine
│   │   ├── src/
│   │   │   ├── checks/       one file per CheckDefinition
│   │   │   ├── parser.ts     xlsx → ParsedWorkbook
│   │   │   ├── scorer.ts     runs checks, builds HealthReport / DiffReport
│   │   │   └── types.ts      shared types
│   │   └── package.json
│   └── mcp-server/           @pmg/mcp-server
│       ├── src/
│       │   └── index.ts      stdio MCP server, wraps lint-engine
│       └── package.json
├── apps/
│   └── web/                  @pmg/web — Next.js demo UI
├── docs/
└── package.json              npm workspaces root
```

`@pmg/mcp-server` and `@pmg/web` both depend on `@pmg/lint-engine`. The engine has no MCP or HTTP dependencies — it is a pure-TS library that accepts `Buffer | string` inputs and returns typed report objects.

---

## Quick start

**Prerequisites:** Node 20+, npm 10+.

```bash
git clone <repo>
cd provenance-model-guard
npm install
npm run build
```

**Run the web demo:**

```bash
npm run dev:web
# open http://localhost:3000
```

Drop one file for a full audit, or two files with "Diff mode" enabled to see only introduced issues.

**Run the MCP server locally:**

```bash
npm run dev:mcp
# MCP server listens on stdio
```

**Configure with Claude Desktop:**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "model-guard": {
      "command": "npx",
      "args": ["-y", "@pmg/mcp-server"]
    }
  }
}
```

Restart Claude Desktop. The four tools will appear in the tool list.

---

## MCP tools

### `lint_workbook`

Run a full health check on a single workbook file.

```
lint_workbook(path: string) → HealthReport
```

Returns a `HealthReport` with a 0-100 health score, per-check results, and a flat issue list with cell addresses.

### `lint_diff`

Run diff-aware lint: return only issues introduced in `newPath` that were not present in `basePath`.

```
lint_diff(basePath: string, newPath: string) → DiffReport
```

`DiffReport` extends `HealthReport` with `newFingerprints`, `resolvedFingerprints`, and `unchangedFingerprints` arrays. Issues are fingerprinted by `checkId|sheet|cell|key-detail` so the diff is stable across minor cell movement.

### `explain_check`

Return a human-readable explanation of what a specific check looks for, why it matters, and how to resolve common findings.

```
explain_check(checkId: CheckId) → string
```

### `list_checks`

Return all registered check definitions with their IDs, names, descriptions, and default severities.

```
list_checks() → CheckDefinition[]
```

---

## Status

Prototype. Built in one day as a demo. Not production-grade.

The lint engine covers the 8 checks listed above. Known gaps: the parser does not handle merged cells, named ranges, or external workbook references. The MCP server has no authentication or rate limiting. The web demo does not persist results. Do not use this on real deal documents.
