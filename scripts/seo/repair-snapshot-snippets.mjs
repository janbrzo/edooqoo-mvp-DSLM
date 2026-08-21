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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CHECK_ONLY = process.argv.includes('--check');
const DIRS = process.argv
  .filter((arg) => arg.startsWith('--dir='))
  .map((arg) => arg.slice('--dir='.length));

// Keep in sync with src/utils/seoSnippet.ts and scripts/seo/audit-duplicate-meta.mjs.
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;
const BRAND_SUFFIX_PATTERN = /\s*[|—-]\s*Edooqoo\s*$/;

function trimToWordBoundary(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-—|]+$/, '');
}

function clampTitle(title) {
  const normalized = title.trim().replace(/\s+/g, ' ');
  if (normalized.length <= TITLE_MAX) return normalized;
  const bare = normalized.replace(BRAND_SUFFIX_PATTERN, '').trim();
  if (bare.length <= TITLE_MAX) return bare;
  return trimToWordBoundary(bare, TITLE_MAX);
}

function clampDescription(description) {
  const text = description.trim().replace(/\s+/g, ' ');
  if (text.length <= DESCRIPTION_MAX) return text;
  const window = text.slice(0, DESCRIPTION_MAX);
  const lastSentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '));
  if (lastSentence > DESCRIPTION_MAX * 0.55) return window.slice(0, lastSentence + 1).trim();
  return `${trimToWordBoundary(text, DESCRIPTION_MAX - 1)}.`;
}

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
