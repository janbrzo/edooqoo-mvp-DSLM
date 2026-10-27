/**
 * Pure helpers of the profile v2 backfill DRY RUN (decision D15). Nothing here
 * reads or writes a database: it recomputes the v2/v3 profile columns of a
 * stored Welcome Test profile from its STORED answers with the shared code the
 * Edge Function uses, and describes the difference against what is stored.
 *
 * Used by scripts/dslm/backfill-profile-v2-dryrun.mjs and tested in
 * src/lib/welcomeTest/__tests__/profileV2Backfill.test.ts.
 */
import {
  TRAIT_QUESTIONS,
  answersFromQuestionRows,
  reconstructTraits,
} from '../../supabase/functions/_shared/welcomeTestTraits';
import { LEGACY_OPTION_TEXT, matchOptionIndex } from '../../supabase/functions/_shared/welcomeTestOptionAliases';
import { bankOfRowCount, storedQuestionId } from '../../supabase/functions/_shared/welcomeTestBank';
import { WELCOME_TEST_QUESTION_IDS } from '../../supabase/functions/_shared/welcomeTestTraits';
import { shownRows } from '../../supabase/functions/_shared/welcomeTestFlow';
import {
  INTERPRETATION_VERSION,
  INTERPRETATION_VERSION_KEY,
  buildTraitEvidence,
  interpretationVersionOf,
} from '../../supabase/functions/_shared/welcomeTestInterpretation';
import {
  Q9_OPTIONS,
  Q10_OPTIONS,
  Q3B_OPTIONS,
  computeLearningPathScore,
} from '../../supabase/functions/_shared/learningPathScore';
import { answerBehaviour, computeDivergences } from '../../supabase/functions/_shared/welcomeTestSignals';
import {
  capacityOfLearningPath,
  computeIntensity,
  computeStylePacing,
} from '../../supabase/functions/_shared/pacing';

/** Columns the backfill would set (the v2 columns of process-welcome-test). */
export const V2_COLUMNS = ['traits', 'learning_path', 'divergences', 'answer_behaviour', 'signal_coverage'] as const;
export type V2Column = (typeof V2_COLUMNS)[number];

export type Tier = 'missing_v2_columns' | 'pre_stage4' | 'current';

/** Trait name -> typed student_learning_profiles column that already holds it. */
export const TRAIT_COLUMNS: Readonly<Record<string, string>> = {
  self_assessed_level: 'self_assessed_level',
  motivation_type: 'motivation_type',
  anxiety_level: 'anxiety_level',
  ambiguity_tolerance: 'ambiguity_tolerance',
  error_attitude: 'error_attitude',
  preferred_input_channel: 'preferred_input_channel',
  feedback_preference: 'feedback_preference',
  weekly_study_time: 'weekly_study_time',
};

/** Question ids whose stored answers feed traits or the Learning Path Score. */
export const RELEVANT_QUESTION_IDS: readonly string[] = Array.from(new Set([
  ...Object.values(TRAIT_QUESTIONS).map((c) => c.questionId),
  'wt_q3b', 'wt_q9', 'wt_q10', 'wt_q44',
]));

type Json = Record<string, any>;

export interface QuestionRowInput {
  question_index?: number | null;
  question_data?: unknown;
  student_answer?: unknown;
  element_type?: string | null;
  is_correct?: boolean | null;
  time_spent_seconds?: number | null;
}

export interface ProfileEntry {
  /** student_learning_profiles row (raw_answers may be reduced to wt_* keys, learning_path and stamps). */
  profile: Json;
  /** student_tests row of profile.welcome_test_id, null when missing. */
  test?: { total_questions?: number | null; attempt_number?: number | null } | null;
  /** student_test_questions rows of that test. */
  rows: QuestionRowInput[];
}

export const shortId = (id: unknown): string => String(id ?? '').slice(0, 8);

const asObject = (v: unknown): Json | null => {
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return null; }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** missing_v2_columns: no traits and no learning path column; pre_stage4: columns exist but not LPS v3 + interpretation v2 + trait_evidence. */
export function classifyProfile(profile: Json): Tier {
  const traits = asObject(profile.traits);
  const lp = asObject(profile.learning_path);
  if (!traits || !lp) return 'missing_v2_columns';
  const raw = asObject(profile.raw_answers) ?? {};
  const stamped = interpretationVersionOf(traits) >= INTERPRETATION_VERSION;
  return Number(lp.version) >= 3 && stamped && raw.trait_evidence ? 'current' : 'pre_stage4';
}

