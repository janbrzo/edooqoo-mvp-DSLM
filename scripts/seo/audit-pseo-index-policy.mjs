#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPseoRouteInventory } from './pseo-index-policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const sitemap = fs.readFileSync(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8');
const inventory = getPseoRouteInventory({ root: ROOT });
const sitemapPseoRoutes = [...sitemap.matchAll(
  /<loc>https:\/\/edooqoo\.com(\/(?:esl-worksheets\/[^/<]+\/[^<]+|worksheets\/[^/<]+\/[^<]+|english-for\/[^<]+))<\/loc>/g,
)].map((match) => match[1]).sort();
const failures = [];

if (JSON.stringify(sitemapPseoRoutes) !== JSON.stringify(inventory.indexable)) {
  failures.push(
    `Sitemap pSEO routes differ from policy: sitemap=${sitemapPseoRoutes.length}, policy=${inventory.indexable.length}`,
  );
}

for (const rel of [
  'src/pages/seo/programmatic/TopicLevelPage.tsx',
  'src/pages/seo/programmatic/ExerciseTopicPage.tsx',
  'src/pages/seo/programmatic/PersonaPage.tsx',
]) {
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (!source.includes("'noindex,follow'")) failures.push(`${rel} does not apply noindex,follow`);
  if (!source.includes('decisionCriteria={policy}')) failures.push(`${rel} does not render decision criteria`);
}

const generatedPath = path.join(ROOT, 'docs', 'seo', 'pseo-index-policy.generated.json');
if (!fs.existsSync(generatedPath)) {
  failures.push('Missing generated pSEO inventory');
} else {
  const generated = JSON.parse(fs.readFileSync(generatedPath, 'utf8'));
  if (generated.counts.indexable !== inventory.indexable.length) failures.push('Generated indexable count is stale');
  if (generated.counts.noindex !== inventory.noindex.length) failures.push('Generated noindex count is stale');
}


/**
 * Sprint 5 (Faza 6) — three-layer cross-check.
 * Policy (pseoIndexPolicy.json), prerendered HTML (meta robots) and sitemap membership must
 * agree for every pSEO route that has a static file. A disagreement means Google receives two
 * contradictory instructions for the same URL.
 */
const sitemapRouteSet = new Set(
  [...sitemap.matchAll(/<loc>https:\/\/edooqoo\.com([^<]*)<\/loc>/g)].map((m) => m[1] || '/'),
);

function prerenderedFile(route) {
  const candidates = [
    path.join(ROOT, 'public', `${route.replace(/^\//, '')}.html`),
    path.join(ROOT, 'public', route.replace(/^\//, ''), 'index.html'),
  ];
  return candidates.find((file) => fs.existsSync(file)) || null;
}

function robotsMeta(file) {
  const html = fs.readFileSync(file, 'utf8');
  const match = html.match(/<meta[^>]+name="robots"[^>]*content="([^"]+)"/i)
    || html.match(/<meta[^>]+content="([^"]+)"[^>]*name="robots"/i);
  return (match?.[1] || '').toLowerCase().replace(/\s+/g, '');
}

const crossCheck = { checked: 0, missingPrerender: [] };
for (const [route, expectIndexable] of [
  ...inventory.indexable.map((route) => [route, true]),
  ...inventory.noindex.map((route) => [route, false]),
]) {
  const file = prerenderedFile(route);
  if (!file) {
    if (route.startsWith('/english-for/')) crossCheck.missingPrerender.push(route);
    continue;
  }
  crossCheck.checked += 1;

  const robots = robotsMeta(file);
  const inSitemap = sitemapRouteSet.has(route);
  if (expectIndexable) {
    if (robots.includes('noindex')) failures.push(`${route}: policy=index but prerendered HTML says noindex`);
    if (!inSitemap) failures.push(`${route}: policy=index but URL is missing from sitemap.xml`);
  } else {
    if (!robots.includes('noindex')) failures.push(`${route}: policy=noindex but prerendered HTML says "${robots || 'no robots meta'}"`);
    if (inSitemap) failures.push(`${route}: policy=noindex but URL is listed in sitemap.xml`);
  }
}

if (crossCheck.missingPrerender.length) {
  failures.push(
    `Persona routes without prerendered HTML (crawlers get the SPA shell): ${crossCheck.missingPrerender.join(', ')}`,
  );
}

if (failures.length) {
  console.error(`[pseo-policy-audit] FAIL\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `[pseo-policy-audit] PASS cross-checked ${crossCheck.checked} prerendered route(s);  ${inventory.indexable.length} indexed, ${inventory.noindex.length} noindex routes`,
);
