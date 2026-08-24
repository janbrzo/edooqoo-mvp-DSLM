#!/usr/bin/env node
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { latestRun, readJsonIfExists, todayIso } from './seo-monitoring-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT = path.join(ROOT, 'docs', 'seo', 'dashboard.md');

function rel(file) {
  return file ? path.relative(ROOT, file).replace(/\\/g, '/') : 'n/a';
}

function gscCoverage() {
  return readJsonIfExists(path.join(ROOT, 'docs', 'seo', 'gsc-coverage-analysis.generated.json'));
}

function liveRouting() {
  return readJsonIfExists(path.join(ROOT, 'docs', 'seo', 'live-routing.generated.json'));
}

function sitemapIntegrity() {
  return readJsonIfExists(path.join(ROOT, 'docs', 'seo', 'sitemap-integrity.generated.json'));
}

function statusLine(label, value, expected, note = '') {
  return `| ${label} | ${value} | ${expected} | ${note} |`;
}

async function main() {
  const coverage = gscCoverage();
  const live = liveRouting();
  const sitemap = sitemapIntegrity();
  const performance = latestRun(ROOT, 'gsc-performance');
  const inspection = latestRun(ROOT, 'url-inspection');
  const ai = latestRun(ROOT, 'ai-search');

  const performanceSummary = performance?.report?.summary || {};
  const aiSummary = ai?.report?.summary || {};

  const markdown = [
    '# SEO / GSC / AI Search Dashboard',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Current Health',
    '',
    '| Signal | Current | Target | Notes |',
    '|---|---:|---:|---|',
    statusLine('Live routing: no crawl signal', live?.totals?.byOutcome?.['fail-no-signal'] ?? live?.totals?.failed ?? 'not run', 0, live ? rel(path.join(ROOT, 'docs', 'seo', 'live-routing.generated.md')) : 'Run npm run seo:verify-live-routing -- --soft'),
    statusLine('Sitemap integrity issues', sitemap?.failures ?? 'not run', 0, sitemap ? `${sitemap.urls} URLs checked` : 'Run npm run seo:audit-sitemap-integrity'),
    statusLine('GSC indexed rows', coverage?.totals?.byProblem?.Zindeksowano ?? 'n/a', 'rising for strategic URLs', coverage ? rel(path.join(ROOT, 'docs', 'seo', 'gsc-coverage-analysis.generated.md')) : 'Run GSC export analyzer'),
    statusLine('GSC discovered not indexed', coverage?.totals?.byProblem?.['Strona wykryta – obecnie niezindeksowana'] ?? 'n/a', 'falling or intentional noindex', ''),
    statusLine('GSC crawled not indexed', coverage?.totals?.byProblem?.['Strona zeskanowana, ale jeszcze nie zindeksowana'] ?? 'n/a', 'falling for sitemap URLs', ''),
    statusLine('GSC 404', coverage?.totals?.byProblem?.['Nie znaleziono (404)'] ?? 'n/a', 0, 'Only meaningful after live redirects return 301.'),
    statusLine('AI mention rate', aiSummary.mentionRate == null ? 'not scored' : `${(aiSummary.mentionRate * 100).toFixed(1)}%`, '20% after 60 days', ai ? rel(ai.file) : 'Run npm run seo:ai-search-baseline'),
    statusLine('AI avg correctness', aiSummary.avgCorrectness == null ? 'not scored' : aiSummary.avgCorrectness.toFixed(2), '2.6 after 90 days', ''),
    '',
    '## Routing Truth',
    '',
    'Signals are delivered by the HTML layer, not by HTTP headers: the Cloudflare worker is not bound',
    'to edooqoo.com. `pass-html-*` is a valid crawl-control signal; only `fail-no-signal` is a defect.',
    '',
    '| Outcome | Checks |',
    '|---|---:|',
    ...Object.entries(live?.totals?.byOutcome || {}).sort().map(([key, value]) => `| ${key} | ${value} |`),
    '',
    '## Latest Run Files',
    '',
    '| Area | Latest JSON | Status |',
    '|---|---|---|',
    `| GSC performance | ${rel(performance?.file)} | ${performance?.report?.status || 'not run'} |`,
    `| URL inspection sample | ${rel(inspection?.file)} | ${inspection?.report?.status || 'not run'} |`,
    `| AI search baseline | ${rel(ai?.file)} | ${ai?.report?.status || 'not run'} |`,
    '',
    '## GSC Performance Highlights',
    '',
    '| Query plan | Rows | Clicks | Impressions |',
    '|---|---:|---:|---:|',
    ...Object.entries(performanceSummary).map(([id, item]) =>
      `| ${id} | ${item.rows ?? 0} | ${Number(item.clicks || 0).toFixed(0)} | ${Number(item.impressions || 0).toFixed(0)} |`
    ),
    '',
    '## Operating Cadence',
    '',
    '- Weekly: run live routing, GSC Search Analytics, URL Inspection sample, AI baseline template/scoring, and regenerate this dashboard.',
    '- Every 7/14/28 days after deploy: manually export GSC Page Indexing coverage and run the coverage analyzer with --previous.',
    '- Monthly: fill AI UI answers for ChatGPT, Claude, Perplexity, and Gemini, then rerun the AI baseline script with --answers.',
    '- Do not request indexing for signup query URLs or noindex long-tail pSEO pages.',
    '',
    '## RAG Keywords',
    '',
    'SEO dashboard, GSC monitoring, AI search baseline, Edooqoo LLM visibility, Search Console coverage, URL Inspection sample, adult 1:1 English tutor SEO.',
    '',
  ].join('\n');

  await fs.writeFile(OUTPUT, markdown, 'utf8');
  console.log(`[seo-dashboard] Wrote ${path.relative(ROOT, OUTPUT)} for ${todayIso()}`);
}

await main();
