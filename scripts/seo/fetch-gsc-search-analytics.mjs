#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  argValue,
  bearerToken,
  daysAgoIso,
  googleJsonFetch,
  todayIso,
  writeRunFiles,
} from './seo-monitoring-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'https://edooqoo.com';
const argv = process.argv.slice(2);
const SITE_URL = argValue(argv, '--site') || process.env.GSC_SITE_URL || 'sc-domain:edooqoo.com';
const DATE = argValue(argv, '--date') || todayIso();
const END_DATE = argValue(argv, '--end') || process.env.GSC_END_DATE || daysAgoIso(3);
const START_7 = argValue(argv, '--start7') || daysAgoIso(10);
const START_28 = argValue(argv, '--start28') || daysAgoIso(31);
const STRICT = argv.includes('--strict');
const TOKEN = bearerToken();

const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`;

const strategicFilters = [
  { name: 'all-web', filters: [] },
  { name: 'blog', filters: [{ dimension: 'page', operator: 'contains', expression: `${BASE}/blog/` }] },
  { name: 'comparison', filters: [{ dimension: 'page', operator: 'includingRegex', expression: 'edooqoo\\.com/(edooqoo-vs-|.*alternative|.*vs-.*|best-ai-|ai-tools-|teacher-controlled-ai)' }] },
  { name: 'workflow', filters: [{ dimension: 'page', operator: 'includingRegex', expression: 'edooqoo\\.com/(one-minute-prep|how-it-works|features/|what-to-teach-next|gallery)' }] },
  { name: 'pseo-indexable', filters: [{ dimension: 'page', operator: 'includingRegex', expression: 'edooqoo\\.com/(worksheets/|esl-worksheets/|english-for/)' }] },
];

const queryPlans = [
  { id: '7d-date-page', startDate: START_7, endDate: END_DATE, dimensions: ['date', 'page'], rowLimit: 25000, filterSet: 'all-web' },
  { id: '28d-page-query', startDate: START_28, endDate: END_DATE, dimensions: ['page', 'query'], rowLimit: 25000, filterSet: 'all-web' },
  { id: '28d-query', startDate: START_28, endDate: END_DATE, dimensions: ['query'], rowLimit: 25000, filterSet: 'all-web' },
  { id: '28d-device-page', startDate: START_28, endDate: END_DATE, dimensions: ['device', 'page'], rowLimit: 25000, filterSet: 'all-web' },
  ...strategicFilters.filter((set) => set.name !== 'all-web').map((set) => ({
    id: `28d-${set.name}-page-query`,
    startDate: START_28,
    endDate: END_DATE,
    dimensions: ['page', 'query'],
    rowLimit: 10000,
    filterSet: set.name,
  })),
];

function filterGroup(name) {
  const set = strategicFilters.find((item) => item.name === name);
  if (!set || !set.filters.length) return undefined;
  return [{ groupType: 'and', filters: set.filters }];
}

async function runQuery(plan) {
  const body = {
    startDate: plan.startDate,
    endDate: plan.endDate,
    dimensions: plan.dimensions,
    rowLimit: plan.rowLimit,
    type: 'web',
    aggregationType: plan.dimensions.includes('page') ? 'byPage' : 'byProperty',
  };
  const groups = filterGroup(plan.filterSet);
  if (groups) body.dimensionFilterGroups = groups;
  const response = await googleJsonFetch(endpoint, { token: TOKEN, body });
  return {
    ...plan,
    rows: response.rows || [],
    responseAggregationType: response.responseAggregationType || '',
    metadata: response.metadata || null,
  };
}

function summarize(queryReports) {
  const summary = {};
  for (const report of queryReports) {
    const rows = report.rows || [];
    summary[report.id] = {
      rows: rows.length,
      clicks: rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0),
      impressions: rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0),
      topRows: rows.slice(0, 10).map((row) => ({
        keys: row.keys || [],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      })),
    };
  }
  return summary;
}

async function main() {
  let report;
  if (!TOKEN) {
    report = {
      generatedAt: new Date().toISOString(),
      status: 'skipped',
      reason: 'Missing GSC_ACCESS_TOKEN, GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN, or GOOGLE_ACCESS_TOKEN.',
      siteUrl: SITE_URL,
      queryPlans,
      reports: [],
      summary: {},
    };
  } else {
    const reports = [];
    for (const plan of queryPlans) {
      reports.push(await runQuery(plan));
    }
    report = {
      generatedAt: new Date().toISOString(),
      status: 'ok',
      siteUrl: SITE_URL,
      reports,
      summary: summarize(reports),
    };
  }

  const markdown = [
    '# GSC Search Performance Run',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Site URL: ${SITE_URL}`,
    '',
    report.reason ? `Reason: ${report.reason}\n` : '',
    '## Summary',
    '',
    '| Query plan | Rows | Clicks | Impressions | Top samples |',
    '|---|---:|---:|---:|---|',
    ...Object.entries(report.summary || {}).map(([id, item]) =>
      `| ${id} | ${item.rows} | ${item.clicks.toFixed(0)} | ${item.impressions.toFixed(0)} | ${item.topRows.map((row) => `${row.keys.join(' / ')} (${row.clicks}/${row.impressions})`).join('<br>')} |`
    ),
    '',
    '## Operating Notes',
    '',
    '- This report measures Google Search performance, not Page Indexing coverage.',
    '- Coverage/Page Indexing exports still need the manual GSC export workflow.',
    '- Rows are bounded by Google Search Console API limits and available top rows.',
    '',
  ].join('\n');

  const { jsonPath, mdPath } = await writeRunFiles({ root: ROOT, category: 'gsc-performance', date: DATE, report, markdown });
  console.log(`[gsc-performance] ${report.status} wrote ${path.relative(ROOT, jsonPath)} and ${path.relative(ROOT, mdPath)}`);
  if (report.status === 'skipped' && STRICT) process.exit(1);
}

await main();
