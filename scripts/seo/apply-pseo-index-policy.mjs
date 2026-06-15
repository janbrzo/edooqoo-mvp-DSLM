#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPseoRouteInventory } from './pseo-index-policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SITEMAP_PATH = path.join(ROOT, 'public', 'sitemap.xml');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'seo', 'pseo-index-policy.generated.json');
const BASE = 'https://edooqoo.com';
const LAST_MODIFIED = '2026-06-15';

const inventory = getPseoRouteInventory({ root: ROOT });
let sitemap = await fs.readFile(SITEMAP_PATH, 'utf8');

sitemap = sitemap.replace(
  /\s*<url>\s*<loc>https:\/\/edooqoo\.com\/(?:esl-worksheets\/[^/<]+\/[^<]+|worksheets\/[^/<]+\/[^<]+|english-for\/[^<]+)<\/loc>[\s\S]*?<\/url>\s*/g,
  '\n',
);

const entries = inventory.indexable.map(
  (route) =>
    `  <url><loc>${BASE}${route}</loc><lastmod>${LAST_MODIFIED}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
).join('\n');

sitemap = sitemap
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/\n*<\/urlset>\s*$/, `\n${entries}\n</urlset>\n`);

await fs.writeFile(SITEMAP_PATH, sitemap, 'utf8');
await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await fs.writeFile(
  OUTPUT_PATH,
  `${JSON.stringify({
    schemaVersion: 1,
    source: 'src/data/pseoIndexPolicy.json',
    counts: {
      indexable: inventory.indexable.length,
      noindex: inventory.noindex.length,
      topicLevel: inventory.indexableTopicLevelRoutes.length,
      exerciseTopic: inventory.indexableExerciseTopicRoutes.length,
      personas: inventory.indexablePersonaRoutes.length,
    },
    indexableRoutes: inventory.indexable,
    noindexRoutes: inventory.noindex,
  }, null, 2)}\n`,
  'utf8',
);

console.log(
  `[pseo-policy] Sitemap now contains ${inventory.indexable.length} indexed pSEO routes; ${inventory.noindex.length} routes remain available with noindex.`,
);
