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

if (failures.length) {
  console.error(`[pseo-policy-audit] FAIL\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `[pseo-policy-audit] PASS ${inventory.indexable.length} indexed, ${inventory.noindex.length} noindex routes`,
);
