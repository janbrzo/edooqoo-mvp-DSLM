/**
 * Welcome Test level estimate and validation of the profile model output.
 * Pure (no Deno APIs) so vitest can import it.
 *
 * Only `estimated_level` and `level_confidence` come from here. Answers,
 * traits, the Learning Path Score and the declared-vs-measured pairs never
 * pass through this file.
 */

/**
 * Version of the level algorithm. 1 = the inline computation of process-welcome-test
 * before this module existed (fixed before the AI writing score, "A1" when nothing was
 * scored, "accurate" when the self-assessed level was missing). Profiles that carry no
 * stamp were written by version 1.
 */
export const LEVEL_ALGORITHM_VERSION = 3;

/**
 * Version 3 (owner decision, 2026-10-17): no level without enough evidence. A level
 * needs at least MIN_SCORED_ITEMS scored keyed items ("I don't know" counts as scored),
 * MIN_ANSWERED_ITEMS of them real answers (not "I don't know") and MIN_SCORED_SKILLS
 * skills with a score. One forged answer gave C1 and an all-"I don't know" run gave A1.
 */
export const MIN_SCORED_ITEMS = 8;
export const MIN_ANSWERED_ITEMS = 5;
export const MIN_SCORED_SKILLS = 2;

export interface LevelEvidenceInput {
  /** Keyed items with a verdict (is_correct not null), "I don't know" included. */
  scoredItems: number;
  /** Scored keyed items answered with something other than "I don't know". */
  answeredItems: number;
}

export interface LevelEvidence {
  status: 'ok' | 'insufficient';
  scored_items: number;
  answered_items: number;
  scored_skills: number;
  min_scored: number;
  min_answered: number;
  min_skills: number;
}

/** Key inside the profile raw_answers JSON that stores the version of the stored level. */
export const LEVEL_VERSION_KEY = '__level_algorithm_version__';

export type LevelConfidence = 'accurate' | 'overestimates' | 'underestimates';

export interface LevelInput {
  /** Percent 0-100 per skill, null when nothing was scored. Writing is the FINAL value (AI average when present). */
  grammar: number | null | undefined;
  vocabulary: number | null | undefined;
  reading: number | null | undefined;
  writing: number | null | undefined;
  selfAssessedLevel: string | null | undefined;
  /** Evidence counts; omitted only by callers written before version 3 (no gate). */
  evidence?: LevelEvidenceInput;
}

export interface LevelEstimate {
  /** CEFR level, or null when no skill has a score (never a made-up A1). */
  level: string | null;
  /** Null when the level or the self-assessed level is unknown. */
  confidence: LevelConfidence | null;
  averageScore: number | null;
  scoredSkills: string[];
  version: number;
  /** Present when the caller passed evidence counts. */
  evidence?: LevelEvidence;
}

const LEVEL_MAP: Record<string, number> = {
  'A1': 1, 'A1-A2': 1.5, 'A2': 2, 'A2-B1': 2.5, 'B1': 3, 'B1-B2': 3.5, 'B2': 4, 'B2-C1': 4.5, 'C1': 5, 'C1-C2': 5.5,
};

const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Same thresholds as version 1: mean of the available skill percentages. */
export function levelForAverage(avg: number): string {
  if (avg >= 90) return 'C1';
  if (avg >= 75) return 'B2';
  if (avg >= 55) return 'B1';
  if (avg >= 35) return 'A2';
  return 'A1';
}

export function estimateLevel(input: LevelInput): LevelEstimate {
  const skills: Array<[string, number | null | undefined]> = [
    ['grammar', input.grammar],
    ['vocabulary', input.vocabulary],
    ['reading', input.reading],
    ['writing', input.writing],
  ];
  const scored = skills.filter((s): s is [string, number] => isScore(s[1]));
  const evidence: LevelEvidence | undefined = input.evidence
    ? {
      status: input.evidence.scoredItems >= MIN_SCORED_ITEMS
        && input.evidence.answeredItems >= MIN_ANSWERED_ITEMS
        && scored.length >= MIN_SCORED_SKILLS ? 'ok' : 'insufficient',
      scored_items: input.evidence.scoredItems,
      answered_items: input.evidence.answeredItems,
      scored_skills: scored.length,
      min_scored: MIN_SCORED_ITEMS,
      min_answered: MIN_ANSWERED_ITEMS,
      min_skills: MIN_SCORED_SKILLS,
    }
    : undefined;
  if (scored.length === 0 || evidence?.status === 'insufficient') {
    const averageScore = scored.length > 0 ? scored.reduce((sum, s) => sum + s[1], 0) / scored.length : null;
    return { level: null, confidence: null, averageScore, scoredSkills: scored.map((s) => s[0]), version: LEVEL_ALGORITHM_VERSION, ...(evidence ? { evidence } : {}) };
  }
  const averageScore = scored.reduce((sum, s) => sum + s[1], 0) / scored.length;
  const level = levelForAverage(averageScore);
  const estNum = LEVEL_MAP[level];
  const selfNum = input.selfAssessedLevel ? LEVEL_MAP[input.selfAssessedLevel] : undefined;
  const confidence: LevelConfidence | null = selfNum === undefined
    ? null
    : Math.abs(estNum - selfNum) <= 0.5 ? 'accurate' : selfNum > estNum ? 'overestimates' : 'underestimates';
  return { level, confidence, averageScore, scoredSkills: scored.map((s) => s[0]), version: LEVEL_ALGORITHM_VERSION, ...(evidence ? { evidence } : {}) };
}