export type AnswerSource = 'rows' | 'raw_answers' | 'none';

/**
 * Same source rule as process-welcome-test: a test of a known bank size is
 * rebuilt from its stored rows; a legacy test (another size) uses the wt_* keys
 * of the stored raw_answers; rows fill in when raw_answers has nothing.
 */
export function resolveAnswers(entry: ProfileEntry): { answers: Record<string, unknown>; source: AnswerSource } {
  const total = Number(entry.test?.total_questions ?? 0);
  const rows = entry.rows || [];
  const isLegacy = total > 0 && bankOfRowCount(total) === null;
  const fromRows = answersFromQuestionRows(rows as any[]);
  const raw = asObject(entry.profile.raw_answers) ?? {};
  const fromRaw: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('wt_') && v !== null && v !== undefined) fromRaw[k] = v;
  }
  if (isLegacy) {
    if (Object.keys(fromRaw).length > 0) return { answers: fromRaw, source: 'raw_answers' };
    if (Object.keys(fromRows).length > 0) return { answers: fromRows, source: 'rows' };
    return { answers: {}, source: 'none' };
  }
  if (Object.keys(fromRows).length > 0) return { answers: fromRows, source: 'rows' };
  if (Object.keys(fromRaw).length > 0) return { answers: fromRaw, source: 'raw_answers' };
  return { answers: {}, source: 'none' };
}

const isBlank = (v: unknown): boolean => v === null || v === undefined || v === '' || v === '__IDK__';

/**
 * Question ids whose stored answer is present but matches no option text (the
 * legacy alias problem, E1): the trait or LPS component behind it would be
 * silently lost, so such a profile cannot be recomputed safely.
 */
export function findUnmatchedAnswers(answers: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const check = (qid: string, options: readonly string[]) => {
    const v = answers[qid];
    if (isBlank(v)) return;
    const list = Array.isArray(v) ? v : [v];
    for (const a of list) {
      if (typeof a !== 'string' || isBlank(a)) continue;
      if (matchOptionIndex(qid, options, a) < 0) out.add(qid);
    }
  };
  for (const cfg of Object.values(TRAIT_QUESTIONS)) check(cfg.questionId, cfg.options);
  check('wt_q3b', Q3B_OPTIONS);
  check('wt_q9', Q9_OPTIONS);
  check('wt_q10', Q10_OPTIONS);
  return Array.from(out).sort();
}

/**
 * WHAT-IF only: merges proposed legacy option texts into the in-memory alias
 * table of this process (nothing is written anywhere). Returns a function that
 * restores the original table. Used to show what a profile would look like once
 * the aliases the dry run asks for exist (E1).
 */
export function applyExtraAliases(extra: Record<string, Record<string, string>>): () => void {
  const table = LEGACY_OPTION_TEXT as Record<string, Record<string, string>>;
  const snapshot = new Map<string, Record<string, string> | undefined>();
  for (const [qid, map] of Object.entries(extra)) {
    snapshot.set(qid, table[qid] ? { ...table[qid] } : undefined);
    table[qid] = { ...(table[qid] ?? {}), ...map };
  }
  return () => {
    for (const [qid, prev] of snapshot) {
      if (prev === undefined) delete table[qid];
      else table[qid] = prev;
    }
  };
}

export interface PacingView {
  intensity: string | null;
  score: number | null;
  lpVersion: number | null;
  capacity: string | null;
  capacityWarning: string | null;
  /** Style pacing of the profile signals alone (no goals, metrics or level), for the before/after delta. */
  styleFromProfile: number;
}

/** What the prompts see: the learning_path column, else raw_answers.learning_path (loadLearningProfileForPacing). */
export function pacingViewOf(profile: Json, learningPath: unknown, now: Date | number): PacingView {
  const intensity = computeIntensity(learningPath, null);
  const capacity = capacityOfLearningPath(learningPath);
  const style = computeStylePacing({
    student: {},
    profile: {
      level_confidence: profile.level_confidence ?? null,
      anxiety_level: profile.anxiety_level ?? null,
      error_attitude: profile.error_attitude ?? null,
      weekly_study_time: profile.weekly_study_time ?? null,
      capacity,
    },
    now,
  }).pacing;
  return {
    intensity: intensity.intensity,
    score: intensity.score,
    lpVersion: intensity.version,
    capacity,
    capacityWarning: intensity.capacityWarning,
    styleFromProfile: style,
  };
}

