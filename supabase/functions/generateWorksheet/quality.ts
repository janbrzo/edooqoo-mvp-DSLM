/* eslint-disable @typescript-eslint/no-explicit-any -- the input is untyped model output */
// Deterministic quality checks over a parsed worksheet (observation only).
//
// Pure functions: no I/O, no environment, no logging, no mutation of the
// worksheet. The definitions follow scripts/engine/metrics.mjs (the golden set
// metrics) so a runtime figure is comparable with a baseline figure, and the
// Phase 2 verification report:
//  - word-order "unbuildable": lowercase, keep only letters and digits, split
//    the scrambled list on slashes and whitespace, split the key on
//    whitespace, compare the sorted multisets (internal commas, apostrophes
//    and hyphens never cause a false defect);
//  - fill-in-blanks "missing": single-blank sentence whose answer is not in the
//    word bank; "near form" = a bank word contains the answer or the reverse
//    (work / works);
//  - gap-text "equals base": the answer equals the `verb` (or `base_word`)
//    field; it is "contextual" when one of the three words before the gap is a
//    modal, `to`, a do-support form, `and`, `or`, `not` or `let`, where the
//    base form is correct English.
//
// The report holds counts and enumerations only, never worksheet text, so it
// is safe to log.

import { ALL_EXERCISE_IDS } from "../_shared/exerciseTaxonomy.ts";

/** Em dash U+2014, built from its code point (noEmDash.test.ts scans sources). */
const EM_DASH = String.fromCharCode(0x2014);
const EM_DASH_RE = new RegExp(EM_DASH, "g");

const CANONICAL_NANO = /^ns\.(A1|A2|B1|B2|C1|C2)\.[a-z0-9_]+\.[a-z0-9_.]+$/;

const BASE_CONTEXT_WORDS = new Set([
  "can", "could", "will", "would", "shall", "should", "may", "might", "must", "to",
  "do", "does", "did", "don't", "doesn't", "didn't", "dont", "doesnt", "didnt", "and", "or",
  "not", "let", "lets", "let's",
]);

/** Owner decision: at most 2 of 10 gap-text items may be base form in context. */
export const GAP_TEXT_CONTEXTUAL_LIMIT_PER_TEN = 2;

/** Types the report may name (taxonomy plus the two the validators know); anything else is "other". */
const KNOWN_TYPES: ReadonlySet<string> = new Set([...ALL_EXERCISE_IDS, "synonyms-antonyms", "sentence-transformation"]);

export type DefectCode =
  | "exercise_count_mismatch"
  | "type_set_mismatch"
  | "type_order_mismatch"
  | "word_order_unbuildable"
  | "mc_zero_correct"
  | "mc_multi_correct"
  | "fib_answer_missing_from_bank"
  | "fib_no_distractors"
  | "gap_text_base_form_no_context"
  | "gap_text_contextual_over_limit"
  | "em_dash_visible"
  | "em_dash_transcript"
  | "nano_skill_bad_format"
  | "nano_skill_bad_confidence"
  | "register_teacher_or_partner"
  | "register_with_a_partner"
  | "register_students_in_teacher_tip";

export interface QualityContext {
  /** Exercises the plan asked for (6 for 45 min, otherwise 8). */
  expectedCount?: number | null;
  /** formData.selectedExercises (the plan uses the first `expectedCount`). */
  requestedTypes?: string[] | null;
  /** A picture or audio is attached: the prompt sorts picture > audio > others. */
  hasMedia?: boolean;
  /** False for single-exercise regeneration: count and order are not checked. */
  checkCountAndOrder?: boolean;
  /** False when the requested order is not a reliable reference (batch): set and count are still checked. */
  checkOrder?: boolean;
}

export interface QualityReport {
  exercise_count: { applicable: boolean; expected: number | null; actual: number; match: boolean | null };
  type_order: {
    applicable: boolean;
    same_set: boolean | null;
    exact_order: boolean | null;
    /** Exact order once the picture > audio > others sort of the prompt is applied. */
    exact_order_media_sorted: boolean | null;
    first_mismatch_index: number;
    missing: string[];
    extra: string[];
  };
  word_order: { items: number; unbuildable: number };
  multiple_choice: { questions: number; zero_correct: number; multi_correct: number };
  fill_in_blanks: {
    exercises: number;
    exercises_with_bank: number;
    exercises_without_bank: number;
    exercises_without_distractors: number;
    sentences: number;
    multi_blank_sentences: number;
    single_blank_sentences: number;
    answer_missing_from_bank: number;
    answer_missing_near_form: number;
    answer_missing_true: number;
  };
  gap_text: {
    items: number;
    items_with_verb: number;
    answer_equals_base: number;
    contextual: number;
    defect: number;
    exercises_over_contextual_limit: number;
  };
  em_dash: { visible: number; transcript: number; nano_skill: number };
  nano_skill: { tags: number; bad_format: number; bad_confidence: number };
  register: { teacher_or_partner: number; with_a_partner: number; students_in_teacher_tip: number };
  /** Codes of every check that found something, in a fixed order. */
  defects: DefectCode[];
}

