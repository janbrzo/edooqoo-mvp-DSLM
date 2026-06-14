#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_CLUSTERS, CONTENT_STATES, getContentRegistry } from './content-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const entries = getContentRegistry({ root: ROOT });
const errors = [];
const warnings = [];
const canonicalOwners = new Map();

function addCanonical(entry) {
  if (!entry.canonical || !entry.indexable) return;
  const owners = canonicalOwners.get(entry.canonical) || [];
  owners.push(entry.route);
  canonicalOwners.set(entry.canonical, owners);
}

for (const entry of entries) {
  if (!CONTENT_STATES.includes(entry.state)) errors.push(`${entry.route}: invalid state ${entry.state}`);
  if (!CONTENT_CLUSTERS.includes(entry.cluster)) errors.push(`${entry.route}: invalid cluster ${entry.cluster}`);
  if (entry.state === 'merge' && !entry.redirectTo) errors.push(`${entry.route}: merge requires redirectTo`);
  if (entry.state === 'retire' && entry.redirectTo) errors.push(`${entry.route}: retire cannot define redirectTo`);
  if (entry.indexable && entry.source?.endsWith('.html')) {
    if (!entry.title) errors.push(`${entry.route}: missing title`);
    if (!entry.description) errors.push(`${entry.route}: missing meta description`);
    if (!entry.canonical) errors.push(`${entry.route}: missing canonical`);
    if (entry.canonical && entry.canonical !== `https://edooqoo.com${entry.route}`) {
      errors.push(`${entry.route}: canonical mismatch ${entry.canonical}`);
    }
    if (!entry.datePublished && entry.type === 'blog') warnings.push(`${entry.route}: missing datePublished`);
    if (!entry.author && entry.type === 'blog') warnings.push(`${entry.route}: missing explicit author`);
    if (entry.hasEncodingIssue) errors.push(`${entry.route}: mojibake or replacement character detected`);
  }
  addCanonical(entry);
}

for (const [canonical, owners] of canonicalOwners) {
  if (owners.length > 1) errors.push(`${canonical}: duplicate canonical owners ${owners.join(', ')}`);
}

const sitemap = fs.readFileSync(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8');
const sitemapRoutes = new Set(
  [...sitemap.matchAll(/<loc>https:\/\/edooqoo\.com([^<]*)<\/loc>/g)].map((match) => match[1] || '/'),
);
for (const entry of entries.filter((item) => item.indexable && item.source?.endsWith('.html'))) {
  if (!sitemapRoutes.has(entry.route)) errors.push(`${entry.route}: indexable HTML missing from sitemap`);
}
for (const entry of entries.filter((item) => !item.indexable)) {
  if (sitemapRoutes.has(entry.route)) errors.push(`${entry.route}: non-indexable state ${entry.state} present in sitemap`);
}

for (const warning of warnings.slice(0, 50)) console.warn(`[content-audit] WARN ${warning}`);
if (warnings.length > 50) console.warn(`[content-audit] WARN ${warnings.length - 50} additional warning(s)`);
for (const error of errors) console.error(`[content-audit] FAIL ${error}`);

if (errors.length) process.exit(1);
console.log(`[content-audit] PASS ${entries.length} registry entries; warnings=${warnings.length}`);
