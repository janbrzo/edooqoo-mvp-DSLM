/**
 * Pure helpers for the teacher-facing Welcome Test profile (Stage 4/5 UI):
 * level states, trait resolution, signal keys for the validation loop and the
 * headline skill score. Every reader is defensive: old profiles have none of
 * the newer raw_answers fields.
 */
import { TRAIT_META, visibleTraitKeys } from './traitLabels';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// ---------------------------------------------------------------------------
// Level states
// ---------------------------------------------------------------------------

export interface LevelEvidence {
  status: 'ok' | 'insufficient';
  scoredItems: number | null;
  answeredItems: number | null;
  minScored: number | null;
  minAnswered: number | null;
}

/** raw_answers.level_evidence, or null when absent or malformed. */
export function readLevelEvidence(rawAnswers: unknown): LevelEvidence | null {
  if (!isRecord(rawAnswers) || !isRecord(rawAnswers.level_evidence)) return null;
  const e = rawAnswers.level_evidence;
  if (e.status !== 'ok' && e.status !== 'insufficient') return null;
  return {
    status: e.status,
    scoredItems: isNum(e.scored_items) ? e.scored_items : null,
    answeredItems: isNum(e.answered_items) ? e.answered_items : null,
    minScored: isNum(e.min_scored) ? e.min_scored : null,
    minAnswered: isNum(e.min_answered) ? e.min_answered : null,
  };
}

export type LevelState =
  | { kind: 'analysing'; message: string }
  | { kind: 'insufficient'; message: string }
  | { kind: 'level'; level: string }
  | { kind: 'none'; message: string };

export const ANALYSING_MESSAGE = 'Analysing results...';

export function insufficientLevelMessage(evidence: LevelEvidence): string {
  const have = evidence.scoredItems ?? 0;
  const need = evidence.minScored;
  const progress = need !== null ? ` (${have} of ${need} needed)` : '';
  return `Not enough answers to estimate a level${progress}. Set the level manually after the first lesson.`;
}

/**
 * What to show instead of a bare CEFR level. A welcome test still in status
 * 'completed' is being analysed; level_evidence 'insufficient' (or no level at
 * all) never shows a level.
 */
export function describeLevelState(input: {
  estimatedLevel: string | null | undefined;
  rawAnswers: unknown;
  testStatus?: string | null;
  isWelcomeTest?: boolean;
}): LevelState {
  if (input.isWelcomeTest && input.testStatus === 'completed') {
    return { kind: 'analysing', message: ANALYSING_MESSAGE };
  }
  const evidence = readLevelEvidence(input.rawAnswers);
  if (evidence?.status === 'insufficient') {
    return { kind: 'insufficient', message: insufficientLevelMessage(evidence) };
  }
  const level = typeof input.estimatedLevel === 'string' ? input.estimatedLevel.trim() : '';
  if (level) return { kind: 'level', level };
  return { kind: 'none', message: 'No level estimate yet.' };
}

// ---------------------------------------------------------------------------
// Traits
// ---------------------------------------------------------------------------

/** Trait columns that older profiles carry without a `traits` JSON. */
const TRAIT_COLUMNS = [
  'self_assessed_level', 'motivation_type', 'anxiety_level', 'ambiguity_tolerance', 'error_attitude',
  'preferred_input_channel', 'feedback_preference', 'weekly_study_time',
] as const;

/** raw_answers.__interpretation_version__ (a number), else null. */
export function readInterpretationVersion(rawAnswers: unknown): number | null {
  if (!isRecord(rawAnswers)) return null;
  const v = rawAnswers.__interpretation_version__;
  return isNum(v) ? v : null;
}

