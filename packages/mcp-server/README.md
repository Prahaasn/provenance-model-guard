# @pmg/mcp-server

MCP server that exposes diff-aware Excel model lint to any LLM agent. Drops into Claude Desktop, Claude Code, or any client that speaks the [Model Context Protocol](https://modelcontextprotocol.io). Built on `@modelcontextprotocol/sdk` v1.x.

The server wraps the `@pmg/lint-engine` package — eight static-analysis checks designed for IB / PE / corp-dev financial models — and serves them as four MCP tools.

## Tools

| Tool | Args | Returns |
| --- | --- | --- |
| `list_checks` | _(none)_ | Array of 8 `CheckSummary` objects: id, name, description, defaultSeverity, passMessage. |
| `explain_check` | `{ checkId: string }` | The same `CheckSummary` plus a one-paragraph `rationale` explaining why the check catches real-world model risk. |
| `lint_workbook` | `{ filePath: string }` (absolute) | `HealthReport`: score 0–100, per-check results, every issue with cell coordinates. |
| `lint_diff` | `{ basePath: string; nextPath: string }` | `DiffReport`: score reflects **new** issues only; `newFingerprints` / `resolvedFingerprints` / `unchangedFingerprints`. |

## Install / run

Local development inside this monorepo:

```bash
# from repo root
npm install
npm run build -w @pmg/lint-engine
npm run build -w @pmg/mcp-server
node packages/mcp-server/dist/index.js     # speaks MCP over stdio
```

Once published to npm:

```bash
npx -y @pmg/mcp-server
```

## Claude Desktop config

Drop this into `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "pmg": {
      "command": "node",
      "args": ["/absolute/path/to/provenance-model-guard/packages/mcp-server/dist/index.js"]
    }
  }
}
```

After publishing:

```json
{
  "mcpServers": {
    "pmg": {
      "command": "npx",
      "args": ["-y", "@pmg/mcp-server"]
    }
  }
}
```

## Example tool calls

`list_checks`:

```json
{ "name": "list_checks", "arguments": {} }
```

`explain_check`:

```json
{ "name": "explain_check", "arguments": { "checkId": "hardcoded-numbers" } }
```

`lint_workbook`:

```json
{ "name": "lint_workbook", "arguments": { "filePath": "/Users/me/deal/dcf_v2.xlsx" } }
```

`lint_diff`:

```json
{
  "name": "lint_diff",
  "arguments": {
    "basePath": "/Users/me/deal/dcf_v1.xlsx",
    "nextPath": "/Users/me/deal/dcf_v2.xlsx"
  }
}
```

## Output shape

Every tool returns the MCP-standard `{ content: [{ type: 'text', text: '...' }] }` envelope. The first line of `text` is a human-readable summary; the remainder is the full JSON payload. Errors come back as `{ isError: true, content: [{ type: 'text', text: '<message>' }] }` — the server never crashes the transport on a bad input.

## Smoke test

```bash
npm run smoke -w @pmg/mcp-server
```

Spawns the built server, performs the MCP initialize handshake, calls `tools/list`, then calls `lint_workbook` against `packages/samples/files/messy_dcf_v2.xlsx`, and prints the summary line + truncated JSON.

## Tests

```bash
npm test -w @pmg/mcp-server
```

Vitest exercises every tool handler directly (no stdio round-trip). Workbook fixtures are generated inline with `xlsx` so the suite is hermetic.

## Why this exists

A serious model review is two questions: *what's wrong with this file?* and *what changed since the last version?* PMG answers both, in a form an LLM can actually consume. The reviewing agent calls `list_checks` once to learn the vocabulary, `explain_check` when it needs to justify a finding to a partner, and `lint_diff` on every new model drop — gating the model on **new** issues, not absolute issue count, so analysts aren't punished for inheriting a messy template.
