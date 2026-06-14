#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BLOG = path.join(ROOT, 'public', 'blog');
const PUBLIC = path.join(ROOT, 'public');
const CHECK_ONLY = process.argv.includes('--check');

const REPLACEMENTS = new Map([
  ['â€”', '—'],
  ['â€“', '–'],
  ['Â·', '·'],
  ['â†’', '→'],
  ['â†', '←'],
  ['âś…', '✅'],
  ['âťŚ', '❌'],
  ['â­', '⭐'],
  ['←', '←'],
  ['←’', '→'],
  ['"”', '—'],
]);

const SUSPICIOUS = /â€”|â€“|Â·|â†[’]|âťŚ|âś…|â­|←[’]|�/g;
const files = [
  ...(await fs.readdir(BLOG))
    .filter((name) => name.endsWith('.html'))
    .map((name) => path.join(BLOG, name)),
  ...(await fs.readdir(PUBLIC))
    .filter((name) => name.endsWith('.html'))
    .map((name) => path.join(PUBLIC, name)),
];
let changed = 0;
let remaining = 0;

for (const file of files) {
  const name = path.relative(PUBLIC, file).replaceAll('\\', '/');
  const original = await fs.readFile(file, 'utf8');
  let repaired = original.replace(/^\uFEFF/, '');
  for (const [bad, good] of REPLACEMENTS) repaired = repaired.split(bad).join(good);

  const unresolved = repaired.match(SUSPICIOUS) || [];
  if (unresolved.length) {
    remaining += unresolved.length;
    console.error(`[encoding] ${name}: unresolved ${[...new Set(unresolved)].join(', ')}`);
  }
  if (repaired !== original) {
    changed += 1;
    if (!CHECK_ONLY) await fs.writeFile(file, repaired, 'utf8');
  }
}

if (CHECK_ONLY && changed > 0) {
  console.error(`[encoding] ${changed} files still require normalization.`);
  process.exit(1);
}
if (remaining > 0) process.exitCode = 1;
console.log(`[encoding] ${CHECK_ONLY ? 'Checked' : 'Repaired'} ${files.length} public HTML files; changed=${changed}; unresolved=${remaining}`);
