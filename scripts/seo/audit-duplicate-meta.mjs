#!/usr/bin/env node
/**
 * audit-duplicate-meta.mjs — Sprint 1 (CTR recovery) regression guard.
 *
 * Fails the build when static HTML metadata regresses:
 *   1. the same meta description is used on more than DUPLICATE_GROUP_LIMIT pages
 *   2. <title> is just the slug converted to Title Case
 *   3. title > 60 chars or description > 155 chars
 *   4. description contains banned boilerplate phrases
 *
 * Rules 2-4 are baseline-locked: the current debt is recorded in
 * BASELINE and CI only fails when a count exceeds it. Every sprint that
 * fixes pages must lower the baseline; it must never be raised.
 *
 * Report: docs/seo/duplicate-meta.generated.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const REPORT = path.join(ROOT, 'docs/seo/duplicate-meta.generated.md');

const DUPLICATE_GROUP_LIMIT = 3;
const TITLE_MAX = 60;
const DESC_MAX = 155;
const BANNED_PHRASES = [
  'adult 1:1 English tutor reference',
  'evidence-led planning',
  'non-school-like framing',
];

/** Baseline lock — lower these as pages get rewritten. Never raise them. */
const BASELINE = {
  duplicateGroups: 0,
  duplicatePages: 0,
  slugTitles: 17,
  longTitles: 39,
  longDescriptions: 99,
  bannedPhrases: 0,
};


const WRITE_MODE = process.argv.includes('--write-baseline');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function titleFromSlug(slug) {
  return slug
    .split('-')
    .map((word) => {
      if (word === 'ai') return 'AI';
      if (word === 'esl') return 'ESL';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

const files = fs.existsSync(PUBLIC_DIR) ? walk(PUBLIC_DIR) : [];
const byDescription = new Map();
const slugTitles = [];
const longTitles = [];
const longDescriptions = [];
const banned = [];

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() ?? '';

  if (description) {
    if (!byDescription.has(description)) byDescription.set(description, []);
    byDescription.get(description).push(rel);
    if (description.length > DESC_MAX) longDescriptions.push({ rel, length: description.length });
    if (BANNED_PHRASES.some((phrase) => description.includes(phrase))) banned.push(rel);
  }

  if (title) {
    const slug = path.basename(file, '.html') === 'index'
      ? path.basename(path.dirname(file))
      : path.basename(file, '.html');
    const bare = title.replace(/\s*[|—-]\s*Edooqoo\s*$/, '').trim();
    if (bare && bare === titleFromSlug(slug)) slugTitles.push(rel);
    if (title.length > TITLE_MAX) longTitles.push({ rel, length: title.length });
  }
}

const duplicateGroups = [...byDescription.entries()]
  .filter(([, pages]) => pages.length > DUPLICATE_GROUP_LIMIT)
  .sort((a, b) => b[1].length - a[1].length);
const duplicatePages = duplicateGroups.reduce((sum, [, pages]) => sum + pages.length, 0);

const actual = {
  duplicateGroups: duplicateGroups.length,
  duplicatePages,
  slugTitles: slugTitles.length,
  longTitles: longTitles.length,
  longDescriptions: longDescriptions.length,
  bannedPhrases: banned.length,
};

const lines = [
  '# Duplicate & weak metadata audit (generated)',
  '',
  `Scanned ${files.length} HTML files under \`public/\`.`,
  '',
  '| Metric | Current | Baseline lock |',
  '| --- | --- | --- |',
  ...Object.keys(BASELINE).map((key) => `| ${key} | ${actual[key]} | ${BASELINE[key]} |`),
  '',
  '## Largest duplicate-description groups',
  '',
  ...duplicateGroups.slice(0, 10).flatMap(([description, pages]) => [
    `- **${pages.length} pages** — "${description.slice(0, 110)}…"`,
    `  - e.g. ${pages.slice(0, 3).join(', ')}`,
  ]),
  '',
  '## Sample slug-only titles',
  '',
  ...slugTitles.slice(0, 20).map((rel) => `- ${rel}`),
  '',
];
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, `${lines.join('\n')}\n`);

if (WRITE_MODE) {
  console.log('[audit-duplicate-meta] current counts:', actual);
  process.exit(0);
}

const failures = Object.keys(BASELINE)
  .filter((key) => actual[key] > BASELINE[key])
  .map((key) => `${key}: ${actual[key]} > baseline ${BASELINE[key]}`);

console.log('[audit-duplicate-meta]', JSON.stringify(actual));
console.log(`[audit-duplicate-meta] report: ${path.relative(ROOT, REPORT)}`);

if (failures.length) {
  console.error('[audit-duplicate-meta] FAILED — metadata regressed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('[audit-duplicate-meta] PASS');
