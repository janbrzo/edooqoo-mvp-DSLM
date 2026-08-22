#!/usr/bin/env node
/**
 * Sprint 3 — inject spoke -> hub backlinks into pre-rendered/static HTML.
 *
 * Runs after every content generator so regenerated pages never lose the backlink.
 * Idempotent: the marker attribute is the presence check, and the block is rewritten
 * in place when the hub metadata changes, so running twice yields an empty git diff.
 *
 * Usage: node scripts/seo/inject-cluster-hub-links.mjs [--check]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLUSTER_HUBS, CLUSTER_HUB_BACKLINK_MARKER, backlinkHtml } from './cluster-hubs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const CHECK = process.argv.includes('--check');

const blockRegex = new RegExp(`\\s*<p ${CLUSTER_HUB_BACKLINK_MARKER}="[^"]*">[\\s\\S]*?<\\/p>`, 'g');

function insert(html, block) {
  const stripped = html.replace(blockRegex, '');
  const anchors = ['</main>', '</body>'];
  for (const anchor of anchors) {
    const index = stripped.lastIndexOf(anchor);
    if (index >= 0) {
      return `${stripped.slice(0, index)}${block}\n${stripped.slice(index)}`;
    }
  }
  return `${stripped}\n${block}\n`;
}

async function main() {
  let changed = 0;
  let missing = 0;

  for (const hub of CLUSTER_HUBS) {
    const block = backlinkHtml(hub);
    for (const spoke of hub.htmlSpokes) {
      const file = path.join(PUBLIC, spoke);
      let html;
      try {
        html = await fs.readFile(file, 'utf8');
      } catch {
        missing += 1;
        console.error(`[cluster-hub-links] MISSING spoke file: public/${spoke}`);
        continue;
      }
      const next = insert(html, block);
      if (next === html) continue;
      changed += 1;
      if (CHECK) {
        console.error(`[cluster-hub-links] STALE backlink: public/${spoke} -> ${hub.route}`);
        continue;
      }
      await fs.writeFile(file, next, 'utf8');
    }
  }

  if (missing) {
    console.error(`[cluster-hub-links] ${missing} spoke file(s) not found`);
    process.exit(1);
  }
  if (CHECK && changed) {
    console.error(`[cluster-hub-links] ${changed} spoke file(s) need injection. Run npm run seo:inject-cluster-hub-links`);
    process.exit(1);
  }
  console.log(`[cluster-hub-links] ${CHECK ? 'checked' : 'updated'} ${CLUSTER_HUBS.reduce((sum, hub) => sum + hub.htmlSpokes.length, 0)} spokes (${changed} written)`);
}

await main();