export interface RecomputeResult {
  studentId: string;
  tier: Tier;
  answerSource: AnswerSource;
  answerCount: number;
  interpretationVersion: number;
  /** Question ids whose stored answer matches no option text: not safe to recompute. */
  unmatched: string[];
  /** Traits resolved only by the typed column (answers did not resolve them). */
  traitsFromColumns: string[];
  /** Traits whose recomputed value differs from the typed column already stored. */
  traitColumnMismatches: string[];
  after: Record<V2Column, unknown>;
  /** raw_answers keys the backfill would add or replace. */
  afterRaw: { interpretation_version: number; trait_evidence: unknown; learning_path: unknown };
  /** Per column: 'set' (was null), 'changed', 'same'. */
  columnChange: Record<V2Column, 'set' | 'changed' | 'same'>;
  before: PacingView;
  afterPacing: PacingView;
  intensityChanged: boolean;
  capacityWarningChanged: boolean;
  styleDelta: number;
  /** Pre-stage-4 profiles: the stored v2 learning path reproduced with version 2 (null when not applicable). */
  v2Reproduced: boolean | null;
  /** Same recomputation with the current interpretation version, only when it differs from the profile's own. */
  currentInterpretationAlt: { traitsChanged: string[]; intensity: string | null; score: number | null } | null;
  unsafe: boolean;
  notes: string[];
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Stable stringify so key order never produces a false difference. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v as Json).sort().map((k) => [k, canon((v as Json)[k])]));
  }
  return v;
}
const sameCanon = (a: unknown, b: unknown): boolean => same(canon(a), canon(b));

function storedLearningPath(profile: Json): unknown {
  return asObject(profile.learning_path) ?? asObject(asObject(profile.raw_answers)?.learning_path) ?? null;
}

/**
 * Recomputes the v2 columns of one profile without any write. The interpretation
 * version is the one the profile was written with (unstamped = 1), exactly what
 * a force re-run of the same attempt does, so stored psychological readings are
 * not reinterpreted; the Learning Path is computed as v3.
 */
