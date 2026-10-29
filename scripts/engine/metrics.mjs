/**
 * Golden set quality metrics (pure, no I/O). Used by run-golden-set.mjs and by
 * src/lib/__tests__/goldenSetMetrics.test.ts.
 *
 * The definitions follow the Phase 2 verification report so a baseline is
 * comparable with the production figures:
 *  - word-order "unbuildable": lowercase, keep only a-z0-9, split the scrambled
 *    list on slashes and whitespace, split the key on whitespace, compare the
 *    sorted multisets (method A, 112 of 380 on production);
 *  - fill-in-blanks "missing": single-blank sentence, answer not in the word
 *    bank (lowercase, trim); "near form" = bank word is a substring of the
 *    answer or the reverse (work/works);
 *  - gap-text "equals base": answer equals the `verb` field; "contextual" =
 *    one of the 3 words before the gap is a modal, to, do-support or a conjunction.
 *
 * The em dash is built from a code point so this file passes noEmDash.test.ts.
 */

const EM_DASH = String.fromCharCode(0x2014);
const CANONICAL_NANO = /^ns\.(A1|A2|B1|B2|C1|C2)\.[a-z0-9_]+\.[a-z0-9_.]+$/;
const BASE_CONTEXT_WORDS = new Set([
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'to',
  'do', 'does', 'did', "don't", "doesn't", "didn't", 'dont', 'doesnt', 'didnt', 'and', 'or',
  'not', 'let', 'lets', "let's",
]);

export const expectedExerciseCount = (lessonTime) => (lessonTime === '45min' ? 6 : 8);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

export function normaliseTokens(text) {
  return String(text ?? '')
    .toLowerCase()
    .split(/\s*\/\s*|\s+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
}

/** True when the key can be rebuilt from exactly the scrambled words. */
export function isWordOrderBuildable(scrambled, key) {
  const raw = Array.isArray(scrambled) ? scrambled.join(' / ') : scrambled;
  const a = normaliseTokens(raw).sort();
  const b = normaliseTokens(key).sort();
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

function textOf(v) {
  return typeof v === 'string' ? v : '';
}

/** Every string leaf of `node`, skipping keys in `skipKeys`. */
function collectStrings(node, skipKeys, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) for (const n of node) collectStrings(n, skipKeys, out);
  else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (skipKeys.has(k)) continue;
      collectStrings(v, skipKeys, out);
    }
  }
  return out;
}

function collectNanoSkills(node, out = []) {
  if (Array.isArray(node)) for (const n of node) collectNanoSkills(n, out);
  else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'nano_skill' && Array.isArray(v)) out.push(...v);
      else collectNanoSkills(v, out);
    }
  }
  return out;
}

const countMatches = (strings, re) =>
  strings.reduce((n, s) => n + (s.match(re) || []).length, 0);

function wordOrderMetrics(exercises) {
  let items = 0;
  let unbuildable = 0;
  const examples = [];
  for (const ex of exercises) {
    if (ex.type !== 'word-order' && !String(ex.type).startsWith('word-order')) continue;
    for (const s of ex.sentences || ex.items || []) {
      const scr = s?.scrambled_words ?? s?.scrambled;
      const key = s?.correct_order ?? s?.answer ?? s?.correct;
      if (scr == null || key == null) continue;
      items += 1;
      if (!isWordOrderBuildable(scr, key)) {
        unbuildable += 1;
        if (examples.length < 5) examples.push({ scrambled: scr, key });
      }
    }
  }
  return { items, unbuildable, unbuildable_pct: pct(unbuildable, items), examples };
}

function multipleChoiceMetrics(exercises) {
  let questions = 0;
  let zeroCorrect = 0;
  let multiCorrect = 0;
  const positions = { A: 0, B: 0, C: 0, D: 0, other: 0 };
  for (const ex of exercises) {
    if (!String(ex.type).startsWith('multiple-choice')) continue;
    for (const q of ex.questions || []) {
      const opts = Array.isArray(q?.options) ? q.options : [];
      if (!opts.length) continue;
      questions += 1;
      const correctIdx = opts.map((o, i) => (o && o.correct === true ? i : -1)).filter((i) => i >= 0);
      if (correctIdx.length === 0) zeroCorrect += 1;
      else if (correctIdx.length > 1) multiCorrect += 1;
      else {
        const label = 'ABCD'[correctIdx[0]];
        if (label) positions[label] += 1;
        else positions.other += 1;
      }
    }
  }
  const single = positions.A + positions.B + positions.C + positions.D + positions.other;
  const histogram_pct = {};
  for (const k of ['A', 'B', 'C', 'D']) histogram_pct[k] = pct(positions[k], single);
  return {
    questions,
    zero_correct: zeroCorrect,
    multi_correct: multiCorrect,
    correct_position: positions,
    correct_position_pct: histogram_pct,
  };
}

