#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(__dirname, '../../../packages/samples/files');
const DEST_DIR = resolve(__dirname, '../public/samples');

const FILES = ['clean_dcf_v1.xlsx', 'messy_dcf_v2.xlsx', 'pristine_dcf.xlsx'];

if (!existsSync(DEST_DIR)) {
  mkdirSync(DEST_DIR, { recursive: true });
}

let copied = 0;
for (const f of FILES) {
  const src = resolve(SRC_DIR, f);
  const dest = resolve(DEST_DIR, f);
  if (!existsSync(src)) {
    console.warn(`[copy-samples] missing: ${src} — skipping`);
    continue;
  }
  copyFileSync(src, dest);
  copied += 1;
}

console.log(`[copy-samples] copied ${copied}/${FILES.length} files to ${DEST_DIR}`);