export function recomputeProfile(entry: ProfileEntry, now: Date | number = Date.UTC(2026, 9, 27)): RecomputeResult {
  const profile = entry.profile;
  const tier = classifyProfile(profile);
  const { answers, source } = resolveAnswers(entry);
  const raw = asObject(profile.raw_answers) ?? {};
  const interpretationVersion = interpretationVersionOf(asObject(profile.traits) ?? raw);
  const notes: string[] = [];

  const fallback: Record<string, string> = {};
  for (const [trait, col] of Object.entries(TRAIT_COLUMNS)) {
    const v = profile[col];
    if (typeof v === 'string' && v) fallback[trait] = v;
  }
  const fromAnswers = reconstructTraits(answers, null, interpretationVersion);
  const traits = reconstructTraits(answers, fallback, interpretationVersion);
  const traitsFromColumns = Object.keys(traits).filter((t) => fromAnswers[t] === undefined).sort();
  const traitColumnMismatches = Object.keys(fromAnswers)
    .filter((t) => TRAIT_COLUMNS[t] && fallback[t] !== undefined && fallback[t] !== fromAnswers[t])
    .sort();

  const unmatched = findUnmatchedAnswers(answers);
  const learningPath = computeLearningPathScore(traits, answers);

  // Behaviour and wrong-or-IDK count use the same rows as the Edge Function.
  const rows = (entry.rows || []) as any[];
  const rowId = (q: any): string | null => storedQuestionId(q) ?? WELCOME_TEST_QUESTION_IDS[q.question_index] ?? null;
  const scored = rows.length === 72 ? shownRows(rows, rowId) : rows;
  const behaviour = answerBehaviour(scored);
  let skillWrongOrIdk = 0;
  for (const q of scored) {
    if (!['grammar', 'vocabulary', 'reading', 'listening'].includes(String(q.element_type))) continue;
    if (q.student_answer === '__IDK__' || q.is_correct === false) skillWrongOrIdk++;
  }
  if (rows.length === 0) notes.push('no stored question rows: answer_behaviour is empty');
  const totalQuestions = Number(entry.test?.total_questions ?? 0);
  if (totalQuestions > 0 && bankOfRowCount(totalQuestions) === null) {
    notes.push(`legacy test (${totalQuestions} rows): answers from raw_answers, answer_behaviour counts every stored row`);
  }

  const matrix = asObject(answers.wt_q44) ?? {};
  const divergences = computeDivergences({
    traits,
    estimatedLevel: profile.estimated_level ?? null,
    selfAssessedLevel: profile.self_assessed_level || traits.self_assessed_level || null,
    confidenceMatrix: matrix,
    readingScore: num(profile.reading_score),
    writingScore: num(profile.writing_score),
    speakingScore: num(profile.speaking_score),
    selfAwarenessScore: num(profile.self_awareness_score),
    skillWrongOrIdk,
    behaviour,
  });

  const after: Record<V2Column, unknown> = {
    // An unstamped profile is interpretation v1 by definition: no stamp is added, so the stored reading is not relabelled.
    traits: { version: 1, ...(interpretationVersion > 1 ? { [INTERPRETATION_VERSION_KEY]: interpretationVersion } : {}), ...traits },
    learning_path: learningPath,
    divergences,
    answer_behaviour: behaviour,
    signal_coverage: learningPath.coverage,
  };
  const columnChange = {} as Record<V2Column, 'set' | 'changed' | 'same'>;
  for (const col of V2_COLUMNS) {
    const b = profile[col] === undefined ? null : (col === 'signal_coverage' ? num(profile[col]) : (asObject(profile[col]) ?? (Array.isArray(profile[col]) ? profile[col] : profile[col])));
    const a = col === 'signal_coverage' ? num(after[col]) : after[col];
    columnChange[col] = b === null ? 'set' : sameCanon(b, a) ? 'same' : 'changed';
  }

  let v2Reproduced: boolean | null = null;
  const storedLp = asObject(profile.learning_path);
  if (storedLp && Number(storedLp.version) === 2) {
    v2Reproduced = sameCanon(storedLp, computeLearningPathScore(traits, answers, { version: 2 }));
  }

  let currentInterpretationAlt: RecomputeResult['currentInterpretationAlt'] = null;
  if (interpretationVersion !== INTERPRETATION_VERSION) {
    const altTraits = reconstructTraits(answers, fallback, INTERPRETATION_VERSION);
    const altLp = computeLearningPathScore(altTraits, answers);
    const changed = Array.from(new Set([...Object.keys(traits), ...Object.keys(altTraits)])).filter((t) => traits[t] !== altTraits[t]).sort();
    const altIntensity = computeIntensity(altLp, null);
    currentInterpretationAlt = { traitsChanged: changed, intensity: altIntensity.intensity, score: altIntensity.score };
  }

  const before = pacingViewOf(profile, storedLearningPath(profile), now);
  const afterPacing = pacingViewOf(profile, learningPath, now);
  const unsafe = unmatched.length > 0 || source === 'none';
  if (source === 'none') notes.push('no stored answers found');

  return {
    studentId: shortId(profile.student_id),
    tier,
    answerSource: source,
    answerCount: Object.keys(answers).length,
    interpretationVersion,
    unmatched,
    traitsFromColumns,
    traitColumnMismatches,
    after,
    afterRaw: {
      interpretation_version: interpretationVersion,
      trait_evidence: buildTraitEvidence(answers, interpretationVersion),
      learning_path: learningPath,
    },
    columnChange,
    before,
    afterPacing,
    intensityChanged: before.intensity !== afterPacing.intensity,
    capacityWarningChanged: before.capacityWarning !== afterPacing.capacityWarning,
    styleDelta: afterPacing.styleFromProfile - before.styleFromProfile,
    v2Reproduced,
    currentInterpretationAlt,
    unsafe,
    notes,
  };
}

export interface Summary {
  total: number;
  byTier: Record<Tier, number>;
  recomputable: number;
  unsafe: number;
  intensityChanged: number;
  capacityWarningChanged: number;
  styleChanged: number;
  columnSet: Record<V2Column, number>;
  columnChanged: Record<V2Column, number>;
}

