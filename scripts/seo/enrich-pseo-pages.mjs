#!/usr/bin/env node
/**
 * Step 4 of 4: enrich the indexable root pSEO pages with a real adult practice task
 * (with answer key), common adult learner errors, and links to the free tools, the
 * Next Lesson Decision Tool and the public Gallery.
 *
 * Runs after every generator in seo:sync-generated, so regenerated citable pages keep the
 * block. Idempotent: the block lives between fixed markers and is rewritten in place.
 *
 * Usage: node scripts/seo/enrich-pseo-pages.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PSEO_PACKS, PSEO_PAGE_PACKS } from './data/pseo-enrichment-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');

export const ENRICHMENT_START = '<!-- EDOOQOO:PSEO_ENRICHMENT_START -->';
export const ENRICHMENT_END = '<!-- EDOOQOO:PSEO_ENRICHMENT_END -->';

const esc = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = '<style>.eq-pseo{margin:2.5em 0;padding:1.25em 1.5em;border:1px solid #e0e0e0;border-radius:10px;background:#fafafa}.eq-pseo h2{margin-top:0.5em}.eq-pseo ol li{margin:0.4em 0}.eq-pseo table{width:100%;border-collapse:collapse}.eq-pseo th,.eq-pseo td{border:1px solid #e0e0e0;padding:8px;text-align:left;vertical-align:top}.eq-pseo-tools{display:flex;flex-wrap:wrap;gap:0.75em;padding:0;list-style:none}.eq-pseo-tools a{display:inline-block;padding:8px 14px;border:1px solid #6d28d9;border-radius:8px;text-decoration:none}</style>';

export function renderEnrichment(file) {
  const packId = PSEO_PAGE_PACKS[file];
  const pack = packId && PSEO_PACKS[packId];
  if (!pack) throw new Error(`No enrichment pack for public/${file}`);
  const slug = file.replace(/\.html$/, '');
  const decision = `/tools/what-should-i-teach-next?level=${pack.level}`;
  const items = pack.items.map(([prompt]) => `      <li>${esc(prompt)}</li>`).join('\n');
  const key = pack.items.map(([, answer], index) => `${index + 1}. ${esc(answer)}`).join('<br>');
  const rows = pack.mistakes.map(([wrong, right, why]) =>
    `        <tr><td>${esc(wrong)}</td><td>${esc(right)}</td><td>${esc(why)}</td></tr>`).join('\n');

  return `${ENRICHMENT_START}
<section class="eq-pseo" data-pseo-enrichment="${esc(packId)}">
  ${STYLE}
  <h2>Try It: ${esc(pack.topic)} Task for Adult Learners (${esc(pack.level)})</h2>
  <p>A short task in the style Edooqoo produces, set in a real adult context: ${esc(pack.context)}. Use it as is in your next lesson, or generate an editable version tuned to your learner.</p>
  <ol>
${items}
  </ol>
  <details><summary>Answer key</summary><p>${key}</p></details>
  <h2>Common Adult Learner Errors and How to Fix Them</h2>
  <table>
    <thead><tr><th>What learners say</th><th>Correct form</th><th>Teaching note</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <p>If one of these errors keeps returning after practice, treat it as a repair point rather than a reason to move on.</p>
  <h2>Free Tools for the Next Step</h2>
  <ul class="eq-pseo-tools">
    <li><a href="${decision}">Decide what to teach next (Repair, Continue or Advance)</a></li>
    <li><a href="/tools">All free teaching tools</a></li>
    <li><a href="/gallery">See real published worksheets</a></li>
  </ul>
  <p><a href="https://edooqoo.com/signup?src=pseo-${esc(slug)}" class="cta">Create an editable ${esc(pack.topic)} worksheet in about a minute</a></p>
  <p>You review and edit every task before it reaches your learner.</p>
</section>
${ENRICHMENT_END}`;
}

const blockRegex = new RegExp(`\\n?${ENRICHMENT_START}[\\s\\S]*?${ENRICHMENT_END}\\n?`, 'g');
const ANCHORS = [/\n[ \t]*<h2>(Frequently Asked Questions|FAQ)<\/h2>/, /\n[ \t]*<footer>/, /\n[ \t]*<\/main>/, /\n[ \t]*<\/body>/];

export function applyEnrichment(html, file) {
  const stripped = html.replace(blockRegex, '\n');
  const block = renderEnrichment(file);
  for (const anchor of ANCHORS) {
    const match = stripped.match(anchor);
    if (match) {
      return `${stripped.slice(0, match.index)}\n${block}${stripped.slice(match.index)}`;
    }
  }
  throw new Error(`No insertion anchor in public/${file}`);
}

function main() {
  const check = process.argv.includes('--check');
  let changed = 0;
  for (const file of Object.keys(PSEO_PAGE_PACKS)) {
    const target = path.join(PUBLIC, file);
    const html = fs.readFileSync(target, 'utf8');
    const next = applyEnrichment(html, file);
    if (next === html) continue;
    changed += 1;
    if (check) console.error(`[pseo-enrichment] STALE: public/${file}`);
    else fs.writeFileSync(target, next, 'utf8');
  }
  if (check && changed) {
    console.error(`[pseo-enrichment] ${changed} page(s) stale. Run npm run seo:enrich-pseo-pages`);
    process.exit(1);
  }
  console.log(`[pseo-enrichment] ${check ? 'checked' : 'updated'} ${Object.keys(PSEO_PAGE_PACKS).length} pages (${changed} changed)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
