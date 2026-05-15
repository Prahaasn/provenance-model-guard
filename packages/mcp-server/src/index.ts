#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is the MCP transport channel — all human-readable logs go to stderr.
  console.error('[pmg-mcp] ready');
}

main().catch((err: unknown) => {
  console.error('[pmg-mcp] fatal', err);
  process.exit(1);
});
