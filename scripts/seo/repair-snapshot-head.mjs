#!/usr/bin/env node
/**
 * Sprint 2 (S2-A) — one-off repair of already committed prerender snapshots.
 *
 * `prerender-spa-routes.mjs` now dedupes head metadata at generation time, but
 * the snapshots currently committed under `public/**\/index.html` were produced
 * before that fix and still carry the duplicated static tags. Running the full
 * prerender requires a Vite build plus Chromium for 500+ routes; this script
 * applies the exact same transformation directly to the committed HTML so the
 * fix ships immediately and the next full prerender is a no-op.
 *
 * Usage:
 *   node scripts/seo/repair-snapshot-head.mjs            # rewrite public/**\/*.html
 *   node scripts/seo/repair-snapshot-head.mjs --check     # report only, exit 1 if dirty
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dedupeHeadMeta } from './head-meta-dedupe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CHECK_ONLY = process.argv.includes('--check');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = fs.existsSync(PUBLIC_DIR) ? walk(PUBLIC_DIR) : [];
const changed = [];

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const repaired = dedupeHeadMeta(html);
  if (repaired === html) continue;
  changed.push(path.relative(ROOT, file));
  if (!CHECK_ONLY) fs.writeFileSync(file, repaired);
}

console.log(
  `[repair-snapshot-head] scanned ${files.length} files, ${changed.length} ${CHECK_ONLY ? 'need repair' : 'repaired'}`,
);
for (const rel of changed.slice(0, 10)) console.log(`  - ${rel}`);
if (changed.length > 10) console.log(`  … and ${changed.length - 10} more`);

if (CHECK_ONLY && changed.length > 0) process.exit(1);
