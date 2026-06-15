#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDecisionCases, getDecisionContentRoutes } from './decision-content.mjs';
import { getPrerenderRoutes } from './seo-route-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const cases = getDecisionCases({ root: ROOT });
const routes = getDecisionContentRoutes({ root: ROOT });
const sitemap = fs.readFileSync(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8');
const casePage = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'WhatToTeachNextCase.tsx'), 'utf8');
const toolPage = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'tools', 'WhatShouldITeachNextTool.tsx'), 'utf8');
const failures = [];

if (cases.length !== 12) failures.push(`Expected 12 worked examples, found ${cases.length}`);
if (new Set(cases.map((item) => item.slug)).size !== cases.length) failures.push('Worked example slugs must be unique');

for (const item of cases) {
  for (const field of ['slug', 'title', 'summary', 'studentContext', 'decision', 'decisionReason', 'lessonObjective']) {
    if (!item[field]) failures.push(`${item.slug || item.title}: missing ${field}`);
  }
  if (!['Continue', 'Repair', 'Advance'].includes(item.decision)) failures.push(`${item.slug}: invalid decision`);
  if (item.evidence?.length < 3) failures.push(`${item.slug}: needs at least 3 evidence signals`);
  if (item.activitySequence?.length < 4) failures.push(`${item.slug}: needs at least 4 activity steps`);
  if (item.evidenceToCollect?.length < 3) failures.push(`${item.slug}: needs at least 3 next-evidence criteria`);
}

const prerender = new Set(getPrerenderRoutes({ root: ROOT }));
for (const route of routes) {
  if (!sitemap.includes(`<loc>https://edooqoo.com${route}</loc>`)) failures.push(`${route}: missing from sitemap`);
  if (!prerender.has(route)) failures.push(`${route}: missing from prerender manifest`);
}

for (const fragment of [
  'path="/what-to-teach-next/:slug"',
  'path="/tools/what-should-i-teach-next"',
]) {
  if (!app.includes(fragment)) failures.push(`App routing missing ${fragment}`);
}

for (const fragment of ['Worked example', 'not a report of a real student', "'@type': 'Article'", 'reviewedBy', "'@type': 'BreadcrumbList'"]) {
  if (!casePage.includes(fragment)) failures.push(`Worked example page missing ${fragment}`);
}

for (const fragment of ['Runs locally', 'No AI', 'Copy safe link', "'@type': 'SoftwareApplication'", 'decision_tool_complete']) {
  if (!toolPage.includes(fragment)) failures.push(`Decision tool page missing ${fragment}`);
}

const distribution = fs.readFileSync(
  path.join(ROOT, 'docs', 'seo', 'decision-content-distribution.generated.md'),
  'utf8',
);
for (const item of cases) {
  if (!distribution.includes(`## ${item.title}`)) failures.push(`${item.slug}: distribution package missing`);
}

if (failures.length) {
  console.error(`[decision-content-audit] FAIL\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`[decision-content-audit] PASS ${cases.length} worked examples, 1 local tool, ${routes.length} indexed routes.`);
