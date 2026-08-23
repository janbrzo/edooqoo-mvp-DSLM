#!/usr/bin/env node
/**
 * Sprint 4 (Faza 4) — CI guard for AI-readable structured data and citation coverage.
 *
 * Verifies, without a browser:
 * 1. every JSON-LD script in public/**.html parses as valid JSON;
 * 2. every JSON-LD node declares @context and @type;
 * 3. no duplicate @id inside a single document;
 * 4. the sitewide Organization/SoftwareApplication graph is present in index.html;
 * 5. citation-block coverage across high-intent pages meets the Sprint 4 minimum.
 *
 * Usage: node scripts/seo/audit-structured-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITATION_MARKER } from './citation-blocks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const MIN_CITATION_PAGES = 60;

const failures = [];
let documents = 0;
let jsonLdBlocks = 0;
let citationPages = 0;

const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['assets', 'lovable-uploads'].includes(entry.name)) continue;
      out.push(...walk(full));
    } else if (entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
};

const scriptRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

for (const file of walk(PUBLIC)) {
  const rel = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf8');
  documents += 1;
  if (html.includes(`${CITATION_MARKER}="true"`)) citationPages += 1;

  const ids = new Set();
  for (const match of html.matchAll(scriptRegex)) {
    jsonLdBlocks += 1;
    let parsed;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch (error) {
      failures.push(`${rel}: invalid JSON-LD (${error.message})`);
      continue;
    }

    const nodes = Array.isArray(parsed['@graph'])
      ? parsed['@graph']
      : Array.isArray(parsed)
        ? parsed
        : [parsed];

    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        failures.push(`${rel}: JSON-LD node is not an object`);
        continue;
      }
      if (!node['@type']) failures.push(`${rel}: JSON-LD node without @type`);
      if (node['@id']) {
        if (ids.has(node['@id'])) failures.push(`${rel}: duplicate @id ${node['@id']}`);
        ids.add(node['@id']);
      }
    }

    if (!Array.isArray(parsed) && !parsed['@context']) {
      failures.push(`${rel}: JSON-LD block without @context`);
    }
  }
}

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const required of ['"Organization"', '"SoftwareApplication"', '"WebSite"']) {
  if (!indexHtml.includes(required)) failures.push(`index.html missing sitewide ${required} JSON-LD`);
}

if (citationPages < MIN_CITATION_PAGES) {
  failures.push(`citation coverage ${citationPages} < required minimum ${MIN_CITATION_PAGES}`);
}

const report = {
  documents,
  jsonLdBlocks,
  citationPages,
  failures: failures.length,
};
fs.writeFileSync(
  path.join(ROOT, 'docs', 'seo', 'structured-data.generated.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

console.log(`[audit-structured-data] ${JSON.stringify(report)}`);

if (failures.length) {
  console.error(`[audit-structured-data] FAIL\n- ${failures.slice(0, 40).join('\n- ')}`);
  process.exit(1);
}

console.log('[audit-structured-data] PASS');