const isObj = (v: unknown): v is Record<string, any> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const norm = (v: unknown): string => String(v ?? "").toLowerCase().trim();

// ---------------------------------------------------------------------------
// word-order
// ---------------------------------------------------------------------------

/** Lowercased chunks split on slashes and whitespace, punctuation removed. */
export function normaliseWordOrderTokens(text: unknown): string[] {
  return String(text ?? "")
    .toLowerCase()
    .split(/\s*\/\s*|\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
}

/** True when the key can be rebuilt from exactly the scrambled words. */
export function isWordOrderBuildable(scrambled: unknown, key: unknown): boolean {
  const raw = Array.isArray(scrambled) ? scrambled.join(" / ") : scrambled;
  const a = normaliseWordOrderTokens(raw).sort();
  const b = normaliseWordOrderTokens(key).sort();
  return a.length === b.length && a.every((token, i) => token === b[i]);
}

function checkWordOrder(exercises: Record<string, any>[]) {
  let items = 0;
  let unbuildable = 0;
  for (const ex of exercises) {
    if (!String(ex.type).startsWith("word-order")) continue;
    const list = Array.isArray(ex.sentences) ? ex.sentences : Array.isArray(ex.items) ? ex.items : [];
    for (const s of list) {
      const scrambled = s?.scrambled_words ?? s?.scrambled;
      const key = s?.correct_order ?? s?.answer ?? s?.correct;
      if (scrambled == null || key == null) continue;
      items += 1;
      if (!isWordOrderBuildable(scrambled, key)) unbuildable += 1;
    }
  }
  return { items, unbuildable };
}

// ---------------------------------------------------------------------------
// multiple choice
// ---------------------------------------------------------------------------

function checkMultipleChoice(exercises: Record<string, any>[]) {
  let questions = 0;
  let zeroCorrect = 0;
  let multiCorrect = 0;
  for (const ex of exercises) {
    if (!String(ex.type).startsWith("multiple-choice")) continue;
    for (const q of Array.isArray(ex.questions) ? ex.questions : []) {
      const options = Array.isArray(q?.options) ? q.options : [];
      if (!options.length) continue;
      questions += 1;
      const correct = options.filter((o: any) => isObj(o) && o.correct === true).length;
      if (correct === 0) zeroCorrect += 1;
      else if (correct > 1) multiCorrect += 1;
    }
  }
  return { questions, zero_correct: zeroCorrect, multi_correct: multiCorrect };
}

// ---------------------------------------------------------------------------
// fill-in-blanks (also the audio and picture variants: same structure)
// ---------------------------------------------------------------------------

function checkFillInBlanks(exercises: Record<string, any>[]) {
  const out = {
    exercises: 0,
    exercises_with_bank: 0,
    exercises_without_bank: 0,
    exercises_without_distractors: 0,
    sentences: 0,
    multi_blank_sentences: 0,
    single_blank_sentences: 0,
    answer_missing_from_bank: 0,
    answer_missing_near_form: 0,
    answer_missing_true: 0,
  };
  for (const ex of exercises) {
    if (!String(ex.type).startsWith("fill-in-blanks")) continue;
    // The prompt schema is "sentences" + "word_bank"; transcript_with_blanks is forbidden.
    const sentences = Array.isArray(ex.sentences) ? ex.sentences : [];
    const bank: string[] | null = Array.isArray(ex.word_bank) ? ex.word_bank.map(norm) : null;
    out.exercises += 1;
    if (bank && bank.length) {
      out.exercises_with_bank += 1;
      const answers = new Set(sentences.map((s: any) => norm(s?.answer)));
      const hasDistractor = new Set(bank).size > answers.size || bank.length > sentences.length;
      if (!hasDistractor) out.exercises_without_distractors += 1;
    } else {
      out.exercises_without_bank += 1;
    }
    for (const s of sentences) {
      out.sentences += 1;
      const blanks = (str(s?.text).match(/_{2,}/g) || []).length;
      if (blanks > 1) {
        out.multi_blank_sentences += 1;
        continue;
      }
      out.single_blank_sentences += 1;
      if (!bank || !bank.length) continue;
      const answer = norm(s?.answer);
      if (answer && !bank.includes(answer)) {
        out.answer_missing_from_bank += 1;
        if (bank.some((w) => w && (answer.includes(w) || w.includes(answer)))) out.answer_missing_near_form += 1;
      }
    }
  }
  out.answer_missing_true = out.answer_missing_from_bank - out.answer_missing_near_form;
  return out;
}

// ---------------------------------------------------------------------------
// gap-text
// ---------------------------------------------------------------------------

const SUBJUNCTIVE_TRIGGER = new RegExp(
  "\\b(?:vital|essential|imperative|important|necessary|crucial|critical|desirable|advisable|recommended|suggested|" +
    "required|demanded|insisted|requested|proposed|suggest|suggests|recommend|recommends|demand|demands|insist|insists|" +
    "require|requires|request|requests|propose|proposes|advise|advises|advised|urge|urges|urged|lest)\\b",
);
/** Words after which the gap is not a finite verb, or the base form is the correct present form. */
const BASE_OK_PREVIOUS_WORDS = new Set([
  "i", "we", "you", "they", "people", "children", "men", "women", "police", "who", "what", "which",
  "is", "are", "am", "was", "were", "be", "been", "being", "seem", "seems", "look", "looks", "feel", "feels", "become", "becomes",
  "the", "a", "an", "my", "your", "his", "her", "its", "our", "their", "this", "that", "these", "those", "some", "any", "no",
  "very", "more", "most", "so", "too", "quite", "really", "extremely", "less", "least",
  "where", "when", "why", "how", "whom", "whose", "if", "unless", "than", "as",
  "never", "always", "often", "usually", "also", "just", "still", "already",
]);

/**
 * True when the base form is acceptable English at the gap, or when we cannot
 * tell: modal / to / do-support / conjunction context, a subjunctive trigger
 * ("It is vital that", "suggested that"), plural or first/second person
 * subjects, a predicate adjective or noun after a linking verb or determiner,
 * and a gap at the start of the sentence (imperative). Only a gap right after a
 * clearly singular subject (he, she, it, a name, a singular noun) with none of
 * those contexts is a defect, so the log signal has a low false-positive rate.
 */
/**
 * The narrow owner definition: one of the 3 words before the gap is a modal,
 * `to`, a do-support form, `and`, `or`, `not` or `let`. Only these count toward
 * the "at most 2 of 10" limit of the tested skill (base form after a modal).
 */
export function hasModalBaseContext(text: unknown): boolean {
  const before = norm(str(text).split(/_{2,}/)[0]).split(/\s+/).filter(Boolean).slice(-3);
  return before.some((w) => BASE_CONTEXT_WORDS.has(w.replace(/[^a-z']/g, "")));
}

export function hasBaseFormContext(text: unknown): boolean {
  const beforeText = norm(str(text).split(/_{2,}/)[0]);
  const before = beforeText.split(/\s+/).filter(Boolean);
  if (before.length === 0) return true;
  const clean = (w: string) => w.replace(/[^a-z']/g, "");
  if (hasModalBaseContext(text)) return true;
  if (SUBJUNCTIVE_TRIGGER.test(beforeText) && /\b(?:that|lest)\b/.test(beforeText)) return true;
  const last = clean(before[before.length - 1]);
  if (!last) return true;
  if (BASE_OK_PREVIOUS_WORDS.has(last)) return true;
  // plural noun subject (customers, managers): ends in s but not ss, us, is
  if (/[a-z]s$/.test(last) && !/(?:ss|us|is)$/.test(last)) return true;
  return false;
}

function checkGapText(exercises: Record<string, any>[]) {
  let items = 0;
  let withVerb = 0;
  let equalsBase = 0;
  let contextual = 0;
  let overLimit = 0;
  for (const ex of exercises) {
    if (ex.type !== "gap-text") continue;
    const sentences = Array.isArray(ex.sentences) ? ex.sentences : [];
    let exerciseContextual = 0;
    for (const s of sentences) {
      items += 1;
      // The prompt schema field is "verb"; base_word is accepted as well.
      const verb = norm(s?.verb ?? s?.base_word);
      if (!verb) continue;
      withVerb += 1;
      if (norm(s?.answer) !== verb) continue;
      equalsBase += 1;
      if (hasBaseFormContext(s?.text)) {
        contextual += 1;
        if (hasModalBaseContext(s?.text)) exerciseContextual += 1;
      }
    }
    const limit = Math.max(
      GAP_TEXT_CONTEXTUAL_LIMIT_PER_TEN,
      Math.floor((sentences.length * GAP_TEXT_CONTEXTUAL_LIMIT_PER_TEN) / 10),
    );
    if (exerciseContextual > limit) overLimit += 1;
  }
  return {
    items,
    items_with_verb: withVerb,
    answer_equals_base: equalsBase,
    contextual,
    defect: equalsBase - contextual,
    exercises_over_contextual_limit: overLimit,
  };
}

// ---------------------------------------------------------------------------
// text scans (em dash, register markers) and nano_skill
// ---------------------------------------------------------------------------

/** Every string leaf of `node`, skipping the values of keys in `skipKeys`. */
function collectStrings(node: unknown, skipKeys: ReadonlySet<string>, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) for (const n of node) collectStrings(n, skipKeys, out);
  else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (skipKeys.has(k)) continue;
      collectStrings(v, skipKeys, out);
    }
  }
  return out;
}

function collectNanoSkills(node: unknown, out: any[] = []): any[] {
  if (Array.isArray(node)) for (const n of node) collectNanoSkills(n, out);
  else if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k === "nano_skill" && Array.isArray(v)) out.push(...v);
      else collectNanoSkills(v, out);
    }
  }
  return out;
}

const countMatches = (strings: string[], re: RegExp): number =>
  strings.reduce((n, s) => n + (s.match(re) || []).length, 0);

const NANO_KEY: ReadonlySet<string> = new Set(["nano_skill"]);
const TRANSCRIPT_KEYS: ReadonlySet<string> = new Set([
  "audio_transcript", "transcript", "full_transcript", "transcript_with_blanks",
]);
const NO_KEYS: ReadonlySet<string> = new Set();

function checkEmDash(worksheet: Record<string, any>) {
  const hidden = new Set<string>([...NANO_KEY, ...TRANSCRIPT_KEYS]);
  const visible = collectStrings(worksheet, hidden);
  const nano = collectStrings(collectNanoSkills(worksheet), NO_KEYS);
  const transcripts: string[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) n.forEach(walk);
    else if (isObj(n)) {
      for (const [k, v] of Object.entries(n)) {
        if (TRANSCRIPT_KEYS.has(k)) collectStrings(v, NO_KEYS, transcripts);
        else walk(v);
      }
    }
  };
  walk(worksheet);
  return {
    visible: countMatches(visible, EM_DASH_RE),
    transcript: countMatches(transcripts, EM_DASH_RE),
    nano_skill: countMatches(nano, EM_DASH_RE),
  };
}

