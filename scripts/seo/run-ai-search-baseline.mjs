#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { x1000AiSearchPrompts } from './x1000-content-plan.mjs';
import { argValue, csvEscape, todayIso, writeRunFiles } from './seo-monitoring-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const DATE = argValue(argv, '--date') || todayIso();
const ANSWERS_PATH = argValue(argv, '--answers') || process.env.AI_SEARCH_ANSWERS || '';
const CSV_OUTPUT = path.join(ROOT, 'docs', 'seo', 'runs', 'ai-search', `${DATE}.csv`);

const DEFAULT_MODELS = ['ChatGPT', 'Claude', 'Perplexity', 'Gemini'];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const normalized = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < normalized.length; index++) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1)
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function templateRows() {
  return x1000AiSearchPrompts.flatMap((prompt) =>
    DEFAULT_MODELS.map((model) => ({
      id: prompt.id,
      category: prompt.category,
      query: prompt.query,
      model,
      mentionsEdooqoo: '',
      citedUrl: '',
      productCorrectness0To3: '',
      competitorChosen: '',
      nextContentGap: '',
      answerSummary: '',
    }))
  );
}

function normalizeAnswerRows(rows) {
  return rows.map((row) => ({
    id: row.id || row.ID || '',
    category: row.category || row.Category || '',
    query: row.query || row.Query || '',
    model: row.model || row.Model || '',
    mentionsEdooqoo: row.mentionsEdooqoo || row['Mentions Edooqoo'] || '',
    citedUrl: row.citedUrl || row['Cited URL'] || '',
    productCorrectness0To3: row.productCorrectness0To3 || row['Correctness 0-3'] || '',
    competitorChosen: row.competitorChosen || row['Competitor chosen'] || '',
    nextContentGap: row.nextContentGap || row['Next content gap'] || '',
    answerSummary: row.answerSummary || row['Answer summary'] || '',
  }));
}

function score(rows) {
  const answered = rows.filter((row) => row.model && row.mentionsEdooqoo);
  const mentionRows = answered.filter((row) => /^y|yes|true|1$/i.test(row.mentionsEdooqoo.trim()));
  const correctnessRows = answered
    .map((row) => Number(row.productCorrectness0To3))
    .filter((value) => Number.isFinite(value));
  const byModel = {};
  for (const row of answered) {
    const model = row.model || 'unknown';
    byModel[model] ||= { answers: 0, mentions: 0, correctnessTotal: 0, correctnessCount: 0 };
    byModel[model].answers++;
    if (/^y|yes|true|1$/i.test(row.mentionsEdooqoo.trim())) byModel[model].mentions++;
    const correctness = Number(row.productCorrectness0To3);
    if (Number.isFinite(correctness)) {
      byModel[model].correctnessTotal += correctness;
      byModel[model].correctnessCount++;
    }
  }
  return {
    prompts: x1000AiSearchPrompts.length,
    rows: rows.length,
    answered: answered.length,
    mentions: mentionRows.length,
    mentionRate: answered.length ? mentionRows.length / answered.length : 0,
    avgCorrectness: correctnessRows.length
      ? correctnessRows.reduce((sum, value) => sum + value, 0) / correctnessRows.length
      : null,
    byModel: Object.fromEntries(Object.entries(byModel).map(([model, item]) => [model, {
      answers: item.answers,
      mentions: item.mentions,
      mentionRate: item.answers ? item.mentions / item.answers : 0,
      avgCorrectness: item.correctnessCount ? item.correctnessTotal / item.correctnessCount : null,
    }])),
    topContentGaps: rows
      .filter((row) => row.nextContentGap)
      .slice(0, 30)
      .map((row) => ({ query: row.query, model: row.model, gap: row.nextContentGap })),
  };
}

function csv(rows) {
  const headers = ['id', 'category', 'query', 'model', 'mentionsEdooqoo', 'citedUrl', 'productCorrectness0To3', 'competitorChosen', 'nextContentGap', 'answerSummary'];
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
    '',
  ].join('\n');
}

async function main() {
  let rows = templateRows();
  let status = 'manual-template';
  let reason = 'Fill the CSV manually from ChatGPT, Claude, Perplexity, and Gemini UI answers, then rerun with --answers <csv>.';

  if (ANSWERS_PATH) {
    rows = normalizeAnswerRows(parseCsv(await fs.readFile(path.resolve(ANSWERS_PATH), 'utf8')));
    status = 'scored-manual-answers';
    reason = `Scored manual answers from ${path.resolve(ANSWERS_PATH)}.`;
  }

  const summary = score(rows);
  const report = {
    generatedAt: new Date().toISOString(),
    status,
    reason,
    summary,
    rows,
  };

  const markdown = [
    '# AI Search Baseline Run',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${status}`,
    '',
    `Reason: ${reason}`,
    '',
    '## Summary',
    '',
    `- Prompt families: ${x1000AiSearchPrompts.length}`,
    `- Rows: ${summary.rows}`,
    `- Answered rows: ${summary.answered}`,
    `- Edooqoo mentions: ${summary.mentions}`,
    `- Mention rate: ${(summary.mentionRate * 100).toFixed(1)}%`,
    `- Average correctness: ${summary.avgCorrectness === null ? 'n/a' : summary.avgCorrectness.toFixed(2)}`,
    '',
    '## By Model',
    '',
    '| Model | Answers | Mentions | Mention rate | Avg correctness |',
    '|---|---:|---:|---:|---:|',
    ...Object.entries(summary.byModel).map(([model, item]) =>
      `| ${model} | ${item.answers} | ${item.mentions} | ${(item.mentionRate * 100).toFixed(1)}% | ${item.avgCorrectness === null ? 'n/a' : item.avgCorrectness.toFixed(2)} |`
    ),
    '',
    '## Top Content Gaps',
    '',
    '| Query | Model | Gap |',
    '|---|---|---|',
    ...summary.topContentGaps.map((gap) => `| ${gap.query} | ${gap.model} | ${gap.gap} |`),
    '',
    '## Manual Instructions',
    '',
    '- Use the generated CSV as the working sheet.',
    '- One row equals one prompt in one answer engine.',
    '- Correctness: 0 = wrong category, 1 = generic worksheet tool only, 2 = partly correct workflow, 3 = recurring adult 1:1 tutor workflow with teacher review.',
    '- Convert repeated gaps into new content tasks.',
    '',
  ].join('\n');

  const { jsonPath, mdPath } = await writeRunFiles({ root: ROOT, category: 'ai-search', date: DATE, report, markdown });
  await fs.mkdir(path.dirname(CSV_OUTPUT), { recursive: true });
  await fs.writeFile(CSV_OUTPUT, csv(rows), 'utf8');
  console.log(`[ai-search] ${status} wrote ${path.relative(ROOT, jsonPath)}, ${path.relative(ROOT, mdPath)}, and ${path.relative(ROOT, CSV_OUTPUT)}`);
}

await main();