export interface StoredLevelProfile {
  estimated_level?: string | null;
  level_confidence?: string | null;
  raw_answers?: unknown;
}

/** Version stamp of a stored profile (1 when unstamped). */
export function storedLevelVersion(profile: StoredLevelProfile | null | undefined): number {
  const raw = profile?.raw_answers;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const v = Number((raw as Record<string, unknown>)[LEVEL_VERSION_KEY]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 1;
}

export interface LevelDecision {
  level: string | null;
  confidence: string | null;
  /** True when the stored value was kept (force re-run of a profile written by another algorithm version). */
  keptStored: boolean;
  /** Version to write into raw_answers; null = leave the stored stamp untouched. */
  stampVersion: number | null;
}

/**
 * New runs use the computed estimate. A force re-run ("Apply to Progress") of the
 * profile of THE SAME attempt keeps the stored level and confidence unless the stored
 * algorithm version is the current one, so a change of the algorithm never re-levels
 * old tests.
 */
export function decideLevel(
  computed: LevelEstimate,
  opts: { force: boolean; sameAttempt: boolean; previous: StoredLevelProfile | null | undefined },
): LevelDecision {
  const prev = opts.previous;
  if (opts.force && opts.sameAttempt && prev && prev.estimated_level
      && storedLevelVersion(prev) !== LEVEL_ALGORITHM_VERSION) {
    return { level: prev.estimated_level, confidence: prev.level_confidence ?? null, keptStored: true, stampVersion: null };
  }
  return { level: computed.level, confidence: computed.confidence, keptStored: false, stampVersion: computed.version };
}

export interface ProfileModelText {
  summary: string;
  recommendations: string[];
  writing_quality: string;
  key_observations: string[];
  per_question_scores: Record<string, unknown>;
}

export interface ProfileModelOutput {
  /** Validated texts, or null when the output does not match the schema. */
  profile: ProfileModelText | null;
  /** The per_question_scores object when it is a plain object (values are validated by acceptAiScores), else {}. */
  scores: Record<string, unknown>;
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Schema check of the model reply: summary (non-empty string), recommendations and
 * key_observations (arrays of strings, optional), writing_quality (string, optional),
 * per_question_scores (object, optional). Anything else gives `profile: null`, so the
 * caller keeps its deterministic text instead of storing garbage.
 */
export function parseProfileModelOutput(content: unknown): ProfileModelOutput {
  const empty: ProfileModelOutput = { profile: null, scores: {} };
  if (typeof content !== 'string') return empty;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return empty;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return empty;
  }
  if (!isPlainObject(parsed)) return empty;
  const scores = isPlainObject(parsed.per_question_scores) ? parsed.per_question_scores : {};
  const summary = parsed.summary;
  const recommendations = parsed.recommendations;
  const keyObservations = parsed.key_observations;
  const writingQuality = parsed.writing_quality;
  if (typeof summary !== 'string' || summary.trim() === '') return { profile: null, scores };
  if (recommendations !== undefined && !isStringArray(recommendations)) return { profile: null, scores };
  if (keyObservations !== undefined && !isStringArray(keyObservations)) return { profile: null, scores };
  if (writingQuality !== undefined && typeof writingQuality !== 'string') return { profile: null, scores };
  if (parsed.per_question_scores !== undefined && !isPlainObject(parsed.per_question_scores)) return { profile: null, scores };
  return {
    profile: {
      summary,
      recommendations: (recommendations as string[] | undefined) ?? [],
      writing_quality: (writingQuality as string | undefined) ?? 'unknown',
      key_observations: (keyObservations as string[] | undefined) ?? [],
      per_question_scores: scores,
    },
    scores,
  };
}
