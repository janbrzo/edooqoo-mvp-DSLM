#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_STATES, getContentRegistry } from './content-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT = path.join(ROOT, 'docs', 'seo', 'content-registry.generated.json');

const entries = getContentRegistry({ root: ROOT });
const stateCounts = Object.fromEntries(
  CONTENT_STATES.map((state) => [state, entries.filter((entry) => entry.state === state).length]),
);

const payload = {
  schemaVersion: 1,
  generatedFrom: [
    'scripts/seo/content-registry.mjs',
    'src/data/pseoIndexPolicy.json',
    'src/data/whatToTeachNextCases.json',
    'docs/seo/pseo-index-policy.generated.json',
    'public/sitemap.xml',
    'public/blog/*.html',
    'public/*.html',
  ],
  policy: {
    indexableStates: ['keep', 'improve', 'hold'],
    destructiveStatesRequireMeasurement: ['merge', 'retire'],
    measurementSources: ['Google Search Console', 'verified backlink inventory'],
  },
  counts: {
    total: entries.length,
    indexable: entries.filter((entry) => entry.indexable).length,
    byState: stateCounts,
  },
  entries,
};

await fs.writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`[content-registry] Wrote ${entries.length} entries to ${path.relative(ROOT, OUTPUT)}`);
