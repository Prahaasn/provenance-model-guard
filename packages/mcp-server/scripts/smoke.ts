#!/usr/bin/env tsx
/**
 * Smoke test: spawn the built MCP server, speak JSON-RPC over stdio, and
 * verify it answers `tools/list` and `tools/call lint_workbook` correctly.
 *
 * Usage:
 *   npx tsx scripts/smoke.ts
 *   npm run smoke -w @pmg/mcp-server
 *
 * Optional env: PMG_SMOKE_FILE=/abs/path.xlsx to override the lint target.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_ENTRY = path.resolve(__dirname, '..', 'dist', 'index.js');
const DEFAULT_TARGET = path.resolve(
  __dirname,
  '..',
  '..',
  'samples',
  'files',
  'messy_dcf_v2.xlsx'
);
const TARGET = process.env.PMG_SMOKE_FILE ?? DEFAULT_TARGET;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

if (!existsSync(SERVER_ENTRY)) {
  console.error(
    `[smoke] server entry not found at ${SERVER_ENTRY} — run 'npm run build -w @pmg/mcp-server' first.`
  );
  process.exit(1);
}

const child = spawn('node', [SERVER_ENTRY], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

const pending = new Map<
  number,
  { resolve: (r: JsonRpcResponse) => void; reject: (e: Error) => void }
>();

let buf = '';
child.stdout.on('data', (chunk: Buffer) => {
  buf += chunk.toString('utf8');
  // MCP stdio framing in v1.x SDK: newline-delimited JSON.
  let nl: number;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line) as JsonRpcResponse;
      const handler = pending.get(msg.id);
      if (handler) {
        pending.delete(msg.id);
        handler.resolve(msg);
      }
    } catch (e) {
      console.error('[smoke] could not parse stdout line:', line);
    }
  }
});

child.stderr.on('data', (chunk: Buffer) => {
  // forward server diagnostics so we can see "[pmg-mcp] ready"
  process.stderr.write(`[server] ${chunk.toString('utf8')}`);
});

child.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[smoke] server exited unexpectedly with code ${code}`);
  }
});

function send(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    pending.set(req.id, { resolve, reject });
    child.stdin.write(`${JSON.stringify(req)}\n`);
    setTimeout(() => {
      if (pending.has(req.id)) {
        pending.delete(req.id);
        reject(new Error(`Timeout waiting for response to id=${req.id}`));
      }
    }, 15000);
  });
}

async function main() {
  // 1. initialize handshake (required by MCP).
  const initRes = await send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'pmg-smoke', version: '0.0.0' },
    },
  });
  console.log('=== initialize ===');
  console.log(JSON.stringify(initRes.result, null, 2));

  // 2. notifications/initialized (no response expected — fire and forget).
  child.stdin.write(
    `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
  );

  // 3. tools/list
  const listRes = await send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
  });
  console.log('=== tools/list ===');
  const tools = (listRes.result as { tools: Array<{ name: string }> })?.tools ?? [];
  console.log(`Server exposes ${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`);

  // 4. tools/call lint_workbook
  if (!existsSync(TARGET)) {
    console.error(`[smoke] target xlsx not found at ${TARGET} — skipping lint call.`);
  } else {
    const callRes = await send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'lint_workbook',
        arguments: { filePath: TARGET },
      },
    });
    console.log('=== tools/call lint_workbook ===');
    const result = callRes.result as
      | { content: Array<{ type: string; text: string }>; isError?: boolean }
      | undefined;
    if (!result || result.isError) {
      console.error('[smoke] lint_workbook failed:', JSON.stringify(callRes, null, 2));
      process.exitCode = 1;
    } else {
      // print only the first line (the summary) + first 300 chars of JSON
      const text = result.content[0]?.text ?? '';
      const [summaryLine, ...rest] = text.split('\n\n');
      console.log(`SUMMARY: ${summaryLine}`);
      const jsonStr = rest.join('\n\n');
      const trimmed = jsonStr.length > 500 ? `${jsonStr.slice(0, 500)}\n... (truncated)` : jsonStr;
      console.log(trimmed);
    }
  }

  child.stdin.end();
  child.kill();
}

main().catch((err) => {
  console.error('[smoke] failed:', err);
  child.kill();
  process.exit(1);
});
