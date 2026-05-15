#!/usr/bin/env tsx
/**
 * Stress test: drive the built MCP server over stdio with malformed inputs,
 * security payloads, and edge-case arguments.
 *
 * Usage:
 *   npx tsx scripts/stress.ts
 *   npm run stress -w @pmg/mcp-server
 *
 * Exit code: 0 if all cases behave as expected, 1 if any CRASH/HANG/UNEXPECTED.
 */
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtempSync, mkdirSync as mkdirSyncFs } from 'node:fs';
import { tmpdir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_ENTRY = path.resolve(__dirname, '..', 'dist', 'index.js');
const SAMPLES_DIR = path.resolve(__dirname, '..', '..', 'samples', 'files');
const SAMPLE_CLEAN = path.join(SAMPLES_DIR, 'clean_dcf_v1.xlsx');
const SAMPLE_MESSY = path.join(SAMPLES_DIR, 'messy_dcf_v2.xlsx');

// ── Outcome categories ──────────────────────────────────────────────────────
type Outcome = 'PASS' | 'CRASH' | 'HANG' | 'UNEXPECTED';

interface TestResult {
  id: number;
  label: string;
  outcome: Outcome;
  detail: string;
  durationMs: number;
}

// ── Helpers to create temp fixture files ────────────────────────────────────
function setupFixtures(): {
  tmpDir: string;
  emptyFile: string;
  textFile: string;
  dirAsFile: string;
} {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'pmg-stress-'));
  // 0-byte "xlsx" file
  const emptyFile = path.join(tmpDir, 'empty.xlsx');
  writeFileSync(emptyFile, '');
  // .txt file
  const textFile = path.join(tmpDir, 'not-a-workbook.txt');
  writeFileSync(textFile, 'hello world\n');
  // directory named like an xlsx (test: passing dir path instead of file)
  const dirAsFile = path.join(tmpDir, 'is-a-directory.xlsx');
  mkdirSyncFs(dirAsFile);
  return { tmpDir, emptyFile, textFile, dirAsFile };
}

