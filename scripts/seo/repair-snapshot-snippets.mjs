#!/usr/bin/env node
/**
 * Sprint 3 (S3-A) — clamp SERP snippets in already committed HTML snapshots.
 *
 * The React pSEO templates now clamp titles/descriptions through
 * `src/utils/seoSnippet.ts`, but the snapshots committed under `public/`
 * predate that change and still ship truncated SERP snippets. Running the full
 * prerender needs a Vite build plus Chromium for 500+ routes; this script
 * applies the identical clamping rules directly to the committed HTML so the
 * next full prerender is a no-op.
 *
 * Usage:
 *   node scripts/seo/repair-snapshot-snippets.mjs --dir=worksheets --dir=esl-worksheets
 *   node scripts/seo/repair-snapshot-snippets.mjs --check          # report only
 *   node scripts/seo/repair-snapshot-snippets.mjs                  # all of public/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clampDescription, clampTitle } from './snippet-clamp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CHECK_ONLY = process.argv.includes('--check');
const DIRS = process.argv
  .filter((arg) => arg.startsWith('--dir='))
  .map((arg) => arg.slice('--dir='.length));

const decode = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
const encodeAttr = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const encodeText = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const TITLE_META = ['og:title', 'twitter:title'];
const DESC_META = ['description', 'og:description', 'twitter:description'];

function repairHtml(html) {
  let out = html;

  out = out.replace(/<title([^>]*)>([\s\S]*?)<\/title>/gi, (match, attrs, inner) => {
    const clamped = clampTitle(decode(inner));
    return `<title${attrs}>${encodeText(clamped)}</title>`;
  });

  for (const name of [...TITLE_META, ...DESC_META]) {
    const isTitle = TITLE_META.includes(name);
    const attr = name.startsWith('og:') ? 'property' : 'name';
    const pattern = new RegExp(
      `(<meta\\b[^>]*\\b${attr}=["']${name}["'][^>]*\\bcontent=["'])([^"']*)(["'])`,
      'gi',
    );
    const patternReversed = new RegExp(
      `(<meta\\b[^>]*\\bcontent=["'])([^"']*)(["'][^>]*\\b${attr}=["']${name}["'])`,
      'gi',
    );
    const apply = (_m, before, value, after) => {
      const clamped = isTitle ? clampTitle(decode(value)) : clampDescription(decode(value));
      return `${before}${encodeAttr(clamped)}${after}`;
    };
    out = out.replace(pattern, apply).replace(patternReversed, apply);
  }

  return out;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const roots = DIRS.length ? DIRS.map((d) => path.join(PUBLIC_DIR, d)) : [PUBLIC_DIR];
const files = roots.flatMap((dir) => walk(dir));
const changed = [];

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const repaired = repairHtml(html);
  if (repaired === html) continue;
  changed.push(path.relative(ROOT, file));
  if (!CHECK_ONLY) fs.writeFileSync(file, repaired);
}

console.log(
  `[repair-snapshot-snippets] scope: ${DIRS.length ? DIRS.join(', ') : 'public/'} — scanned ${files.length} files, ${changed.length} ${CHECK_ONLY ? 'need repair' : 'repaired'}`,
);
for (const rel of changed.slice(0, 10)) console.log(`  - ${rel}`);
if (changed.length > 10) console.log(`  … and ${changed.length - 10} more`);

if (CHECK_ONLY && changed.length > 0) process.exit(1);