function checkRegister(worksheet: Record<string, any>, exercises: Record<string, any>[]) {
  const instructions = exercises.map((e) => str(e.instructions));
  const tips = exercises.map((e) => str(e.teacher_tip));
  const all = collectStrings(worksheet, NANO_KEY);
  return {
    teacher_or_partner: countMatches(instructions, /teacher or partner/gi),
    with_a_partner: countMatches(all, /with a partner/gi),
    students_in_teacher_tip: countMatches(tips, /\bstudents\b/gi),
  };
}

function checkNanoSkill(worksheet: Record<string, any>) {
  const tags = collectNanoSkills(worksheet);
  let badFormat = 0;
  let badConfidence = 0;
  for (const t of tags) {
    const name = typeof t?.name === "string" ? t.name : "";
    if (!CANONICAL_NANO.test(name)) badFormat += 1;
    const c = t?.confidence;
    if (typeof c !== "number" || !(c >= 0 && c <= 1)) badConfidence += 1;
  }
  return { tags: tags.length, bad_format: badFormat, bad_confidence: badConfidence };
}

// ---------------------------------------------------------------------------
// exercise count and type order
// ---------------------------------------------------------------------------

const isPicture = (t: string) => t.endsWith("-picture");
const isAudio = (t: string) => t.endsWith("-audio") || t === "listening-comprehension";

