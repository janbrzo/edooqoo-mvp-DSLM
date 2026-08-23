#!/usr/bin/env node
/**
 * Sprint 4 (Faza 4) — remove conflicting duplicate JSON-LD @id nodes from shipped HTML.
 *
 * PROBLEM: Helmet emits a route-level node (WebPage, SoftwareApplication) and the prerender
 * step or the sitewide index.html graph emits a node with the SAME @id. Two nodes sharing an
 * @id with different properties make the graph ambiguous, and answer engines drop the entity.
 *
 * RULE: keep the richest single definition of each @id per document. A block is removable only
 * when it contains exactly one node (never a sitewide @graph block), and it loses when another
 * block defines the same @id with more properties.
 *
 * Usage: node scripts/seo/dedupe-jsonld-ids.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const CHECK = process.argv.includes('--check');

const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['assets', 'lovable-uploads'].includes(entry.name)) continue;
      out.push(...walk(full));
    } else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
};

const scriptRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

let changed = 0;
let removed = 0;

for (const file of walk(PUBLIC)) {
  const html = fs.readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(scriptRegex)].map((match) => {
    let parsed = null;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      parsed = null;
    }
    const nodes = parsed
      ? Array.isArray(parsed['@graph'])
        ? parsed['@graph']
        : Array.isArray(parsed)
          ? parsed
          : [parsed]
      : [];
    return { raw: match[0], nodes, single: nodes.length === 1 };
  });

  const drop = new Set();
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const a = blocks[i];
      const b = blocks[j];
      const sharedId = a.nodes
        .map((node) => node?.['@id'])
        .find((id) => id && b.nodes.some((node) => node?.['@id'] === id));
      if (!sharedId) continue;

      const keys = (block) =>
        Object.keys(block.nodes.find((node) => node?.['@id'] === sharedId) || {}).length;
      // Only single-node blocks are removable; the richer definition survives.
      if (a.single && (!b.single || keys(a) <= keys(b))) drop.add(i);
      else if (b.single) drop.add(j);
    }
  }

  if (!drop.size) continue;
  let next = html;
  for (const index of drop) {
    next = next.replace(blocks[index].raw, '');
    removed += 1;
  }
  changed += 1;
  if (CHECK) {
    console.error(`[dedupe-jsonld] STALE duplicate @id in ${path.relative(ROOT, file)}`);
    continue;
  }
  fs.writeFileSync(file, next, 'utf8');
}

if (CHECK && changed > 0) {
  console.error(`[dedupe-jsonld] FAIL ${changed} file(s) contain conflicting @id nodes`);
  process.exit(1);
}

console.log(`[dedupe-jsonld] ${CHECK ? 'checked' : 'cleaned'} ${changed} file(s), ${removed} block(s) removed`);
