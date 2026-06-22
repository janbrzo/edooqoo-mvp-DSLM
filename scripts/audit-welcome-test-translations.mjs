#!/usr/bin/env node
// v6.9.67 — Audit script: lists profiling question IDs (non-skill) from
// welcomeTestQuestions.ts and checks that every translation set covers them.
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

// Walk question objects naively
const profilingIds = new Set();
const re = /\{\s*id:\s*['"](wt_q[a-z0-9]+)['"][^}]*?question_type:\s*['"]([a-z_]+)['"][\s\S]*?\}/g;
let m;
while ((m = re.exec(qFile)) !== null) {
  if (PROFILING_TYPES.has(m[2])) profilingIds.add(m[1]);
}

const langRe = /^const ([A-Z]+): TranslationSet = \{([\s\S]*?)\n\};/gm;
const langs = {};
let lm;
while ((lm = langRe.exec(tFile)) !== null) {
  const ids = new Set();
  const idRe = /'(wt_q[a-z0-9]+)':/g;
  let im;
  while ((im = idRe.exec(lm[2])) !== null) ids.add(im[1]);
  langs[lm[1]] = ids;
}

let failed = false;
console.log(`Profiling IDs found in questions: ${profilingIds.size}`);
for (const [lang, ids] of Object.entries(langs)) {
  const missing = [...profilingIds].filter((id) => !ids.has(id));
  if (missing.length) {
    failed = true;
    console.error(`[FAIL] ${lang} missing: ${missing.join(', ')}`);
  } else {
    console.log(`[OK]   ${lang} (${ids.size})`);
  }
}
process.exit(failed ? 1 : 0);