const norm = (s) => String(s ?? '').toLowerCase().trim();

function fillInBlanksMetrics(exercises) {
  let exerciseCount = 0;
  let exercisesWithBank = 0;
  let exercisesWithDistractor = 0;
  let sentences = 0;
  let multiBlank = 0;
  let singleBlank = 0;
  let missing = 0;
  let missingNearForm = 0;
  for (const ex of exercises) {
    if (ex.type !== 'fill-in-blanks' && ex.type !== 'fill-in-blanks-audio') continue;
    const bank = Array.isArray(ex.word_bank) ? ex.word_bank.map(norm) : null;
    const sents = ex.sentences || [];
    exerciseCount += 1;
    if (bank && bank.length) {
      exercisesWithBank += 1;
      const answers = new Set(sents.map((s) => norm(s?.answer)));
      if (new Set(bank).size > answers.size || bank.length > sents.length) exercisesWithDistractor += 1;
    }
    for (const s of sents) {
      const blanks = (str(s?.text).match(/_{2,}/g) || []).length;
      sentences += 1;
      if (blanks > 1) {
        multiBlank += 1;
        continue;
      }
      singleBlank += 1;
      if (!bank || !bank.length) continue;
      const ans = norm(s?.answer);
      if (ans && !bank.includes(ans)) {
        missing += 1;
        if (bank.some((w) => w && (ans.includes(w) || w.includes(ans)))) missingNearForm += 1;
      }
    }
  }
  return {
    exercises: exerciseCount,
    exercises_with_bank: exercisesWithBank,
    exercises_with_distractors: exercisesWithDistractor,
    no_distractor_pct: pct(exercisesWithBank - exercisesWithDistractor, exercisesWithBank),
    sentences,
    multi_blank_sentences: multiBlank,
    single_blank_sentences: singleBlank,
    answer_missing_from_bank: missing,
    answer_missing_near_form: missingNearForm,
    answer_missing_true: missing - missingNearForm,
  };
}

