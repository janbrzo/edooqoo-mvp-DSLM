#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getContentRegistry } from './content-registry.mjs';
import { getPseoRouteInventory } from './pseo-index-policy.mjs';
import {
  argValue,
  bearerToken,
  googleJsonFetch,
  todayIso,
  writeRunFiles,
} from './seo-monitoring-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'https://edooqoo.com';
const argv = process.argv.slice(2);
const DATE = argValue(argv, '--date') || todayIso();
const SITE_URL = argValue(argv, '--site') || process.env.GSC_SITE_URL || 'sc-domain:edooqoo.com';
const LIMIT = Number(argValue(argv, '--limit') || process.env.GSC_URL_INSPECTION_LIMIT || 120);
const STRICT = argv.includes('--strict');
const TOKEN = bearerToken();

const strategicPrefixes = [
  '/edooqoo-vs-',
  '/chatgpt',
  '/claude',
  '/gemini',
  '/perplexity',
  '/best-ai',
  '/ai-tools',
  '/teacher-controlled-ai',
  '/student-context-system',
];

const fixedRoutes = [
  '/one-minute-prep',
  '/how-it-works',
  '/features/homework',
  '/features/dslm',
  '/gallery',
  '/what-to-teach-next',
  '/blog/one-minute-prep-workflow-for-esl-tutors.html',
  '/blog/using-ai-teacher-productivity.html',
  '/blog/effective-esl-homework-strategies.html',
  '/blog/ai-lesson-planning-strategies.html',
  '/blog/ai-worksheet-generator-mechanics-for-esl-teachers.html',
  '/blog/what-to-teach-next-private-english-student.html',
];

function routePriority(entry) {
  if (fixedRoutes.includes(entry.route)) return 0;
  if (strategicPrefixes.some((prefix) => entry.route.startsWith(prefix))) return 1;
  if (entry.route.startsWith('/blog/how-to-') || entry.route.startsWith('/blog/why-')) return 2;
  if (entry.route.endsWith('-lesson-prep.html') || entry.route.endsWith('-worksheet.html')) return 3;
  if (entry.type === 'topic-level' || entry.type === 'exercise-topic' || entry.type === 'persona') return 4;
  return 9;
}

function sampleUrls() {
  const registry = getContentRegistry({ root: ROOT });
  const pseo = getPseoRouteInventory({ root: ROOT });
  const indexable = registry
    .filter((entry) => entry.indexable && !entry.redirectTo)
    .sort((a, b) => routePriority(a) - routePriority(b) || a.route.localeCompare(b.route))
    .map((entry) => `${BASE}${entry.route === '/' ? '/' : entry.route}`);
  const noindexSample = pseo.noindex
    .filter((route) => route.startsWith('/worksheets/') || route.startsWith('/esl-worksheets/'))
    .slice(0, 20)
    .map((route) => `${BASE}${route}`);
  return [...new Set([...fixedRoutes.map((route) => `${BASE}${route}`), ...indexable, ...noindexSample])].slice(0, LIMIT);
}

async function inspectUrl(url) {
  const response = await googleJsonFetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    token: TOKEN,
    body: {
      inspectionUrl: url,
      siteUrl: SITE_URL,
      languageCode: 'en-US',
    },
  });
  const result = response.inspectionResult || {};
  const index = result.indexStatusResult || {};
  return {
    url,
    verdict: index.verdict || '',
    coverageState: index.coverageState || '',
    indexingState: index.indexingState || '',
    robotsTxtState: index.robotsTxtState || '',
    pageFetchState: index.pageFetchState || '',
    googleCanonical: index.googleCanonical || '',
    userCanonical: index.userCanonical || '',
    lastCrawlTime: index.lastCrawlTime || '',
  };
}

async function main() {
  const urls = sampleUrls();
  let report;
  if (!TOKEN) {
    report = {
      generatedAt: new Date().toISOString(),
      status: 'skipped',
      reason: 'Missing GSC_ACCESS_TOKEN, GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN, or GOOGLE_ACCESS_TOKEN.',
      siteUrl: SITE_URL,
      urls,
      inspections: [],
      summary: {},
    };
  } else {
    const inspections = [];
    for (const url of urls) {
      try {
        inspections.push(await inspectUrl(url));
      } catch (error) {
        inspections.push({ url, error: error.message });
      }
    }
    const summary = inspections.reduce((acc, row) => {
      const key = row.verdict || row.coverageState || (row.error ? 'error' : 'unknown');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    report = {
      generatedAt: new Date().toISOString(),
      status: 'ok',
      siteUrl: SITE_URL,
      urls,
      inspections,
      summary,
    };
  }

  const markdown = [
    '# GSC URL Inspection Sample',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Site URL: ${SITE_URL}`,
    `Sample size: ${report.urls.length}`,
    '',
    report.reason ? `Reason: ${report.reason}\n` : '',
    '## Summary',
    '',
    '| State | Count |',
    '|---|---:|',
    ...Object.entries(report.summary || {}).map(([key, count]) => `| ${key} | ${count} |`),
    '',
    '## URLs',
    '',
    '| URL | Verdict | Coverage | Indexing | Google canonical | User canonical | Last crawl | Error |',
    '|---|---|---|---|---|---|---|---|',
    ...(report.inspections || []).map((row) =>
      `| ${row.url} | ${row.verdict || ''} | ${row.coverageState || ''} | ${row.indexingState || ''} | ${row.googleCanonical || ''} | ${row.userCanonical || ''} | ${row.lastCrawlTime || ''} | ${row.error || ''} |`
    ),
    '',
    '## Operating Notes',
    '',
    '- URL Inspection API reports the indexed version known to Google, not a live indexability test.',
    '- Use this with live routing verification and GSC Coverage exports before deciding whether to wait, redirect, noindex, or rewrite.',
    '',
  ].join('\n');

  const { jsonPath, mdPath } = await writeRunFiles({ root: ROOT, category: 'url-inspection', date: DATE, report, markdown });
  console.log(`[url-inspection] ${report.status} wrote ${path.relative(ROOT, jsonPath)} and ${path.relative(ROOT, mdPath)}`);
  if (report.status === 'skipped' && STRICT) process.exit(1);
}

await main();
