#!/usr/bin/env node
/**
 * Sprint 5 (Faza 6) — sitemap integrity guard.
 *
 * PROBLEM: Search Console reports ~1000 "discovered - not indexed" URLs and 24 404s. A sitemap
 * that advertises redirect stubs, noindex pages, duplicates or missing files burns crawl budget
 * and teaches Google that the whole sitemap is low quality.
 *
 * SOLUTION: fail the build when the sitemap contains a URL that must never be submitted:
 *   - a legacy redirect stub (meta http-equiv="refresh"),
 *   - a page whose own HTML says robots: noindex,
 *   - a static .html file that no longer exists on disk,
 *   - a duplicate <loc>.
 *
 * SPA routes with no static file are not flagged here: they are rendered client-side and covered
 * by scripts/seo/audit-pseo-index-policy.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const BASE = 'https://edooqoo.com';

const sitemap = fs.readFileSync(path.join(PUBLIC, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());

const failures = [];
const seen = new Set();

for (const loc of locs) {
  if (seen.has(loc)) failures.push(`duplicate <loc>: ${loc}`);
  seen.add(loc);

  if (!loc.startsWith(`${BASE}/`) && loc !== `${BASE}/`) {
    failures.push(`off-domain <loc>: ${loc}`);
    continue;
  }

  const route = loc.slice(BASE.length) || '/';
  if (!route.endsWith('.html')) continue;

  const file = path.join(PUBLIC, route.replace(/^\//, ''));
  if (!fs.existsSync(file)) {
    failures.push(`sitemap URL has no file on disk (404 risk): ${route}`);
    continue;
  }

  const head = fs.readFileSync(file, 'utf8').slice(0, 4000);
  if (/http-equiv=["']refresh["']/i.test(head)) {
    failures.push(`redirect stub must not be in the sitemap: ${route}`);
  }
  if (/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(head)) {
    failures.push(`noindex page must not be in the sitemap: ${route}`);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  urls: locs.length,
  uniqueUrls: seen.size,
  failures: failures.length,
  issues: failures,
};
fs.writeFileSync(
  path.join(ROOT, 'docs', 'seo', 'sitemap-integrity.generated.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);

if (failures.length) {
  console.error(`[sitemap-integrity] FAIL ${failures.length} issue(s)\n- ${failures.slice(0, 40).join('\n- ')}`);
  process.exit(1);
}

console.log(`[sitemap-integrity] PASS ${locs.length} URL(s), 0 stubs, 0 noindex, 0 missing files`);
