#!/usr/bin/env node
/**
 * audit-content-uniqueness.mjs: report-only body-text duplication audit.
 *
 * The meta audits (audit-duplicate-meta.mjs) check titles and descriptions;
 * nothing checked whether the visible body of indexable pages is unique.
 * This script measures, for every indexable static HTML page under public/:
 *   - maxContainment: share of the page's 8-word shingles that also appear in
 *     its single most similar indexable page (1.0 = fully contained)
 *   - uniqueShare: share of the page's shingles found on no other indexable page
 *
 * Navigation, header, footer, aside, scripts, styles and link text are ignored
 * so shared menus and related-link blocks do not inflate the score.
 *
 * Report: docs/seo/content-uniqueness.generated.md (+ .json)
 * Exit code is 0 unless --strict is passed and templated pages exist.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SITEMAP = path.join(PUBLIC_DIR, 'sitemap.xml');
const REPORT_MD = path.join(ROOT, 'docs/seo/content-uniqueness.generated.md');
const REPORT_JSON = path.join(ROOT, 'docs/seo/content-uniqueness.generated.json');

const SHINGLE = 8;
const TEMPLATED = 0.5;
const NEAR_DUPLICATE = 0.8;
const STRICT = process.argv.includes('--strict');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;/gi, ' ');
}

function isNoindex(html) {
  const robots = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i);
  return Boolean(robots && /noindex/i.test(robots[0]));
}

function visibleWords(html) {
  const body = html
    .replace(/<(script|style|nav|footer|header|aside|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<a\b[\s\S]*?<\/a>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(body).toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function routeFor(file) {
  let route = '/' + path.relative(PUBLIC_DIR, file).split(path.sep).join('/');
  if (route.endsWith('/index.html')) route = route.slice(0, -'index.html'.length).replace(/\/$/, '') || '/';
  return route;
}

function sectionFor(route) {
  const parts = route.split('/').filter(Boolean);
  return parts.length > 1 ? `/${parts[0]}` : '/ (root pages)';
}

const sitemap = fs.existsSync(SITEMAP) ? fs.readFileSync(SITEMAP, 'utf8') : '';
const inSitemap = (route) => sitemap.includes(`edooqoo.com${route}<`);

const pages = [];
for (const file of walk(PUBLIC_DIR)) {
  const html = fs.readFileSync(file, 'utf8');
  if (isNoindex(html)) continue;
  const words = visibleWords(html);
  const shingles = new Set();
  for (let i = 0; i + SHINGLE <= words.length; i += 1) shingles.add(words.slice(i, i + SHINGLE).join(' '));
  if (shingles.size === 0) continue;
  const route = routeFor(file);
  pages.push({ route, section: sectionFor(route), words: words.length, inSitemap: inSitemap(route), shingles });
}

// Inverted index: shingle -> page indexes.
const postings = new Map();
pages.forEach((page, index) => {
  for (const shingle of page.shingles) {
    const list = postings.get(shingle);
    if (list) list.push(index);
    else postings.set(shingle, [index]);
  }
});

const counts = new Int32Array(pages.length);
const rows = pages.map((page, index) => {
  counts.fill(0);
  let unique = 0;
  for (const shingle of page.shingles) {
    const list = postings.get(shingle);
    if (list.length === 1) unique += 1;
    for (const other of list) if (other !== index) counts[other] += 1;
  }
  let best = 0;
  let nearest = '';
  counts.forEach((count, other) => {
    if (count > best) {
      best = count;
      nearest = pages[other].route;
    }
  });
  return {
    route: page.route,
    section: page.section,
    words: page.words,
    inSitemap: page.inSitemap,
    maxContainment: Number((best / page.shingles.size).toFixed(3)),
    uniqueShare: Number((unique / page.shingles.size).toFixed(3)),
    nearest,
  };
});

const templated = rows.filter((row) => row.maxContainment >= TEMPLATED);
const nearDuplicates = rows.filter((row) => row.maxContainment >= NEAR_DUPLICATE);

const bySection = new Map();
for (const row of rows) {
  const entry = bySection.get(row.section) ?? { pages: 0, templated: 0, nearDuplicate: 0 };
  entry.pages += 1;
  if (row.maxContainment >= TEMPLATED) entry.templated += 1;
  if (row.maxContainment >= NEAR_DUPLICATE) entry.nearDuplicate += 1;
  bySection.set(row.section, entry);
}

const pct = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(0)}%` : 'n/a');
const sortedSections = [...bySection.entries()].sort((a, b) => b[1].pages - a[1].pages);
const worst = [...rows].sort((a, b) => b.maxContainment - a.maxContainment).slice(0, 40);

const md = `# Content uniqueness audit (generated)

Generated by \`scripts/seo/audit-content-uniqueness.mjs\`. Report-only: it does not change pages.

Method: visible body text of every indexable static HTML page in \`public/\` (navigation, header, footer, aside and link text removed), split into ${SHINGLE}-word shingles. \`maxContainment\` is the share of a page's shingles that also appear on its single most similar indexable page.

## Summary

| Metric | Value |
|---|---:|
| Indexable static pages analysed | ${rows.length} |
| Templated (maxContainment >= ${TEMPLATED}) | ${templated.length} (${pct(templated.length, rows.length)}) |
| Near-duplicate (maxContainment >= ${NEAR_DUPLICATE}) | ${nearDuplicates.length} (${pct(nearDuplicates.length, rows.length)}) |
| Templated pages listed in sitemap.xml | ${templated.filter((row) => row.inSitemap).length} |

## By section

| Section | Indexable pages | Templated >= ${TEMPLATED} | Near-duplicate >= ${NEAR_DUPLICATE} |
|---|---:|---:|---:|
${sortedSections.map(([section, s]) => `| ${section} | ${s.pages} | ${s.templated} (${pct(s.templated, s.pages)}) | ${s.nearDuplicate} |`).join('\n')}

## Most duplicated pages

| Route | maxContainment | uniqueShare | Words | Nearest page |
|---|---:|---:|---:|---|
${worst.map((row) => `| ${row.route} | ${row.maxContainment} | ${row.uniqueShare} | ${row.words} | ${row.nearest} |`).join('\n')}

## How to read this

- A page whose body is mostly shared with another page gives Google and answer engines no reason to index or cite it separately.
- Fix by merging, adding real page-specific substance (examples, data, worked cases), or noindexing; do not fix by rewording boilerplate.
- Full per-page data: \`docs/seo/content-uniqueness.generated.json\`.
`;

fs.writeFileSync(REPORT_MD, md);
fs.writeFileSync(REPORT_JSON, `${JSON.stringify({ shingleSize: SHINGLE, thresholds: { templated: TEMPLATED, nearDuplicate: NEAR_DUPLICATE }, rows }, null, 2)}\n`);

console.log(`[content-uniqueness] ${rows.length} indexable pages, ${templated.length} templated (>=${TEMPLATED}), ${nearDuplicates.length} near-duplicate (>=${NEAR_DUPLICATE}).`);
console.log(`[content-uniqueness] report: ${path.relative(ROOT, REPORT_MD)}`);
if (STRICT && templated.length > 0) process.exit(1);
