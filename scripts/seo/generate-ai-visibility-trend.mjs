#!/usr/bin/env node
/**
 * Sprint 4 (Faza 4) — merge recorded AI-search rounds into one trend report.
 *
 * Input:  docs/seo/runs/ai-search/*.json (written by record-ai-search-run.mjs)
 * Output: docs/seo/ai-visibility-trend.generated.md + .json
 *
 * Reports mention rate, citation rate, delta vs the previous round, top cited Edooqoo URLs,
 * top competing domains, and the open action queue (queries whose next action is not "no change").
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const RUNS_DIR = path.join(ROOT, 'docs', 'seo', 'runs', 'ai-search');
const OUT_MD = path.join(ROOT, 'docs', 'seo', 'ai-visibility-trend.generated.md');
const OUT_JSON = path.join(ROOT, 'docs', 'seo', 'ai-visibility-trend.generated.json');

const runs = fs.existsSync(RUNS_DIR)
  ? fs
      .readdirSync(RUNS_DIR)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => JSON.parse(fs.readFileSync(path.join(RUNS_DIR, name), 'utf8')))
      .filter((run) => run && run.summary && Array.isArray(run.results))
  : [];

const delta = (current, previous) =>
  previous === undefined ? '—' : `${current - previous >= 0 ? '+' : ''}${(current - previous).toFixed(1)} pp`;

const latest = runs[runs.length - 1];
const actionQueue = latest
  ? latest.results.filter((row) => row.nextAction && row.nextAction !== 'no change')
  : [];

const lines = [
  '# AI Visibility Trend (generated)',
  '',
  'Source: manual rounds recorded with `npm run seo:record-ai-search-run`.',
  'Engines: ChatGPT Search, Perplexity, Google AI results, Bing/Copilot.',
  '',
  '## Rounds',
  '',
  '| Date | Queries | Mentioned | Mention rate | Cited | Citation rate | Citation delta |',
  '|---|---:|---:|---:|---:|---:|---:|',
  ...runs.map((run, index) => {
    const previous = runs[index - 1]?.summary.citationRate;
    return `| ${run.date} | ${run.summary.queries} | ${run.summary.mentioned} | ${run.summary.mentionRate}% | ${run.summary.cited} | ${run.summary.citationRate}% | ${delta(run.summary.citationRate, previous)} |`;
  }),
  '',
];

if (latest) {
  lines.push(
    '## Latest round — top cited Edooqoo URLs',
    '',
    ...(latest.summary.topCitedUrls.length
      ? latest.summary.topCitedUrls.map((row) => `- ${row.key} — ${row.count}x`)
      : ['- none recorded']),
    '',
    '## Latest round — top competing sources',
    '',
    ...(latest.summary.topCompetitors.length
      ? latest.summary.topCompetitors.map((row) => `- ${row.key} — ${row.count}x`)
      : ['- none recorded']),
    '',
    '## Open action queue',
    '',
    ...(actionQueue.length
      ? actionQueue.map((row) => `- [${row.nextAction}] ${row.engine}: ${row.query}`)
      : ['- empty']),
    '',
  );
} else {
  lines.push('No rounds recorded yet. Run one measurement round and record it.', '');
}

fs.writeFileSync(OUT_MD, lines.join('\n'));
fs.writeFileSync(
  OUT_JSON,
  `${JSON.stringify(
    {
      rounds: runs.map((run) => ({ date: run.date, ...run.summary })),
      openActions: actionQueue.length,
    },
    null,
    2,
  )}\n`,
);

console.log(`[ai-visibility-trend] ${runs.length} round(s), ${actionQueue.length} open action(s)`);
