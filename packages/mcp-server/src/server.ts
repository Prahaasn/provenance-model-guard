import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  handleListChecks,
  handleExplainCheck,
  handleLintWorkbook,
  handleLintDiff,
  type McpToolResult,
} from './tools.js';

/**
 * Wrap a tool handler so any thrown error becomes an MCP `isError` response
 * instead of crashing the stdio transport. We keep the message terse — the
 * full stack stays in the server logs (stderr).
 */
function safe<TArgs, TOut extends McpToolResult>(
  fn: (args: TArgs) => Promise<TOut> | TOut
): (args: TArgs) => Promise<McpToolResult> {
  return async (args: TArgs) => {
    try {
      return await fn(args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[pmg-mcp] tool error:', message);
      return {
        isError: true,
        content: [{ type: 'text', text: message }],
      };
    }
  };
}

/**
 * Build the MCP server with all four tools registered. Returned without a
 * transport so tests can construct it without going through stdio.
 */
export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'pmg-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions:
        'Provenance Model Guard exposes diff-aware Excel model lint checks. ' +
        'Use list_checks first to discover what we look for, explain_check to ' +
        'learn why a specific check matters, lint_workbook to score a single ' +
        '.xlsx, and lint_diff to compare two versions (score reflects new issues only).',
    }
  );

  server.registerTool(
    'list_checks',
    {
      title: 'List available lint checks',
      description:
        'Returns the set of lint checks PMG runs against an Excel model ' +
        '(id, human name, description, default severity).',
      inputSchema: {},
    },
    safe(async () => handleListChecks())
  );

  server.registerTool(
    'explain_check',
    {
      title: 'Explain a single lint check',
      description:
        'Returns the metadata for one check plus a one-paragraph rationale ' +
        'explaining why it matters in real-world model review.',
      inputSchema: {
        checkId: z
          .string()
          .describe(
            "The check id, e.g. 'hardcoded-numbers' or 'circular-refs'. " +
              "Call list_checks to discover valid ids."
          ),
      },
    },
    safe(async (args: { checkId: string }) => handleExplainCheck(args))
  );

  server.registerTool(
    'lint_workbook',
    {
      title: 'Lint an Excel workbook',
      description:
        'Reads an .xlsx file from disk, runs all PMG checks, and returns a ' +
        'HealthReport with score (0-100), per-check results, and all issues.',
      inputSchema: {
        filePath: z
          .string()
          .describe('Absolute filesystem path to the .xlsx workbook.'),
      },
    },
    safe(async (args: { filePath: string }) => handleLintWorkbook(args))
  );

  server.registerTool(
    'lint_diff',
    {
      title: 'Diff-lint two Excel workbooks',
      description:
        'Reads two .xlsx files (base and next), runs PMG checks on both, and ' +
        'returns a DiffReport whose score reflects ONLY new issues introduced ' +
        'in `next` (resolved and unchanged issues do not penalize the score).',
      inputSchema: {
        basePath: z
          .string()
          .describe('Absolute path to the base (previous) version .xlsx.'),
        nextPath: z
          .string()
          .describe('Absolute path to the next (current) version .xlsx.'),
      },
    },
    safe(async (args: { basePath: string; nextPath: string }) =>
      handleLintDiff(args)
    )
  );

  return server;
}