export function summarize(results: RecomputeResult[]): Summary {
  const cols = () => Object.fromEntries(V2_COLUMNS.map((c) => [c, 0])) as Record<V2Column, number>;
  const s: Summary = {
    total: results.length,
    byTier: { missing_v2_columns: 0, pre_stage4: 0, current: 0 },
    recomputable: 0, unsafe: 0, intensityChanged: 0, capacityWarningChanged: 0, styleChanged: 0,
    columnSet: cols(), columnChanged: cols(),
  };
  for (const r of results) {
    s.byTier[r.tier]++;
    if (r.unsafe) s.unsafe++; else s.recomputable++;
    if (r.intensityChanged) s.intensityChanged++;
    if (r.capacityWarningChanged) s.capacityWarningChanged++;
    if (r.styleDelta !== 0) s.styleChanged++;
    for (const c of V2_COLUMNS) {
      if (r.columnChange[c] === 'set') s.columnSet[c]++;
      if (r.columnChange[c] === 'changed') s.columnChanged[c]++;
    }
  }
  return s;
}

const cell = (v: unknown): string => (v === null || v === undefined ? '-' : String(v));
const pace = (p: PacingView): string => (p.intensity ? `${p.intensity} (${cell(p.score)}, v${cell(p.lpVersion)})` : 'none');

/** Markdown before/after table and counts. Student ids are shortened; no names, emails or answer text. */
export function renderMarkdown(results: RecomputeResult[], asOf: string, includeCurrent = false): string {
  const s = summarize(results);
  const lines: string[] = [];
  lines.push(`Dry run, nothing written. Data as of ${asOf}.`, '');
  lines.push('## Counts', '');
  lines.push('| Item | Count |', '|---|---|');
  lines.push(`| Profiles | ${s.total} |`);
  lines.push(`| Tier missing v2 columns (D15 target) | ${s.byTier.missing_v2_columns} |`);
  lines.push(`| Tier pre Stage 4 (columns present, LPS v2 / interpretation unstamped) | ${s.byTier.pre_stage4} |`);
  lines.push(`| Tier current (LPS v3, interpretation v2, trait_evidence) | ${s.byTier.current} |`);
  lines.push(`| Recomputable safely | ${s.recomputable} |`);
  lines.push(`| Not safe (answer matches no option text, or no answers) | ${s.unsafe} |`);
  lines.push(`| Prompt intensity would change | ${s.intensityChanged} |`);
  lines.push(`| Capacity warning would change | ${s.capacityWarningChanged} |`);
  lines.push(`| Profile-only style pacing would change | ${s.styleChanged} |`, '');
  lines.push('## Per column', '', '| Column | Null to set | Value changed |', '|---|---|---|');
  for (const c of V2_COLUMNS) lines.push(`| ${c} | ${s.columnSet[c]} | ${s.columnChanged[c]} |`);
  lines.push('', '## Per profile', '');
  lines.push('| Student | Tier | Source | Answers | Intensity before | Intensity after | Intensity change | Style delta | Divergences | Coverage | Flags |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results.filter((x) => includeCurrent || x.tier !== 'current')) {
    const flags: string[] = [];
    if (r.unmatched.length) flags.push(`NO_OPTION_MATCH ${r.unmatched.join(',')}`);
    if (r.answerSource === 'none') flags.push('NO_ANSWERS');
    if (r.unsafe) flags.push('DO_NOT_APPLY');
    if (r.traitsFromColumns.length) flags.push(`column fallback: ${r.traitsFromColumns.join(',')}`);
    if (r.traitColumnMismatches.length) flags.push(`trait differs from column: ${r.traitColumnMismatches.join(',')}`);
    if (r.v2Reproduced === false) flags.push('stored LPS v2 NOT reproduced');
    if (r.capacityWarningChanged) flags.push('capacity warning changes');
    for (const n of r.notes) flags.push(n);
    if (r.currentInterpretationAlt && r.currentInterpretationAlt.traitsChanged.length) {
      flags.push(`interp v2 would change: ${r.currentInterpretationAlt.traitsChanged.join(',')}`);
    }
    const div = (r.after.divergences as unknown[]).length;
    lines.push(`| ${r.studentId} | ${r.tier} | ${r.answerSource} | ${r.answerCount} | ${pace(r.before)} | ${pace(r.afterPacing)} | ${r.intensityChanged ? 'YES' : 'no'} | ${r.styleDelta} | ${div} | ${cell(r.after.signal_coverage)} | ${flags.join('; ') || '-'} |`);
  }
  return lines.join('\n') + '\n';
}
