#!/usr/bin/env node
/**
 * Sprint 4 (Faza 4) — record one manual AI-search measurement round.
 *
 * PROBLEM: the AI-visibility baseline in docs/seo/ai-search-measurement.md is fully manual,
 * so rounds are inconsistent and never comparable over time.
 *
 * SOLUTION: one CLI that normalizes a CSV/JSON round into
 * docs/seo/runs/ai-search/YYYY-MM-DD.json plus a human-readable Markdown twin.
 *
 * Usage:
 *   node scripts/seo/record-ai-search-run.mjs --input path/to/round.csv [--date YYYY-MM-DD]
 *
 * CSV header (order-independent, case-insensitive):
 *   engine,query,mentioned,cited,cited_url,competitors,quality,next_action,notes
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const RUNS_DIR = path.join(ROOT, 'docs', 'seo', 'runs', 'ai-search');

const ENGINES = ['ChatGPT Search', 'Perplexity', 'Google AI results', 'Bing/Copilot'];
const QUALITY = ['correct', 'partial', 'incorrect'];
const ACTIONS = ['no change', 'strengthen page', 'add FAQ', 'add internal link', 'fix metadata'];

const argOf = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const yesNo = (value) => /^(y|yes|true|1)$/i.test(String(value ?? '').trim());

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const split = (line) => {
    const cells = [];
    let current = '';
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) {
        cells.push(current);
        current = '';
      } else current += char;
    }
    cells.push(current);
    return cells.map((cell) => cell.trim());
  };
  const header = split(lines[0]).map((cell) => cell.toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(header.map((key, index) => [key, cells[index] ?? '']));
  });
}

function normalize(rows) {
  const problems = [];
  const results = rows.map((row, index) => {
    const engine = ENGINES.find((value) => value.toLowerCase() === String(row.engine).toLowerCase());
    if (!engine) problems.push(`row ${index + 2}: unknown engine "${row.engine}"`);
    const quality = QUALITY.includes(row.quality) ? row.quality : 'partial';
    const nextAction = ACTIONS.includes(row.next_action) ? row.next_action : 'strengthen page';
    return {
      engine: engine || String(row.engine || 'unknown'),
      query: row.query || '',
      mentioned: yesNo(row.mentioned),
      cited: yesNo(row.cited),
      citedUrl: row.cited_url || 'none',
      competitors: (row.competitors || '')
        .split(';')
        .map((value) => value.trim())
        .filter(Boolean),
      quality,
      nextAction,
      notes: row.notes || '',
    };
  });
  return { results, problems };
}

function summarize(results) {
  const total = results.length || 1;
  const mentioned = results.filter((row) => row.mentioned).length;
  const cited = results.filter((row) => row.cited).length;
  const urls = {};
  const competitors = {};
  for (const row of results) {
    if (row.cited && row.citedUrl !== 'none') urls[row.citedUrl] = (urls[row.citedUrl] || 0) + 1;
    for (const competitor of row.competitors) {
      competitors[competitor] = (competitors[competitor] || 0) + 1;
    }
  }
  const top = (map) =>
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ key, count }));
  return {
    queries: results.length,
    mentioned,
    cited,
    mentionRate: Number(((mentioned / total) * 100).toFixed(1)),
    citationRate: Number(((cited / total) * 100).toFixed(1)),
    topCitedUrls: top(urls),
    topCompetitors: top(competitors),
  };
}

function main() {
  const input = argOf('--input');
  if (!input) {
    console.error('[ai-search-run] --input <file.csv|file.json> is required');
    process.exit(1);
  }
  const date = argOf('--date') || new Date().toISOString().slice(0, 10);
  const raw = fs.readFileSync(path.resolve(ROOT, input), 'utf8');
  const rows = input.endsWith('.json') ? JSON.parse(raw) : parseCsv(raw);
  const { results, problems } = normalize(rows);

  if (problems.length) {
    console.error(`[ai-search-run] FAIL\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }

  const summary = summarize(results);
  const run = { date, summary, results };

  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RUNS_DIR, `${date}.json`), `${JSON.stringify(run, null, 2)}\n`);

  const md = [
    `# AI Search Run — ${date}`,
    '',
    `Queries: ${summary.queries} · mentioned ${summary.mentioned} (${summary.mentionRate}%) · cited ${summary.cited} (${summary.citationRate}%)`,
    '',
    '| Engine | Query | Mentioned | Cited | Cited URL | Quality | Next action |',
    '|---|---|---|---|---|---|---|',
    ...results.map(
      (row) =>
        `| ${row.engine} | ${row.query} | ${row.mentioned ? 'yes' : 'no'} | ${row.cited ? 'yes' : 'no'} | ${row.citedUrl} | ${row.quality} | ${row.nextAction} |`,
    ),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(RUNS_DIR, `${date}.md`), md);

  console.log(
    `[ai-search-run] wrote docs/seo/runs/ai-search/${date}.json — mention ${summary.mentionRate}%, citation ${summary.citationRate}%`,
  );
}

main();
