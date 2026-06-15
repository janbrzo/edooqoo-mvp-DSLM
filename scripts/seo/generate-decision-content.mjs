#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDecisionCases, getDecisionContentRoutes } from './decision-content.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SITEMAP_PATH = path.join(ROOT, 'public', 'sitemap.xml');
const DISTRIBUTION_PATH = path.join(ROOT, 'docs', 'seo', 'decision-content-distribution.generated.md');
const BASE = 'https://edooqoo.com';
const LAST_MODIFIED = '2026-06-15';

const cases = getDecisionCases({ root: ROOT });
const routes = getDecisionContentRoutes({ root: ROOT });
let sitemap = await fs.readFile(SITEMAP_PATH, 'utf8');

for (const route of routes) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  sitemap = sitemap.replace(
    new RegExp(`\\s*<url>\\s*<loc>${BASE}${escaped}<\\/loc>[\\s\\S]*?<\\/url>\\s*`, 'g'),
    '\n',
  );
}

const entries = routes.map((route) => (
  `  <url><loc>${BASE}${route}</loc><lastmod>${LAST_MODIFIED}</lastmod><changefreq>monthly</changefreq><priority>${route.startsWith('/tools/') ? '0.8' : '0.7'}</priority></url>`
)).join('\n');

sitemap = sitemap
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/\n*<\/urlset>\s*$/, `\n${entries}\n</urlset>\n`);

const distribution = [
  '# What Should I Teach Next? Distribution Packages',
  '',
  'Generated from `src/data/whatToTeachNextCases.json`. Each package points to the canonical worked example and describes it as a constructed teaching case.',
  '',
  ...cases.flatMap((item) => {
    const url = `${BASE}/what-to-teach-next/${item.slug}`;
    const evidence = item.evidence[0];
    return [
      `## ${item.title}`,
      '',
      `Canonical: ${url}`,
      '',
      '### Newsletter',
      `${item.summary} The evidence-led decision is **${item.decision}**: ${item.decisionReason} Read the full constructed case: ${url}`,
      '',
      '### LinkedIn',
      `A useful next-lesson question is not "Which grammar point comes next?" It is "What does the current evidence justify?" In this constructed adult 1:1 case, ${evidence.toLowerCase()} The decision is ${item.decision}. Full reasoning and lesson sequence: ${url}`,
      '',
      '### 60-second video script',
      `Hook: What should this tutor teach next? Context: ${item.studentContext} Evidence: ${item.evidence.join(' ')} Decision: ${item.decision}. Why: ${item.decisionReason} Next objective: ${item.lessonObjective} This is a worked example, not a real student result. Full case: ${url}`,
      '',
      '### Community answer',
      `I would avoid choosing a new topic before classifying the evidence. In a similar constructed case, the strongest signal was: ${evidence} That supports **${item.decision}**, because ${item.decisionReason.toLowerCase()} The full decision sequence is here: ${url}`,
      '',
      '### Editorial pitch',
      `Subject: Worked example for evidence-led adult 1:1 lesson planning\n\nI have prepared a constructed adult 1:1 teaching case that shows the complete chain from student context and evidence to a ${item.decision} decision, bounded lesson objective, activity sequence, and next evidence criteria. It contains no real student data or outcome claim. Canonical source: ${url}`,
      '',
    ];
  }),
].join('\n');

await fs.writeFile(SITEMAP_PATH, sitemap, 'utf8');
await fs.writeFile(DISTRIBUTION_PATH, `${distribution.trim()}\n`, 'utf8');

console.log(`[decision-content] Added ${routes.length} routes and generated ${cases.length} distribution packages.`);
