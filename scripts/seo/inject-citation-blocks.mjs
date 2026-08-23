#!/usr/bin/env node
/**
 * Sprint 4 (Faza 4) — inject GEO citation blocks into static/prerendered HTML.
 *
 * Idempotent: existing blocks are stripped and rewritten, so running twice is a no-op diff.
 * Runs after every content generator (build:seo) so regenerated pages never lose the block.
 *
 * Usage: node scripts/seo/inject-citation-blocks.mjs [--check]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCitation, citationHtml, CITATION_BLOCK_REGEX } from './citation-blocks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const CHECK = process.argv.includes('--check');
const BASE = 'https://edooqoo.com';

/** High-intent surfaces only. pSEO noindex routes and private app routes are excluded. */
const INCLUDE_PREFIXES = ['blog/'];
const EXCLUDE_DIRS = new Set(['worksheets', 'esl-worksheets', 'english-for', 'assets', 'lovable-uploads']);

const readMeta = (html, pattern) => {
  const match = html.match(pattern);
  return match ? match[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim() : '';
};

async function collectTargets() {
  const files = [];

  const rootEntries = await fs.readdir(PUBLIC, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(entry.name);
  }

  for (const prefix of INCLUDE_PREFIXES) {
    const dir = path.join(PUBLIC, prefix);
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.html')) files.push(`${prefix}${entry.name}`);
    }
  }

  return files.filter((rel) => !EXCLUDE_DIRS.has(rel.split('/')[0]));
}

function insert(html, block) {
  const stripped = html.replace(CITATION_BLOCK_REGEX, '');
  for (const anchor of ['</main>', '</body>']) {
    const index = stripped.lastIndexOf(anchor);
    if (index >= 0) return `${stripped.slice(0, index)}${block}\n${stripped.slice(index)}`;
  }
  return `${stripped}\n${block}\n`;
}

async function main() {
  const targets = await collectTargets();
  let changed = 0;
  let injected = 0;
  let skipped = 0;

  for (const rel of targets) {
    const file = path.join(PUBLIC, rel);
    const html = await fs.readFile(file, 'utf8');
    const slug = rel.replace(/\.html$/, '');
    const url = `${BASE}/${rel}`;

    const title = readMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = readMeta(html, /<meta\s+name="description"\s+content="([^"]*)"/i);

    const citation = buildCitation({ slug, title, description, url });
    if (!citation) {
      skipped += 1;
      continue;
    }

    injected += 1;
    const block = citationHtml(citation.text, url);
    if (html.includes(block)) continue;

    const next = insert(html, block);
    if (next === html) continue;
    changed += 1;
    if (CHECK) {
      console.error(`[citation-blocks] STALE citation block: public/${rel}`);
      continue;
    }
    await fs.writeFile(file, next, 'utf8');
  }

  if (CHECK && changed > 0) {
    console.error(`[citation-blocks] FAIL ${changed} file(s) need a citation-block refresh`);
    process.exit(1);
  }

  console.log(
    `[citation-blocks] ${CHECK ? 'checked' : 'wrote'} ${injected} block(s) across ${targets.length} page(s); ` +
      `${changed} updated, ${skipped} skipped (insufficient metadata)`,
  );
}

main().catch((error) => {
  console.error('[citation-blocks] ERROR', error);
  process.exit(1);
});