function gapTextMetrics(exercises) {
  let items = 0;
  let withVerb = 0;
  let equalsBase = 0;
  let equalsBaseContextual = 0;
  for (const ex of exercises) {
    if (ex.type !== 'gap-text') continue;
    for (const s of ex.sentences || []) {
      items += 1;
      const verb = norm(s?.verb ?? s?.base_word);
      if (!verb) continue;
      withVerb += 1;
      if (norm(s?.answer) === verb) {
        equalsBase += 1;
        const before = norm(str(s?.text).split(/_{2,}/)[0]).split(/\s+/).filter(Boolean).slice(-3);
        if (before.some((w) => BASE_CONTEXT_WORDS.has(w.replace(/[^a-z']/g, '')))) equalsBaseContextual += 1;
      }
    }
  }
  return {
    items,
    items_with_verb: withVerb,
    answer_equals_base: equalsBase,
    answer_equals_base_contextual: equalsBaseContextual,
    answer_equals_base_defect: equalsBase - equalsBaseContextual,
    answer_equals_base_pct: pct(equalsBase, withVerb),
  };
}

const NANO_KEY = new Set(['nano_skill']);

function registerMetrics(worksheet) {
  const exercises = worksheet.exercises || [];
  const instructions = [];
  const tips = [];
  for (const ex of exercises) {
    instructions.push(textOf(ex.instructions));
    tips.push(textOf(ex.teacher_tip));
  }
  const all = collectStrings(worksheet, NANO_KEY);
  const teacherOrPartner = /teacher or partner/gi;
  const withPartner = /with a partner/gi;
  const students = /\bstudents\b/gi;
  return {
    teacher_or_partner: {
      instructions: countMatches(instructions, teacherOrPartner),
      all_text: countMatches(all, teacherOrPartner),
    },
    with_a_partner: {
      instructions: countMatches(instructions, withPartner),
      all_text: countMatches(all, withPartner),
    },
    students: {
      teacher_tip: countMatches(tips, students),
      instructions: countMatches(instructions, students),
      all_text: countMatches(all, students),
    },
    has_teacher_or_partner: countMatches(instructions, teacherOrPartner) > 0,
    has_with_a_partner: countMatches(all, withPartner) > 0,
    has_students_in_tips: countMatches(tips, students) > 0,
  };
}

function emDashMetrics(worksheet) {
  const re = new RegExp(EM_DASH, 'g');
  const hiddenKeys = new Set(['nano_skill', 'audio_transcript', 'transcript', 'full_transcript', 'transcript_with_blanks']);
  const visible = collectStrings(worksheet, hiddenKeys);
  const nano = collectStrings(collectNanoSkills(worksheet), new Set());
  const transcripts = [];
  const walk = (n) => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (isObj(n)) {
      for (const [k, v] of Object.entries(n)) {
        if (k === 'audio_transcript' || k === 'transcript' || k === 'full_transcript') transcripts.push(...collectStrings(v, new Set()));
        else walk(v);
      }
    }
  };
  walk(worksheet);
  return {
    visible: countMatches(visible, re),
    nano_skill: countMatches(nano, re),
    transcript: countMatches(transcripts, re),
  };
}

function nanoSkillMetrics(worksheet) {
  const tags = collectNanoSkills(worksheet);
  let canonical = 0;
  let badFormat = 0;
  let badConfidence = 0;
  const names = [];
  for (const t of tags) {
    const name = typeof t?.name === 'string' ? t.name : '';
    names.push(name);
    if (CANONICAL_NANO.test(name)) canonical += 1;
    else badFormat += 1;
    const c = t?.confidence;
    if (typeof c !== 'number' || !(c >= 0 && c <= 1)) badConfidence += 1;
  }
  const unique = new Set(names).size;
  return {
    tags: tags.length,
    canonical,
    canonical_pct: pct(canonical, tags.length),
    bad_format: badFormat,
    bad_confidence: badConfidence,
    unique_names: unique,
    unique_pct: pct(unique, tags.length),
    names,
  };
}

function typeOrderMetrics(actual, requested) {
  const sameSet =
    actual.length === requested.length && [...actual].sort().join('|') === [...requested].sort().join('|');
  const exactOrder = sameSet && actual.every((t, i) => t === requested[i]);
  return {
    actual,
    requested,
    same_set: sameSet,
    exact_order: exactOrder,
    first_mismatch_index: exactOrder ? -1 : actual.findIndex((t, i) => t !== requested[i]),
    missing: requested.filter((t) => !actual.includes(t)),
    extra: actual.filter((t) => !requested.includes(t)),
  };
}

/**
 * Metrics of one worksheet.
 * @param {object} worksheet saved/streamed worksheet JSON ({title, exercises:[...]})
 * @param {{formData?: object, timing?: object}} ctx request form and SSE timing
 */
export function computeWorksheetMetrics(worksheet, ctx = {}) {
  const ws = isObj(worksheet) ? worksheet : { exercises: [] };
  const exercises = Array.isArray(ws.exercises) ? ws.exercises.filter(isObj) : [];
  const form = ctx.formData || {};
  const expected = expectedExerciseCount(form.lessonTime);
  const requested = Array.isArray(form.selectedExercises) ? form.selectedExercises : [];
  const actualTypes = exercises.map((e) => String(e.type));
  const json = JSON.stringify(ws);
  const timing = ctx.timing || {};
  return {
    exercise_count: { actual: exercises.length, expected, match: exercises.length === expected },
    types: typeOrderMetrics(actualTypes, requested),
    word_order: wordOrderMetrics(exercises),
    multiple_choice: multipleChoiceMetrics(exercises),
    fill_in_blanks: fillInBlanksMetrics(exercises),
    gap_text: gapTextMetrics(exercises),
    em_dash: emDashMetrics(ws),
    register: registerMetrics(ws),
    nano_skill: nanoSkillMetrics(ws),
    generation: {
      total_ms: timing.total_ms ?? null,
      first_progress_ms: timing.first_progress_ms ?? null,
      sse_events: timing.sse_events ?? null,
      json_chars: json.length,
      approx_tokens: Math.round(json.length / 4),
    },
  };
}

const sum = (list, pick) => list.reduce((n, m) => n + (pick(m) || 0), 0);
const avg = (list, pick) => {
  const v = list.map(pick).filter((x) => typeof x === 'number');
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/** Aggregate over the per-worksheet metrics of successful runs. */
export function aggregateMetrics(metricsList, totalForms = metricsList.length) {
  const m = metricsList;
  const n = m.length;
  const wo = { items: sum(m, (x) => x.word_order.items), bad: sum(m, (x) => x.word_order.unbuildable) };
  const mcQ = sum(m, (x) => x.multiple_choice.questions);
  const pos = { A: 0, B: 0, C: 0, D: 0 };
  for (const x of m) for (const k of Object.keys(pos)) pos[k] += x.multiple_choice.correct_position[k] || 0;
  const posTotal = pos.A + pos.B + pos.C + pos.D;
  const fibEx = sum(m, (x) => x.fill_in_blanks.exercises_with_bank);
  const fibNoDist = fibEx - sum(m, (x) => x.fill_in_blanks.exercises_with_distractors);
  const fibSingle = sum(m, (x) => x.fill_in_blanks.single_blank_sentences);
  const fibSent = sum(m, (x) => x.fill_in_blanks.sentences);
  const gapVerb = sum(m, (x) => x.gap_text.items_with_verb);
  const tags = sum(m, (x) => x.nano_skill.tags);
  const canonical = sum(m, (x) => x.nano_skill.canonical);
  const allNames = new Set(m.flatMap((x) => x.nano_skill.names));
  return {
    forms_total: totalForms,
    worksheets: n,
    exercise_count_mismatch: m.filter((x) => !x.exercise_count.match).length,
    type_set_mismatch: m.filter((x) => !x.types.same_set).length,
    type_order_mismatch_same_set: m.filter((x) => x.types.same_set && !x.types.exact_order).length,
    word_order_items: wo.items,
    word_order_unbuildable: wo.bad,
    word_order_unbuildable_pct: pct(wo.bad, wo.items),
    word_order_worksheets_affected: m.filter((x) => x.word_order.unbuildable > 0).length,
    mc_questions: mcQ,
    mc_zero_correct: sum(m, (x) => x.multiple_choice.zero_correct),
    mc_multi_correct: sum(m, (x) => x.multiple_choice.multi_correct),
    mc_correct_position: pos,
    mc_correct_position_pct: {
      A: pct(pos.A, posTotal), B: pct(pos.B, posTotal), C: pct(pos.C, posTotal), D: pct(pos.D, posTotal),
    },
    fib_exercises_with_bank: fibEx,
    fib_no_distractor: fibNoDist,
    fib_no_distractor_pct: pct(fibNoDist, fibEx),
    fib_sentences: fibSent,
    fib_multi_blank_sentences: sum(m, (x) => x.fill_in_blanks.multi_blank_sentences),
    fib_multi_blank_pct: pct(sum(m, (x) => x.fill_in_blanks.multi_blank_sentences), fibSent),
    fib_single_blank_sentences: fibSingle,
    fib_answer_missing_from_bank: sum(m, (x) => x.fill_in_blanks.answer_missing_from_bank),
    fib_answer_missing_near_form: sum(m, (x) => x.fill_in_blanks.answer_missing_near_form),
    fib_answer_missing_true: sum(m, (x) => x.fill_in_blanks.answer_missing_true),
    gap_items_with_verb: gapVerb,
    gap_answer_equals_base: sum(m, (x) => x.gap_text.answer_equals_base),
    gap_answer_equals_base_pct: pct(sum(m, (x) => x.gap_text.answer_equals_base), gapVerb),
    gap_answer_equals_base_contextual: sum(m, (x) => x.gap_text.answer_equals_base_contextual),
    gap_answer_equals_base_defect: sum(m, (x) => x.gap_text.answer_equals_base_defect),
    em_dash_visible_total: sum(m, (x) => x.em_dash.visible),
    em_dash_worksheets: m.filter((x) => x.em_dash.visible > 0).length,
    em_dash_transcript_total: sum(m, (x) => x.em_dash.transcript),
    em_dash_nano_skill_total: sum(m, (x) => x.em_dash.nano_skill),
    teacher_or_partner_worksheets: m.filter((x) => x.register.has_teacher_or_partner).length,
    teacher_or_partner_instructions: sum(m, (x) => x.register.teacher_or_partner.instructions),
    with_a_partner_worksheets: m.filter((x) => x.register.has_with_a_partner).length,
    with_a_partner_total: sum(m, (x) => x.register.with_a_partner.all_text),
    students_in_tips_worksheets: m.filter((x) => x.register.has_students_in_tips).length,
    students_in_tips_total: sum(m, (x) => x.register.students.teacher_tip),
    nano_tags: tags,
    nano_canonical: canonical,
    nano_canonical_pct: pct(canonical, tags),
    nano_bad_format: sum(m, (x) => x.nano_skill.bad_format),
    nano_bad_confidence: sum(m, (x) => x.nano_skill.bad_confidence),
    nano_unique_names_per_worksheet_avg_pct: avg(m, (x) => x.nano_skill.unique_pct),
    nano_unique_names_overall_pct: pct(allNames.size, tags),
    generation_ms_avg: avg(m, (x) => x.generation.total_ms),
    generation_ms_max: m.reduce((a, x) => Math.max(a, x.generation.total_ms || 0), 0) || null,
    approx_tokens_avg: avg(m, (x) => x.generation.approx_tokens),
  };
}

const f = (v, suffix = '') => (v === null || v === undefined ? 'n/a' : `${v}${suffix}`);

/** Markdown table of the aggregate (current baseline vs production figures). */
export function renderSummaryMarkdown(agg, title = 'Golden set summary') {
  const rows = [
    ['Worksheets generated / forms', `${agg.worksheets}/${agg.forms_total}`, '-'],
    ['Exercise count != 6/8', f(agg.exercise_count_mismatch), '3/172 (1.7%)'],
    ['Type set differs from requested', f(agg.type_set_mismatch), '-'],
    ['Same types, different order', f(agg.type_order_mismatch_same_set), '13/172 (12 with media)'],
    ['Word-order unbuildable items', `${agg.word_order_unbuildable}/${agg.word_order_items} (${f(agg.word_order_unbuildable_pct, '%')})`, '112/380 (29.5%), range 112-126'],
    ['Word-order worksheets affected', f(agg.word_order_worksheets_affected), '34/38 (89%)'],
    ['MC questions with 0 correct', f(agg.mc_zero_correct), '0/1540'],
    ['MC questions with 2+ correct', f(agg.mc_multi_correct), '8/1540 in 3 ws'],
    ['MC correct position A/B/C/D (%)', ['A', 'B', 'C', 'D'].map((k) => f(agg.mc_correct_position_pct[k])).join(' / '), '20.1 / 41.8 / 34.3 / 3.9'],
    ['FIB answer missing from bank (1-blank)', `${agg.fib_answer_missing_from_bank} (near form ${agg.fib_answer_missing_near_form}, true ${agg.fib_answer_missing_true})`, '61 (near form 21, true about 40)'],
    ['FIB exercises with no distractors', `${agg.fib_no_distractor}/${agg.fib_exercises_with_bank} (${f(agg.fib_no_distractor_pct, '%')})`, '136/157 (86.6%)'],
    ['FIB multi-blank sentences', `${agg.fib_multi_blank_sentences}/${agg.fib_sentences} (${f(agg.fib_multi_blank_pct, '%')})`, '175/1557 (11.2%)'],
    ['Gap-text answer = base word', `${agg.gap_answer_equals_base}/${agg.gap_items_with_verb} (${f(agg.gap_answer_equals_base_pct, '%')}; contextual ${agg.gap_answer_equals_base_contextual}, defect ${agg.gap_answer_equals_base_defect})`, '71/570 (12.5%), 17 contextual, about 54 defect'],
    ['Em dash in visible text (total / worksheets)', `${agg.em_dash_visible_total} / ${agg.em_dash_worksheets}`, '22/172 worksheets (12.8%)'],
    ['Em dash in transcripts / nano_skill', `${agg.em_dash_transcript_total} / ${agg.em_dash_nano_skill_total}`, '8 ws transcript / 0'],
    ['"teacher or partner" worksheets', f(agg.teacher_or_partner_worksheets), '71/172 (41%)'],
    ['"with a partner" worksheets', f(agg.with_a_partner_worksheets), '45/172 (26%)'],
    ['"students" in teacher_tip worksheets', f(agg.students_in_tips_worksheets), '167/172 (97%)'],
    ['nano_skill tags', f(agg.nano_tags), 'about 17 961 over 172 ws'],
    ['nano_skill canonical share', f(agg.nano_canonical_pct, '%'), '99.7% (59 bad of 17 961)'],
    ['nano_skill bad format / bad confidence', `${agg.nano_bad_format} / ${agg.nano_bad_confidence}`, '59 / 2'],
    ['nano_skill unique names (overall)', f(agg.nano_unique_names_overall_pct, '%'), '74%'],
    ['Generation time avg / max (s)', `${f(agg.generation_ms_avg === null ? null : Math.round(agg.generation_ms_avg / 1000))} / ${f(agg.generation_ms_max === null ? null : Math.round(agg.generation_ms_max / 1000))}`, '-'],
    ['Output size avg (approx tokens)', f(agg.approx_tokens_avg), '-'],
  ];
  const head = `# ${title}\n\n| Metric | This run | Production (Phase 2 section 2) |\n|---|---|---|\n`;
  return head + rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`).join('\n') + '\n';
}
