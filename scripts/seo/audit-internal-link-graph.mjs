#!/usr/bin/env node
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getContentRegistry } from './content-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const OUTPUT_JSON = path.join(ROOT, 'docs', 'seo', 'internal-link-graph.generated.json');
const OUTPUT_MD = path.join(ROOT, 'docs', 'seo', 'internal-link-graph.generated.md');
const SOFT = process.argv.includes('--soft');
const MIN_TOP_40_INCOMING = 10;
const MIN_TOP_120_INCOMING = 5;

const priorityRoutes = new Set([
  // Sprint 3 (Faza 3) cluster hubs — see scripts/seo/cluster-hubs.mjs
  '/cefr-assessment',
  '/teaching-english-pronunciation',
  '/esl-exercise-design',
  '/tutor-operations',
  '/one-minute-prep',
  '/how-it-works',
  '/resources',
  '/gallery',
  '/features/homework',
  '/features/dslm',
  '/edooqoo-vs-chatgpt.html',
  '/chatgpt-alternative-for-english-tutors.html',
  '/what-to-teach-next',
]);

function htmlFiles(dir) {
  const files = [];
  for (const item of fsSync.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...htmlFiles(full));
    else if (item.isFile() && item.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function routeFromFile(file) {
  const relative = path.relative(PUBLIC, file).replace(/\\/g, '/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.replace(/\/index\.html$/, '')}`;
  return `/${relative}`;
}

function normalizeHref(href) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return '';
  try {
    const url = href.startsWith('http') ? new URL(href) : new URL(href, 'https://edooqoo.com');
    if (url.hostname !== 'edooqoo.com') return '';
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    return pathname;
  } catch {
    return '';
  }
}

function extractLinks(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => normalizeHref(match[1]))
    .filter(Boolean);
}

function strategicRank(entry) {
  if (priorityRoutes.has(entry.route)) return 0;
  if (entry.route.startsWith('/edooqoo-vs-') || entry.route.includes('alternative') || entry.route.includes('chatgpt')) return 1;
  if (entry.route.startsWith('/blog/') && /one-minute|homework|what-to-teach|ai-|workflow|student-context|worksheet/.test(entry.route)) return 2;
  if (entry.type === 'blog' || entry.type === 'static-landing') return 3;
  return 9;
}

function isStrategic(entry) {
  return entry.indexable &&
    !entry.redirectTo &&
    ['blog', 'static-landing', 'spa-route'].includes(entry.type) &&
    strategicRank(entry) <= 3;
}

async function main() {
  const registry = getContentRegistry({ root: ROOT });
  const byRoute = new Map(registry.map((entry) => [entry.route, entry]));
  const outgoing = {};
  const incoming = {};

  for (const file of htmlFiles(PUBLIC)) {
    const route = routeFromFile(file);
    const html = fsSync.readFileSync(file, 'utf8');
    const links = [...new Set(extractLinks(html))];
    outgoing[route] = links;
    for (const link of links) {
      incoming[link] ||= [];
      incoming[link].push(route);
    }
  }

  const strategic = registry
    .filter(isStrategic)
    .sort((a, b) => strategicRank(a) - strategicRank(b) || a.route.localeCompare(b.route));

  const top40 = strategic.slice(0, 40);
  const top120 = strategic.slice(0, 120);
  const orphanStrategic = top120.filter((entry) => !(incoming[entry.route] || []).length);
  const weakTop40 = top40.filter((entry) => (incoming[entry.route] || []).length < MIN_TOP_40_INCOMING);
  const weakTop120 = top120.filter((entry) => (incoming[entry.route] || []).length < MIN_TOP_120_INCOMING);
  const noindexPriorityLinks = registry
    .filter((entry) => !entry.indexable)
    .map((entry) => ({
      route: entry.route,
      incoming: (incoming[entry.route] || []).filter((source) => priorityRoutes.has(source) || source === '/blog' || source === '/resources'),
    }))
    .filter((row) => row.incoming.length);

  const report = {
    generatedBy: 'scripts/seo/audit-internal-link-graph.mjs',
    totals: {
      pages: Object.keys(outgoing).length,
      strategic: strategic.length,
      orphanStrategic: orphanStrategic.length,
      weakTop40: weakTop40.length,
      weakTop120: weakTop120.length,
      noindexPriorityLinks: noindexPriorityLinks.length,
    },
    thresholds: {
      minTop40Incoming: MIN_TOP_40_INCOMING,
      minTop120Incoming: MIN_TOP_120_INCOMING,
    },
    topStrategic: strategic.slice(0, 120).map((entry) => ({
      route: entry.route,
      type: entry.type,
      state: entry.state,
      incoming: (incoming[entry.route] || []).length,
      outgoing: (outgoing[entry.route] || []).length,
    })),
    orphanStrategic: orphanStrategic.map((entry) => entry.route),
    weakTop40: weakTop40.map((entry) => ({
      route: entry.route,
      incoming: (incoming[entry.route] || []).length,
    })),
    weakTop120: weakTop120.map((entry) => ({
      route: entry.route,
      incoming: (incoming[entry.route] || []).length,
    })),
    noindexPriorityLinks,
  };

  const markdown = [
    '# Internal Link Graph Audit',
    '',
    'Generated by `scripts/seo/audit-internal-link-graph.mjs`.',
    '',
    '## Summary',
    '',
    `- HTML pages scanned: ${report.totals.pages}`,
    `- Strategic indexable routes: ${report.totals.strategic}`,
    `- Orphan strategic routes in top 120: ${report.totals.orphanStrategic}`,
    `- Weak top 40 strategic routes below ${MIN_TOP_40_INCOMING} incoming links: ${report.totals.weakTop40}`,
    `- Weak top 120 strategic routes below ${MIN_TOP_120_INCOMING} incoming links: ${report.totals.weakTop120}`,
    `- Noindex routes linked from priority hubs: ${report.totals.noindexPriorityLinks}`,
    '',
    '## Top Strategic Routes',
    '',
    '| Route | Type | State | Incoming | Outgoing |',
    '|---|---|---|---:|---:|',
    ...report.topStrategic.map((row) => `| ${row.route} | ${row.type} | ${row.state} | ${row.incoming} | ${row.outgoing} |`),
    '',
    '## Orphan Strategic Routes',
    '',
    ...(report.orphanStrategic.length ? report.orphanStrategic.map((route) => `- ${route}`) : ['- none']),
    '',
    '## Noindex Routes Linked From Priority Hubs',
    '',
    ...(report.noindexPriorityLinks.length ? report.noindexPriorityLinks.map((row) => `- ${row.route} from ${row.incoming.join(', ')}`) : ['- none']),
    '',
    '## Weak Top 40 Strategic Routes',
    '',
    ...(report.weakTop40.length ? report.weakTop40.map((row) => `- ${row.route}: ${row.incoming} incoming links`) : ['- none']),
    '',
    '## Weak Top 120 Strategic Routes',
    '',
    ...(report.weakTop120.length ? report.weakTop120.map((row) => `- ${row.route}: ${row.incoming} incoming links`) : ['- none']),
    '',
    '## RAG Keywords',
    '',
    'internal link graph, strategic URLs, orphan pages, noindex link audit, adult 1:1 English tutor SEO, Edooqoo topic authority.',
    '',
  ].join('\n');

  await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(OUTPUT_MD, markdown, 'utf8');
  console.log(`[internal-links] strategic=${report.totals.strategic} orphan=${report.totals.orphanStrategic} weakTop40=${report.totals.weakTop40} weakTop120=${report.totals.weakTop120} noindexPriority=${report.totals.noindexPriorityLinks}`);

  if (!SOFT && (
    report.totals.orphanStrategic > 0 ||
    report.totals.weakTop40 > 0 ||
    report.totals.weakTop120 > 0 ||
    report.totals.noindexPriorityLinks > 0
  )) {
    process.exit(1);
  }
}

await main();
