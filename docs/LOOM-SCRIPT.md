# Loom Script — Provenance Model Guard Demo

Target: 75-90 seconds. Audience: one senior engineer at a fintech startup.

---

## 0:00 - 0:08 — Open the demo page

**Action:** Browser is already open at `localhost:3000`. The page shows the dark-themed upload area with two drop zones and a "Diff mode" toggle.

**Say:** "Financial model audit tools check the whole workbook. This one only flags what the new version introduced."

---

## 0:08 - 0:25 — Drop files and run diff mode

**Action:** Drag `clean_dcf_v1.xlsx` into the left drop zone, labeled "Base version." Drag `messy_dcf_v2.xlsx` into the right drop zone, labeled "New version." Confirm the "Diff mode" toggle is on (lit). Click "Run check."

**Say:** "Two versions of the same DCF model. I'm not showing every issue in the model — only the ones this version introduced."

**Action:** Watch the progress indicator resolve. A health report slides into view: a score badge, a summary line reading something like "3 new issues introduced — 1 CRITICAL, 2 HIGH," and a list of check cards, some green-checkmarked (passed or unchanged), a few flagged.

---

## 0:25 - 0:45 — Expand check cards and point at cells

**Action:** Click to expand the `circular-refs` card. It shows "CRITICAL — Sheet: DCF, Cell: E14." Hover over the cell reference to show it is highlighted text, not a link (prototype note — no live Excel connection).

**Say:** "Circular reference introduced in E14 on the DCF sheet. That is new — the base version was clean."

**Action:** Collapse that card. Expand the `hardcoded-numbers` card. It shows two findings: "Sheet: Returns, Cell: C8 — literal 0.25 hardcoded in formula" and "Sheet: Returns, Cell: D8 — literal 1000000 hardcoded in terminal value formula."

**Say:** "Two hardcoded numbers in the returns schedule — both new in this version, both in formula cells that should be referencing the assumptions tab."

**Action:** Quickly scroll down to show the `formula-consistency` warning card — flagged at row 18 of the returns schedule.

**Say:** "Formula consistency break in row 18. One cell diverges from the pattern of its neighbors."

---

## 0:45 - 1:05 — Switch to terminal and show MCP config

**Action:** Switch to a terminal window. It is already running the MCP server: `npm run dev:mcp`. The output shows `MCP server listening on stdio`.

**Say:** "The same engine is an MCP server."

**Action:** Switch to a code editor or text editor showing the Claude Desktop config JSON:

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

**Say:** "Two lines in the Claude Desktop config."

**Action:** Switch to a terminal showing a pre-run example tool call response (a JSON block representing a `DiffReport`). Scroll slowly so the `newFingerprints` array and `issues` array are visible. The issues section shows three entries with `sheet`, `cell`, `description`, and `severity` fields.

**Say:** "Agent calls `lint_diff`, gets a typed JSON report back. New issues only. Four tools total."

---

## 1:05 - 1:20 — Closing

**Action:** Switch back to the browser demo page. The health report is still visible. Let it sit.

**Say:** "This is an MCP building block. Your AI review agent calls `lint_diff` before generating its summary, and only the new issues end up in the review prompt. The analyst sees a scoped signal, not an audit of the model's full history. Code and a live demo are in the description."

**Action:** No click needed. Let the page hold for 3 seconds, then stop recording.

---

## Notes for recording

- Record at 1440x900 or higher. Browser at 90% zoom so check cards are readable.
- Have both xlsx files on the desktop before recording. Do not fumble the drag.
- Kill all browser notifications before recording.
- The MCP JSON output in the terminal — paste it in before recording so there is no lag from actually running a tool call.
- Keep narration flat and slightly slow. Do not rush the card expansions; pause half a second after each expand so the viewer registers what they are looking at.
