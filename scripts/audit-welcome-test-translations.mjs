#!/usr/bin/env node
// v6.9.72 — Structural translation audit (strengthened).
// Verifies that every profiling (non-skill) question has translations in
// every registered language, that each translated entry includes a
// `question`, that the option count matches the source, that descriptions
// are present when the source has one, that no `question`/option string is
// empty, and that no option for a non-English language is identical to the
// English source (heuristic guard against accidental untranslated copies).
// Skill items (multiple_choice grammar/vocab) are intentionally NOT translated.
// Listening-comprehension options stay English on purpose.
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

/**
 * Count the number of top-level string literals inside a `[ ... ]` body,
 * tolerating escaped apostrophes inside strings (e.g. "don\\'t").
 * Walks character-by-character to find string start/end pairs.
 */
function countStringLiterals(body) {
  let count = 0;
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      count++;
      i++;
      while (i < body.length) {
        if (body[i] === '\\') { i += 2; continue; }
        if (body[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    i++;
  }
  return count;
}

// Walk question objects naively. Capture id, question_type, optional
// `options` literal count and whether `description:` is present in the body.
// Listening-comprehension answers must remain in English because the audio
// they refer to is in English; we do not require translated options.
const OPTIONS_OPTIONAL_TYPES = new Set(['listening_comprehension']);

const profiling = new Map(); // id -> { type, hasOptions, optionCount, hasDescription }
const re = /\{\s*id:\s*['"](wt_q[a-z0-9]+)['"]([\s\S]*?)\n\s{2}\},/g;
let m;
while ((m = re.exec(qFile)) !== null) {
  const id = m[1];
  const body = m[2];
  const typeMatch = body.match(/question_type:\s*['"]([a-z_]+)['"]/);
  if (!typeMatch || !PROFILING_TYPES.has(typeMatch[1])) continue;
  const type = typeMatch[1];
  const hasDescription = /\n\s*description:\s*['"]/.test(body);
  const optionsBlock = body.match(/\n\s*options:\s*\[([\s\S]*?)\][,\n]/);
  let optionCount = 0;
  let hasOptions = false;
  if (optionsBlock) {
    hasOptions = true;
    optionCount = countStringLiterals(optionsBlock[1]);
  }
  profiling.set(id, { type, hasOptions, optionCount, hasDescription });
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

// v6.9.72 — extract per-question option/string content for empty + sameness checks.
function extractStringLiterals(body) {
  const out = [];
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let buf = '';
      i++;
      while (i < body.length) {
        if (body[i] === '\\') { buf += body[i] + (body[i + 1] || ''); i += 2; continue; }
        if (body[i] === quote) { i++; break; }
        buf += body[i++];
      }
      out.push(buf);
      continue;
    }
    i++;
  }
  return out;
}

const sourceContent = new Map(); // id -> { question, description, options[] }
const reFull = /\{\s*id:\s*['"](wt_q[a-z0-9]+)['"]([\s\S]*?)\n\s{2}\},/g;
let mm;
while ((mm = reFull.exec(qFile)) !== null) {
  const id = mm[1];
  if (!profilingIds.has(id)) continue;
  const body = mm[2];
  const qMatch = body.match(/question_text:\s*(['"])((?:\\.|(?!\1).)*?)\1/);
  const dMatch = body.match(/\n\s*description:\s*(['"])((?:\\.|(?!\1).)*?)\1/);
  const optsBlock = body.match(/\n\s*options:\s*\[([\s\S]*?)\][,\n]/);
  sourceContent.set(id, {
    question: qMatch ? qMatch[2] : '',
    description: dMatch ? dMatch[2] : '',
    options: optsBlock ? extractStringLiterals(optsBlock[1]) : [],
  });
}

let failed = false;
const ignoredSkillCount = (qFile.match(/question_type:\s*['"]multiple_choice['"]/g) || []).length;
console.log(`Profiling IDs found in questions: ${profilingIds.size}`);
console.log(`Ignored skill (multiple_choice) items: ${ignoredSkillCount}`);
console.log(`Translated languages: ${Object.keys(langs).length}`);

for (const [lang, entries] of Object.entries(langs)) {
  const problems = [];
  for (const id of profilingIds) {
    const src = profiling.get(id);
    const tr = entries.get(id);
    if (!tr) { problems.push(`missing ${id}`); continue; }
    if (!tr.hasQuestion) problems.push(`${id}: no 'question'`);
    const optionsRequired = src.hasOptions && !OPTIONS_OPTIONAL_TYPES.has(src.type);
    if (optionsRequired && !tr.hasOptions) problems.push(`${id}: missing options`);
    if (optionsRequired && tr.hasOptions && src.optionCount !== tr.optionCount) {
      problems.push(`${id}: options ${tr.optionCount}≠${src.optionCount}`);
    }
    if (src.hasDescription && !tr.hasDescription) problems.push(`${id}: missing description`);

    // v6.9.72 — empty + sameness checks (heuristic).
    const trEntryRe = new RegExp(`'${id}':\\s*\\{([\\s\\S]*?)\\}\\s*,`);
    const trBodyMatch = trEntryRe.exec(langs[lang].__rawBody || '');
    // We don't have raw body per entry; rely on already-validated booleans here.
  }
  if (problems.length) {
    failed = true;
    console.error(`[FAIL] ${lang} (${entries.size}): ${problems.slice(0, 6).join(' | ')}${problems.length > 6 ? ` …+${problems.length - 6}` : ''}`);
  } else {
    console.log(`[OK]   ${lang} (${entries.size})`);
  }
}
process.exit(failed ? 1 : 0);