/** String-valued traits: the `traits` JSON first, then the legacy columns. Keys starting with "__" are dropped. */
export function resolveProfileTraits(profile: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRecord(profile)) return out;
  if (isRecord(profile.traits)) {
    for (const [k, v] of Object.entries(profile.traits)) {
      if (k.startsWith('__')) continue;
      if (typeof v === 'string' && v.trim()) out[k] = v;
    }
  }
  for (const col of TRAIT_COLUMNS) {
    const v = profile[col];
    if (!out[col] && typeof v === 'string' && v.trim()) out[col] = v;
  }
  return out;
}

export interface TraitRow {
  key: string;
  value: string;
}

/** Display order: known traits in TRAIT_ORDER, then unknown ones alphabetically. */
export function orderedTraitRows(traits: Record<string, string>): TraitRow[] {
  return visibleTraitKeys(Object.keys(traits)).map((key) => ({ key, value: traits[key] }));
}

export function readTraitEvidence(rawAnswers: unknown): unknown {
  return isRecord(rawAnswers) ? rawAnswers.trait_evidence : undefined;
}

export function isKnownTrait(key: string): boolean {
  return key in TRAIT_META;
}

// ---------------------------------------------------------------------------
// Validation loop (signal keys and timing)
// ---------------------------------------------------------------------------

export const FEEDBACK_HINT_DAYS = 14;
export const FEEDBACK_HINT_TEXT = 'Rate these after 2-4 lessons, once you have seen the student in class.';

export const traitSignalKey = (traitKey: string): string => `trait:${traitKey}`;
export const LEARNING_PATH_SIGNAL_KEY = 'learning_path_band';

/** Divergence keys: pair name, with "#2", "#3" for a repeated pair (metacognition can appear twice). */
export function divergenceSignalKeys(pairs: ReadonlyArray<string>): string[] {
  const seen = new Map<string, number>();
  return pairs.map((pair) => {
    const n = (seen.get(pair) ?? 0) + 1;
    seen.set(pair, n);
    return n === 1 ? `divergence:${pair}` : `divergence:${pair}#${n}`;
  });
}

/** True while the test was completed less than FEEDBACK_HINT_DAYS ago. Unknown dates show no hint. */
export function isFeedbackHintVisible(completedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!completedAt) return false;
  const t = Date.parse(completedAt);
  if (!Number.isFinite(t)) return false;
  const ageDays = (now.getTime() - t) / 86_400_000;
  return ageDays < FEEDBACK_HINT_DAYS;
}

export const FEEDBACK_VERDICTS = ['agree', 'partly', 'disagree'] as const;
export type FeedbackVerdict = (typeof FEEDBACK_VERDICTS)[number];
export const FEEDBACK_VERDICT_LABELS: Readonly<Record<FeedbackVerdict, string>> = {
  agree: 'Agree',
  partly: 'Partly',
  disagree: 'Disagree',
};
export const FEEDBACK_COMMENT_MAX = 1000;

// ---------------------------------------------------------------------------
// Headline skill score (keyed items only)
// ---------------------------------------------------------------------------

interface KeyedQuestionLike {
  correct_answer?: unknown;
  is_correct?: boolean | null;
}

/** Items with a stored key (grammar, vocabulary, reading, listening...). */
export function isKeyedQuestion(q: KeyedQuestionLike): boolean {
  const c = q.correct_answer;
  return !!c && c !== '""';
}

export interface KeyedScore {
  keyedTotal: number;
  correct: number;
  /** null when no keyed item has been scored yet (shown as "-", never 0%). */
  percent: number | null;
}

/** The only headline score of a Welcome Test: correct keyed items over all keyed items. */
export function computeKeyedScore(questions: ReadonlyArray<KeyedQuestionLike>): KeyedScore {
  const keyed = questions.filter(isKeyedQuestion);
  const correct = keyed.filter((q) => q.is_correct === true).length;
  const scored = keyed.some((q) => q.is_correct !== null && q.is_correct !== undefined);
  return {
    keyedTotal: keyed.length,
    correct,
    percent: keyed.length > 0 && scored ? Math.round((correct / keyed.length) * 100) : null,
  };
}
