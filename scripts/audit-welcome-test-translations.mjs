#!/usr/bin/env node
// v6.9.68 — Structural translation audit. Verifies that every profiling
// (non-skill) question has translations in every registered language, that
// each translated entry includes a `question`, that the option count matches
// the source, and that a `description` exists when the source has one.
// Skill items (multiple_choice grammar/vocab) are intentionally NOT translated.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const qFile = fs.readFileSync(path.join(root, 'src/data/welcomeTestQuestions.ts'), 'utf8');
const tFile = fs.readFileSync(path.join(root, 'src/data/welcomeTestTranslations.ts'), 'utf8');

// Heuristic: profiling = question_type in this set
const PROFILING_TYPES = new Set([
  'self_assessment','self_assessment_matrix','preference_choice',
  'scenario_reaction','open_reflection','speaking_record','listening_comprehension',
]);

// Walk question objects naively. Capture id, question_type, optional
// `options` literal count and whether `description:` is present in the body.
const profiling = new Map(); // id -> { hasOptions, optionCount, hasDescription }
const re = /\{\s*id:\s*['"](wt_q[a-z0-9]+)['"]([\s\S]*?)\n\s{2}\},/g;
let m;
while ((m = re.exec(qFile)) !== null) {
  const id = m[1];
  const body = m[2];
  const typeMatch = body.match(/question_type:\s*['"]([a-z_]+)['"]/);
  if (!typeMatch || !PROFILING_TYPES.has(typeMatch[1])) continue;
  const hasDescription = /\n\s*description:\s*['"]/.test(body);
  const optionsBlock = body.match(/\n\s*options:\s*\[([\s\S]*?)\][,\n]/);
  let optionCount = 0;
  let hasOptions = false;
  if (optionsBlock) {
    hasOptions = true;
    optionCount = countStringLiterals(optionsBlock[1]);
  }
  profiling.set(id, { hasOptions, optionCount, hasDescription });
}
const profilingIds = new Set(profiling.keys());

const langRe = /^const ([A-Z]+): TranslationSet = \{([\s\S]*?)\n\};/gm;
const langs = {};
let lm;
while ((lm = langRe.exec(tFile)) !== null) {
  const langName = lm[1];
  const body = lm[2];
  // Split per-question entries: 'wt_qN': { ... }
  const entries = new Map();
  const entryRe = /'(wt_q[a-z0-9]+)':\s*\{([\s\S]*?)\}\s*,/g;
  let em;
  while ((em = entryRe.exec(body)) !== null) {
    const id = em[1];
    const entryBody = em[2];
    const hasQuestion = /\bquestion:\s*['"]/.test(entryBody);
    const hasDescription = /\bdescription:\s*['"]/.test(entryBody);
    const optMatch = entryBody.match(/\boptions:\s*\[([\s\S]*?)\]/);
    let optionCount = 0;
    let hasOptions = false;
    if (optMatch) {
      hasOptions = true;
      optionCount = countStringLiterals(optMatch[1]);
    }
    entries.set(id, { hasQuestion, hasDescription, hasOptions, optionCount });
  }
  langs[langName] = entries;
}

let failed = false;
console.log(`Profiling IDs found in questions: ${profilingIds.size}`);
for (const [lang, entries] of Object.entries(langs)) {
  const problems = [];
  for (const id of profilingIds) {
    const src = profiling.get(id);
    const tr = entries.get(id);
    if (!tr) { problems.push(`missing ${id}`); continue; }
    if (!tr.hasQuestion) problems.push(`${id}: no 'question'`);
    if (src.hasOptions && !tr.hasOptions) problems.push(`${id}: missing options`);
    if (src.hasOptions && tr.hasOptions && src.optionCount !== tr.optionCount) {
      problems.push(`${id}: options ${tr.optionCount}≠${src.optionCount}`);
    }
    if (src.hasDescription && !tr.hasDescription) problems.push(`${id}: missing description`);
  }
  if (problems.length) {
    failed = true;
    console.error(`[FAIL] ${lang} (${entries.size}): ${problems.slice(0, 6).join(' | ')}${problems.length > 6 ? ` …+${problems.length - 6}` : ''}`);
  } else {
    console.log(`[OK]   ${lang} (${entries.size})`);
  }
}
process.exit(failed ? 1 : 0);
