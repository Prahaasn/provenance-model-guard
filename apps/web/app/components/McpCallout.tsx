'use client';

import { Terminal, ArrowRight } from 'lucide-react';

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "model-guard": {
      "command": "npx",
      "args": ["-y", "@pmg/mcp-server"]
    }
  }
}`;

export function McpCallout() {
  return (
    <section className="mt-16 overflow-hidden rounded-2xl border border-border-subtle bg-surface">
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-border-subtle p-6 md:border-b-0 md:border-r">
          <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-[11px] uppercase tracking-wider text-sky-300">
            <Terminal className="h-3 w-3" />
            Also an MCP server
          </div>
          <h3 className="mt-4 text-xl font-semibold tracking-tight text-text-primary">
            The same engine, exposed to your agent.
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            The lint engine ships as a Model Context Protocol server. Plug it
            into Claude Desktop, Cursor, or any MCP-aware tool and your agent
            can call:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-text-secondary">
            <li className="flex items-center gap-2">
              <code className="rounded bg-base px-1.5 py-0.5 font-mono text-xs text-sky-300">
                list_checks
              </code>
              <span className="text-text-muted">— enumerate all model-health checks</span>
            </li>
            <li className="flex items-center gap-2">
              <code className="rounded bg-base px-1.5 py-0.5 font-mono text-xs text-sky-300">
                explain_check
              </code>
              <span className="text-text-muted">— why a check matters, with fixes</span>
            </li>
            <li className="flex items-center gap-2">
              <code className="rounded bg-base px-1.5 py-0.5 font-mono text-xs text-sky-300">
                lint_workbook
              </code>
              <span className="text-text-muted">— score one .xlsx</span>
            </li>
            <li className="flex items-center gap-2">
              <code className="rounded bg-base px-1.5 py-0.5 font-mono text-xs text-sky-300">
                lint_diff
              </code>
              <span className="text-text-muted">— show only what changed between versions</span>
            </li>
          </ul>
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-sky-300">
            Built as a building block for diff-native review tools
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="bg-base p-6">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-text-muted">
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </div>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-border-subtle bg-surface p-4 font-mono text-[12.5px] leading-relaxed text-text-primary">
            <code>{CONFIG_SNIPPET}</code>
          </pre>
          <div className="mt-3 text-xs text-text-muted">
            Restart Claude Desktop. The four tools above appear as callable
            functions to the model.
          </div>
        </div>
      </div>
    </section>
  );
}
