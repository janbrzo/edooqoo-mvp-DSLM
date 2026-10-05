#!/usr/bin/env node
/**
 * audit-content-verification.mjs: gate for the "Automated quality checks" label.
 *
 * A public page may show the label "Automated quality checks passed" only when
 * docs/seo/content-verification.generated.json holds a `verified` record for its route whose
 * contentHash still matches the page's visible text. Pages without the label are not checked here.
 * Also fails if any record is `verified` without both judges having passed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentHash, extractPage } from './lib/content-verification.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = path.join(ROOT, 'public');
const RECORDS = path.join(ROOT, 'docs/seo/content-verification.generated.json');
export const LABEL = 'Automated quality checks passed';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function routeFor(file) {
  let route = `/${path.relative(PUBLIC, file).split(path.sep).join('/')}`;
  if (route.endsWith('/index.html')) route = route.slice(0, -'/index.html'.length) || '/';
  return route;
}

const records = fs.existsSync(RECORDS) ? JSON.parse(fs.readFileSync(RECORDS, 'utf8')).records : [];
const byRoute = new Map(records.map((record) => [record.route, record]));
const failures = [];

for (const record of records) {
  if (record.status === 'verified') {
    const judges = record.layer2?.judges || [];
    if (record.layer1?.status !== 'pass' || record.layer2?.status !== 'pass' || judges.length < 2 || !judges.every((j) => j.pass)) {
      failures.push(`${record.route}: marked verified without passing layer 1 and both judges`);
    }
  }
}

let labelled = 0;
for (const file of walk(PUBLIC)) {
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes(LABEL)) continue;
  labelled += 1;
  const route = routeFor(file);
  const record = byRoute.get(route) || byRoute.get(route.replace(/\.html$/, ''));
  if (!record) failures.push(`${route}: shows "${LABEL}" without a verification record`);
  else if (record.status !== 'verified') failures.push(`${route}: shows the label but status is ${record.status}`);
  else if (record.contentHash !== contentHash(extractPage(html).text)) {
    failures.push(`${route}: shows the label but the page changed since verification (stale record)`);
  }
}

if (failures.length) {
  console.error(`[content-verification-audit] FAIL\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`[content-verification-audit] PASS ${records.length} record(s), ${labelled} labelled page(s)`);
