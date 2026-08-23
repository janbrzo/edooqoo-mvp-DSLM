#!/usr/bin/env node
/**
 * Sprint 4 (Faza 4) — merge recorded AI-search baseline rounds into one trend report.
 *
 * Input:  docs/seo/runs/ai-search/*.json (written by scripts/seo/run-ai-search-baseline.mjs)
 * Output: docs/seo/ai-visibility-trend.generated.md + .json
 *
 * Reports mention rate per round, delta vs the previous round, per-model breakdown, and the
 * open content-gap queue so GEO work is prioritised by measured citation loss, not by guesswork.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const RUNS_DIR = path.join(ROOT, 'docs', 'seo', 'runs', 'ai-search');
const OUT_MD = path.join(ROOT, 'docs', 'seo', 'ai-visibility-trend.generated.md');
const OUT_JSON = path.join(ROOT, 'docs', 'seo', 'ai-visibility-trend.generated.json');

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const rounds = (fs.existsSync(RUNS_DIR) ? fs.readdirSync(RUNS_DIR) : [])
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => {
    const run = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, name), 'utf8'));
    const summary = run.summary || {};
    return {
      date: name.replace(/\.json$/, ''),
      status: run.status || 'recorded',
      prompts: num(summary.prompts),
      rows: num(summary.rows),
      answered: num(summary.answered),
      mentions: num(summary.mentions),
      mentionRate: Number((num(summary.mentionRate) * (num(summary.mentionRate) <= 1 ? 100 : 1)).toFixed(1)),
      avgCorrectness: summary.avgCorrectness ?? null,
      byModel: summary.byModel || {},
      contentGaps: Array.isArray(summary.topContentGaps) ? summary.topContentGaps : [],
    };
  });

const delta = (current, previous) =>
  previous === undefined ? '—' : `${current - previous >= 0 ? '+' : ''}${(current - previous).toFixed(1)} pp`;

const latest = rounds[rounds.length - 1];
const pending = rounds.filter((round) => round.answered === 0);

const lines = [
  '# AI Visibility Trend (generated)',
  '',
  'Source: rounds in `docs/seo/runs/ai-search/` produced by `npm run seo:ai-search-baseline`.',
  'A round with `answered: 0` is a template awaiting manual answers from the engine UIs.',
  '',
  '## Rounds',
  '',
  '| Date | Status | Prompts | Answered | Mentions | Mention rate | Delta | Avg correctness |',
  '|---|---|---:|---:|---:|---:|---:|---:|',
  ...rounds.map((round, index) => {
    const previous = rounds[index - 1]?.mentionRate;
    return `| ${round.date} | ${round.status} | ${round.prompts} | ${round.answered} | ${round.mentions} | ${round.mentionRate}% | ${delta(round.mentionRate, previous)} | ${round.avgCorrectness ?? '—'} |`;
  }),
  '',
];

if (latest) {
  const models = Object.entries(latest.byModel);
  lines.push(
    '## Latest round — per model',
    '',
    ...(models.length
      ? models.map(([model, stats]) => `- ${model}: ${JSON.stringify(stats)}`)
      : ['- no answers recorded yet']),
    '',
    '## Latest round — content gaps to close',
    '',
    ...(latest.contentGaps.length
      ? latest.contentGaps.map((gap) => `- ${typeof gap === 'string' ? gap : JSON.stringify(gap)}`)
      : ['- none recorded']),
    '',
  );
}

if (pending.length) {
  lines.push(
    '## Unfinished rounds',
    '',
    ...pending.map((round) => `- ${round.date}: fill the CSV twin and rerun the baseline with --answers`),
    '',
  );
}

if (!rounds.length) lines.push('No rounds recorded yet.', '');

fs.writeFileSync(OUT_MD, lines.join('\n'));
fs.writeFileSync(
  OUT_JSON,
  `${JSON.stringify({ rounds, pendingRounds: pending.map((round) => round.date) }, null, 2)}\n`,
);

console.log(`[ai-visibility-trend] ${rounds.length} round(s), ${pending.length} awaiting answers`);