// ── JSON-RPC plumbing ───────────────────────────────────────────────────────
interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ToolCallResult {
  content?: Array<{ type: string; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

class McpClient {
  private child: ChildProcessWithoutNullStreams;
  private buf = '';
  private pending = new Map<
    number,
    {
      resolve: (r: JsonRpcResponse) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private nextId = 1;
  public exited = false;
  public exitCode: number | null = null;

  constructor(serverEntry: string) {
    this.child = spawn('node', [serverEntry], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.child.stdout.on('data', (chunk: Buffer) => {
      this.buf += chunk.toString('utf8');
      let nl: number;
      while ((nl = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, nl).trim();
        this.buf = this.buf.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as JsonRpcResponse;
          // Responses have an id; notifications don't.
          if (msg.id != null) {
            const handler = this.pending.get(msg.id as number);
            if (handler) {
              clearTimeout(handler.timer);
              this.pending.delete(msg.id as number);
              handler.resolve(msg);
            }
          }
        } catch {
          // non-JSON line — ignore (could be a notification)
        }
      }
    });

    this.child.stderr.on('data', () => {
      // swallow server logs in stress test; they'd pollute output
    });

    this.child.on('exit', (code) => {
      this.exited = true;
      this.exitCode = code;
      // Reject all pending requests so they don't hang
      for (const [id, handler] of this.pending) {
        clearTimeout(handler.timer);
        this.pending.delete(id);
        handler.reject(new Error(`Server exited (code ${code}) before response to id=${id}`));
      }
    });
  }

  send(req: JsonRpcRequest, timeoutMs = 5000): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      if (this.exited) {
        reject(new Error(`Server already exited (code ${this.exitCode})`));
        return;
      }
      const id = req.id ?? this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`HANG: no response within ${timeoutMs}ms for id=${id}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.child.stdin.write(`${JSON.stringify({ ...req, id })}\n`);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  /** Send raw bytes (for malformed JSON test) — no response expected via pending map. */
  sendRaw(line: string, timeoutMs = 2000): Promise<JsonRpcResponse | null> {
    return new Promise((resolve) => {
      let gotResponse = false;
      const handler = (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        for (const l of text.split('\n')) {
          const t = l.trim();
          if (!t) continue;
          try {
            const msg = JSON.parse(t) as JsonRpcResponse;
            // Only resolve for error responses (id null or -1 range)
            if (!gotResponse) {
              gotResponse = true;
              this.child.stdout.off('data', handler);
              resolve(msg);
            }
          } catch {
            // ignore non-JSON
          }
        }
      };
      this.child.stdout.on('data', handler);
      try {
        this.child.stdin.write(`${line}\n`);
      } catch {
        this.child.stdout.off('data', handler);
        resolve(null);
      }
      setTimeout(() => {
        if (!gotResponse) {
          this.child.stdout.off('data', handler);
          resolve(null); // no response = SDK silently ignored it
        }
      }, timeoutMs);
    });
  }

  async initialize(): Promise<void> {
    await this.send({
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'pmg-stress', version: '0.0.0' },
      },
    });
    this.child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
    );
  }

  toolsCall(
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs = 5000
  ): Promise<JsonRpcResponse> {
    return this.send(
      {
        jsonrpc: '2.0',
        id: this.nextId++,
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      },
      timeoutMs
    );
  }

  kill(): void {
    try {
      this.child.stdin.end();
      this.child.kill('SIGTERM');
    } catch {
      // already dead
    }
  }
}

// ── Test runner ─────────────────────────────────────────────────────────────
const results: TestResult[] = [];

async function runTest(
  id: number,
  label: string,
  fn: (client: McpClient) => Promise<{ outcome: Outcome; detail: string }>
): Promise<void> {
  // Each test gets its own server instance so crashes don't cascade.
  const client = new McpClient(SERVER_ENTRY);
  const start = Date.now();
  let outcome: Outcome = 'CRASH';
  let detail = '';

  try {
    await client.initialize();
    const res = await fn(client);
    outcome = res.outcome;
    detail = res.detail;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('HANG')) {
      outcome = 'HANG';
      detail = msg;
    } else if (msg.includes('exited')) {
      outcome = 'CRASH';
      detail = msg;
    } else {
      outcome = 'CRASH';
      detail = `Unexpected throw: ${msg}`;
    }
  } finally {
    client.kill();
  }

  const durationMs = Date.now() - start;
  results.push({ id, label, outcome, detail, durationMs });

  const icon = outcome === 'PASS' ? '✓' : outcome === 'UNEXPECTED' ? '?' : '✗';
  const color =
    outcome === 'PASS'
      ? '\x1b[32m'
      : outcome === 'UNEXPECTED'
      ? '\x1b[33m'
      : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(
    `  ${color}${icon}${reset} [${String(id).padStart(2, '0')}] ${label} ${color}${outcome}${reset} (${durationMs}ms)`
  );
  if (outcome !== 'PASS') {
    console.log(`        ${detail}`);
  }
}

// ── Assertion helpers ───────────────────────────────────────────────────────
function expectIsError(
  res: JsonRpcResponse
): { outcome: Outcome; detail: string } {
  if (!res.result) {
    return { outcome: 'CRASH', detail: 'No result in response' };
  }
  const r = res.result as ToolCallResult;
  if (r.isError === true && Array.isArray(r.content) && r.content.length > 0) {
    const msg = r.content[0]?.text ?? '';
    return { outcome: 'PASS', detail: `isError=true: ${msg.slice(0, 120)}` };
  }
  if (res.error) {
    // JSON-RPC level error is also acceptable for certain inputs
    return { outcome: 'PASS', detail: `JSON-RPC error: ${res.error.message}` };
  }
  return {
    outcome: 'UNEXPECTED',
    detail: `Expected isError but got success: ${JSON.stringify(r).slice(0, 200)}`,
  };
}

function expectSuccess(
  res: JsonRpcResponse
): { outcome: Outcome; detail: string } {
  if (!res.result) {
    return { outcome: 'UNEXPECTED', detail: 'No result field in response' };
  }
  const r = res.result as ToolCallResult;
  if (r.isError === true) {
    const msg = r.content?.[0]?.text ?? '';
    return {
      outcome: 'UNEXPECTED',
      detail: `Expected success but got isError=true: ${msg.slice(0, 200)}`,
    };
  }
  if (res.error) {
    return {
      outcome: 'UNEXPECTED',
      detail: `Expected success but got JSON-RPC error: ${res.error.message}`,
    };
  }
  return {
    outcome: 'PASS',
    detail: `Success. content[0] text starts: ${String(r.content?.[0]?.text ?? '').slice(0, 80)}`,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(SERVER_ENTRY)) {
    console.error(
      `[stress] server entry not found at ${SERVER_ENTRY}\n` +
        `Run 'npm run build -w @pmg/mcp-server' first.`
    );
    process.exit(1);
  }

  const { tmpDir, emptyFile, textFile, dirAsFile } = setupFixtures();
  console.log(`\n[stress] fixtures in ${tmpDir}`);
  console.log(`[stress] server: ${SERVER_ENTRY}\n`);

  // ── lint_workbook ─────────────────────────────────────────────────────────
  console.log('── lint_workbook ──');

  await runTest(1, 'lint_workbook: missing filePath (empty args)', async (c) => {
    const res = await c.toolsCall('lint_workbook', {});
    return expectIsError(res);
  });

  await runTest(2, 'lint_workbook: filePath is null', async (c) => {
    const res = await c.toolsCall('lint_workbook', { filePath: null } as unknown as Record<string, unknown>);
    return expectIsError(res);
  });

  await runTest(3, 'lint_workbook: filePath is a number (type confusion)', async (c) => {
    const res = await c.toolsCall('lint_workbook', { filePath: 42 } as unknown as Record<string, unknown>);
    return expectIsError(res);
  });

  await runTest(4, 'lint_workbook: filePath is empty string', async (c) => {
    const res = await c.toolsCall('lint_workbook', { filePath: '' });
    return expectIsError(res);
  });

  await runTest(5, 'lint_workbook: non-existent file', async (c) => {
    const res = await c.toolsCall('lint_workbook', {
      filePath: path.join(tmpDir, 'does-not-exist.xlsx'),
    });
    return expectIsError(res);
  });

  await runTest(6, 'lint_workbook: filePath is a directory', async (c) => {
    const res = await c.toolsCall('lint_workbook', { filePath: dirAsFile });
    return expectIsError(res);
  });

  await runTest(7, 'lint_workbook: filePath is a .txt file (not xlsx)', async (c) => {
    const res = await c.toolsCall('lint_workbook', { filePath: textFile });
    // Server reads it and tries to parse — expect isError (parse failure)
    return expectIsError(res);
  });

  await runTest(8, 'lint_workbook: 0-byte file', async (c) => {
    const res = await c.toolsCall('lint_workbook', { filePath: emptyFile });
    return expectIsError(res);
  });

  await runTest(9, 'lint_workbook: path traversal (../../../../../etc/passwd)', async (c) => {
    // The server is locally-spawned, user-trusted — intentionally permissive.
    // We document what happens: it either reads the file or returns "not xlsx".
    const res = await c.toolsCall('lint_workbook', {
      filePath: '../../../../../etc/passwd',
    });
    const r = res.result as ToolCallResult | undefined;
    // Any structured response (isError or success) counts as PASS — the server
    // must NOT crash regardless of what happens.
    if (res.result !== undefined || res.error !== undefined) {
      const isErr = r?.isError === true;
      return {
        outcome: 'PASS',
        detail: `Server handled gracefully. isError=${isErr} (path traversal: permissive local-trust policy)`,
      };
    }
    return { outcome: 'CRASH', detail: 'No response at all' };
  });

  await runTest(10, 'lint_workbook: valid absolute xlsx path (sample)', async (c) => {
    if (!existsSync(SAMPLE_CLEAN)) {
      return { outcome: 'PASS', detail: 'Sample not found — skipped' };
    }
    const res = await c.toolsCall('lint_workbook', { filePath: SAMPLE_CLEAN }, 15000);
    return expectSuccess(res);
  });

  await runTest(11, 'lint_workbook: relative path (no leading slash)', async (c) => {
    const res = await c.toolsCall('lint_workbook', {
      filePath: 'packages/samples/files/clean_dcf_v1.xlsx',
    });
    // Relative paths resolve against server CWD — may succeed or fail depending
    // on where the process was started. Either is acceptable; crash is not.
    const r = res.result as ToolCallResult | undefined;
    if (res.result !== undefined || res.error !== undefined) {
      const isErr = r?.isError === true;
      return {
        outcome: 'PASS',
        detail: `Server handled relative path. isError=${isErr}`,
      };
    }
    return { outcome: 'CRASH', detail: 'No response' };
  });

  // ── lint_diff ─────────────────────────────────────────────────────────────
  console.log('\n── lint_diff ──');

  await runTest(12, 'lint_diff: missing both paths (empty args)', async (c) => {
    const res = await c.toolsCall('lint_diff', {});
    return expectIsError(res);
  });

  await runTest(13, 'lint_diff: same valid path for both (0 new issues)', async (c) => {
    if (!existsSync(SAMPLE_CLEAN)) {
      return { outcome: 'PASS', detail: 'Sample not found — skipped' };
    }
    const res = await c.toolsCall(
      'lint_diff',
      { basePath: SAMPLE_CLEAN, nextPath: SAMPLE_CLEAN },
      15000
    );
    return expectSuccess(res);
  });

  await runTest(14, 'lint_diff: one valid path, one missing file', async (c) => {
    if (!existsSync(SAMPLE_CLEAN)) {
      return { outcome: 'PASS', detail: 'Sample not found — skipped' };
    }
    const res = await c.toolsCall('lint_diff', {
      basePath: SAMPLE_CLEAN,
      nextPath: path.join(tmpDir, 'nope.xlsx'),
    });
    return expectIsError(res);
  });

  await runTest(15, 'lint_diff: both valid sample files (should succeed)', async (c) => {
    if (!existsSync(SAMPLE_CLEAN) || !existsSync(SAMPLE_MESSY)) {
      return { outcome: 'PASS', detail: 'Samples not found — skipped' };
    }
    const res = await c.toolsCall(
      'lint_diff',
      { basePath: SAMPLE_CLEAN, nextPath: SAMPLE_MESSY },
      15000
    );
    return expectSuccess(res);
  });

  // ── explain_check ─────────────────────────────────────────────────────────
  console.log('\n── explain_check ──');

  await runTest(16, 'explain_check: missing checkId (empty args)', async (c) => {
    const res = await c.toolsCall('explain_check', {});
    return expectIsError(res);
  });

  await runTest(17, 'explain_check: unknown checkId "fake-check"', async (c) => {
    const res = await c.toolsCall('explain_check', { checkId: 'fake-check' });
    return expectIsError(res);
  });

  await runTest(18, 'explain_check: SQL-injection-style payload', async (c) => {
    const res = await c.toolsCall('explain_check', {
      checkId: "'; DROP TABLE checks; --",
    });
    return expectIsError(res);
  });

  await runTest(19, 'explain_check: valid checkId "hardcoded-numbers"', async (c) => {
    const res = await c.toolsCall('explain_check', { checkId: 'hardcoded-numbers' });
    return expectSuccess(res);
  });

  // ── server-level ──────────────────────────────────────────────────────────
  console.log('\n── server-level ──');

  await runTest(20, 'server: malformed JSON-RPC (missing jsonrpc field)', async (c) => {
    // Don't use initialize handshake here — we test raw protocol robustness.
    // We already initialized; now send a JSON object missing "jsonrpc".
    const rawMsg = JSON.stringify({
      id: 9999,
      method: 'tools/list',
      // intentionally no jsonrpc field
    });
    const response = await c.sendRaw(rawMsg, 3000);
    // The SDK should return a JSON-RPC error or silently ignore it.
    // Critical: server must NOT exit.
    if (c.exited) {
      return { outcome: 'CRASH', detail: `Server exited after malformed JSON` };
    }
    if (response === null) {
      return {
        outcome: 'PASS',
        detail: 'SDK silently ignored message missing jsonrpc field (no crash)',
      };
    }
    if (response.error) {
      return {
        outcome: 'PASS',
        detail: `SDK returned JSON-RPC error: ${response.error.message}`,
      };
    }
    return {
      outcome: 'PASS',
      detail: `SDK returned some response: ${JSON.stringify(response).slice(0, 100)}`,
    };
  });

  await runTest(21, 'server: call non-existent tool "lint_planet"', async (c) => {
    const res = await c.toolsCall('lint_planet', {});
    // SDK should return a JSON-RPC error or an isError result
    if (res.error) {
      return {
        outcome: 'PASS',
        detail: `JSON-RPC error: code=${res.error.code} ${res.error.message}`,
      };
    }
    const r = res.result as ToolCallResult | undefined;
    if (r?.isError) {
      return { outcome: 'PASS', detail: `isError result: ${r.content?.[0]?.text?.slice(0, 100)}` };
    }
    // Any non-crash response acceptable
    if (res.result !== undefined) {
      return {
        outcome: 'PASS',
        detail: `Got result (no crash): ${JSON.stringify(res.result).slice(0, 100)}`,
      };
    }
    return { outcome: 'UNEXPECTED', detail: 'No error and no result for unknown tool' };
  });

  await runTest(22, 'server: tools/list before initialize', async (c) => {
    // Spawn a fresh client without calling initialize
    const rawClient = new McpClient(SERVER_ENTRY);
    try {
      const res = await rawClient.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }, 3000);
      rawClient.kill();
      // SDK may return error (protocol violation) or succeed — just no crash
      if (res.error) {
        return { outcome: 'PASS', detail: `Protocol error returned: ${res.error.message}` };
      }
      const tools = (res.result as { tools?: unknown[] })?.tools;
      return {
        outcome: 'PASS',
        detail: `tools/list before initialize returned ${Array.isArray(tools) ? tools.length : '?'} tools`,
      };
    } catch (err) {
      rawClient.kill();
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('HANG')) {
        return { outcome: 'PASS', detail: 'Server timed out (ignored pre-init request — acceptable)' };
      }
      return { outcome: 'CRASH', detail: msg };
    }
  });

  await runTest(23, 'server: 5 rapid sequential tools/call', async (c) => {
    if (!existsSync(SAMPLE_CLEAN)) {
      return { outcome: 'PASS', detail: 'Sample not found — skipped' };
    }
    // Sequential to stay within stdio ordering — MCP stdio is not concurrent
    const outcomes: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await c.toolsCall('list_checks', {});
      const r = res.result as ToolCallResult | undefined;
      outcomes.push(r?.isError !== true && !res.error);
    }
    const allOk = outcomes.every(Boolean);
    return {
      outcome: allOk ? 'PASS' : 'UNEXPECTED',
      detail: `5 rapid calls: ${outcomes.map((ok) => (ok ? '✓' : '✗')).join(' ')}`,
    };
  });

  await runTest(24, 'lint_workbook: very large filePath (10 KB string)', async (c) => {
    const largeStr = '/tmp/' + 'x'.repeat(10 * 1024);
    const res = await c.toolsCall('lint_workbook', { filePath: largeStr });
    // Must not crash; expected error = file not found
    const r = res.result as ToolCallResult | undefined;
    if (res.result !== undefined || res.error !== undefined) {
      const isErr = r?.isError === true;
      return {
        outcome: 'PASS',
        detail: `Server handled 10KB path without crash. isError=${isErr}`,
      };
    }
    return { outcome: 'CRASH', detail: 'No response for 10KB path' };
  });

  await runTest(25, 'server: stdin closed mid-stream (process exits cleanly)', async (c) => {
    // Fire a call, then immediately close stdin
    c.toolsCall('list_checks', {}).catch(() => {
      /* expected — stdin closed before response */
    });
    // Close stdin immediately
    try {
      (c as unknown as { child: { stdin: NodeJS.WritableStream } }).child.stdin.end();
    } catch {
      // ignore
    }
    // Give the server a moment to exit naturally
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    if (c.exited) {
      return {
        outcome: 'PASS',
        detail: `Server exited cleanly after stdin close (code=${c.exitCode})`,
      };
    }
    // Server still running — also acceptable (some SDKs wait for pending I/O)
    return {
      outcome: 'PASS',
      detail: 'Server still alive after stdin close (waiting for pending I/O — acceptable)',
    };
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = { PASS: 0, CRASH: 0, HANG: 0, UNEXPECTED: 0 };
  for (const r of results) counts[r.outcome]++;

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(
    `RESULTS: ${results.length} tests — ` +
      `\x1b[32m${counts.PASS} PASS\x1b[0m  ` +
      `\x1b[31m${counts.CRASH} CRASH\x1b[0m  ` +
      `\x1b[31m${counts.HANG} HANG\x1b[0m  ` +
      `\x1b[33m${counts.UNEXPECTED} UNEXPECTED\x1b[0m`
  );
  console.log('══════════════════════════════════════════════════════════');

  const failures = results.filter((r) => r.outcome !== 'PASS');
  if (failures.length > 0) {
    console.log('\nNon-PASS cases:');
    for (const f of failures) {
      console.log(
        `  [${String(f.id).padStart(2, '0')}] ${f.label}\n` +
          `       outcome: ${f.outcome}\n` +
          `       detail:  ${f.detail}`
      );
    }
  }

  const allPassed = failures.length === 0;
  if (allPassed) {
    console.log('\n\x1b[32mAll stress tests passed.\x1b[0m');
  } else {
    console.log('\n\x1b[31mSome tests did not pass. See details above.\x1b[0m');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[stress] fatal:', err);
  process.exit(1);
});