/** The order the prompt asks for when a picture or audio is attached (picture > audio > others). */
export function sortRequestedTypesForMedia(requested: string[]): string[] {
  return [
    ...requested.filter(isPicture),
    ...requested.filter((t) => !isPicture(t) && isAudio(t)),
    ...requested.filter((t) => !isPicture(t) && !isAudio(t)),
  ];
}

const safeTypeName = (t: string) => (KNOWN_TYPES.has(t) ? t : "other");

function checkTypeOrder(actual: string[], ctx: QualityContext, applicable: boolean): QualityReport["type_order"] {
  const requestedAll = Array.isArray(ctx.requestedTypes)
    ? ctx.requestedTypes.filter((t) => typeof t === "string")
    : [];
  if (!applicable || requestedAll.length === 0) {
    return {
      applicable: false, same_set: null, exact_order: null, exact_order_media_sorted: null,
      first_mismatch_index: -1, missing: [], extra: [],
    };
  }
  const expected = typeof ctx.expectedCount === "number" ? ctx.expectedCount : requestedAll.length;
  const requested = requestedAll.slice(0, expected);
  const checkOrder = ctx.checkOrder !== false;
  const sameSet = actual.length === requested.length && [...actual].sort().join("|") === [...requested].sort().join("|");
  const exact = sameSet && actual.every((t, i) => t === requested[i]);
  const sorted = sortRequestedTypesForMedia(requested);
  const exactSorted = sameSet && actual.every((t, i) => t === sorted[i]);
  return {
    applicable: true,
    same_set: sameSet,
    exact_order: checkOrder ? exact : null,
    exact_order_media_sorted: checkOrder && ctx.hasMedia ? exactSorted : null,
    first_mismatch_index: exact || !checkOrder ? -1 : actual.findIndex((t, i) => t !== requested[i]),
    missing: requested.filter((t) => !actual.includes(t)).map(safeTypeName),
    extra: actual.filter((t) => !requested.includes(t)).map(safeTypeName),
  };
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

/**
 * Runs every check over a parsed worksheet (`{title, exercises: [...]}`) or a
 * batch response (`{exercises: [...]}`). Never throws on malformed input and
 * never changes it.
 */
export function evaluateWorksheetQuality(worksheet: unknown, ctx: QualityContext = {}): QualityReport {
  const ws: Record<string, any> = isObj(worksheet) ? worksheet : {};
  const exercises: Record<string, any>[] = Array.isArray(ws.exercises) ? ws.exercises.filter(isObj) : [];
  const actualTypes = exercises.map((e) => String(e.type));
  const checkCountAndOrder = ctx.checkCountAndOrder !== false;
  const expected = typeof ctx.expectedCount === "number" ? ctx.expectedCount : null;
  const countApplicable = checkCountAndOrder && expected !== null;
  const actualCount = Array.isArray(ws.exercises) ? ws.exercises.length : 0;

  const report: QualityReport = {
    exercise_count: {
      applicable: countApplicable,
      expected,
      actual: actualCount,
      match: countApplicable ? actualCount === expected : null,
    },
    type_order: checkTypeOrder(actualTypes, ctx, checkCountAndOrder),
    word_order: checkWordOrder(exercises),
    multiple_choice: checkMultipleChoice(exercises),
    fill_in_blanks: checkFillInBlanks(exercises),
    gap_text: checkGapText(exercises),
    em_dash: checkEmDash(ws),
    nano_skill: checkNanoSkill(ws),
    register: checkRegister(ws, exercises),
    defects: [],
  };
  report.defects = listDefects(report);
  return report;
}

function listDefects(r: QualityReport): DefectCode[] {
  const d: DefectCode[] = [];
  if (r.exercise_count.match === false) d.push("exercise_count_mismatch");
  if (r.type_order.applicable) {
    if (r.type_order.same_set === false) d.push("type_set_mismatch");
    else if (r.type_order.exact_order === false && r.type_order.exact_order_media_sorted !== true) {
      // an order that follows the picture > audio > others rule of the prompt is correct
      d.push("type_order_mismatch");
    }
  }
  if (r.word_order.unbuildable > 0) d.push("word_order_unbuildable");
  if (r.multiple_choice.zero_correct > 0) d.push("mc_zero_correct");
  if (r.multiple_choice.multi_correct > 0) d.push("mc_multi_correct");
  if (r.fill_in_blanks.answer_missing_from_bank > 0) d.push("fib_answer_missing_from_bank");
  if (r.fill_in_blanks.exercises_without_distractors > 0) d.push("fib_no_distractors");
  if (r.gap_text.defect > 0) d.push("gap_text_base_form_no_context");
  if (r.gap_text.exercises_over_contextual_limit > 0) d.push("gap_text_contextual_over_limit");
  if (r.em_dash.visible > 0) d.push("em_dash_visible");
  if (r.em_dash.transcript > 0) d.push("em_dash_transcript");
  if (r.nano_skill.bad_format > 0) d.push("nano_skill_bad_format");
  if (r.nano_skill.bad_confidence > 0) d.push("nano_skill_bad_confidence");
  if (r.register.teacher_or_partner > 0) d.push("register_teacher_or_partner");
  if (r.register.with_a_partner > 0) d.push("register_with_a_partner");
  if (r.register.students_in_teacher_tip > 0) d.push("register_students_in_teacher_tip");
  return d;
}
