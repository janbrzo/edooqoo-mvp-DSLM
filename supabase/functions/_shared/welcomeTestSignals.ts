/**
 * Welcome Test signals computed in code (not by the model). Pure (no Deno APIs).
 *
 * - answerBehaviour: coverage, skips, "I don't know", time per skill item.
 * - computeDivergences: "declared vs measured" pairs. They are stored on the
 *   profile and sent to the model only to be explained, so they are
 *   reproducible and exist even when the AI step fails.
 */

export const SKILL_ELEMENT_TYPES = new Set(['grammar', 'vocabulary', 'reading', 'listening']);
export const IDK_ANSWER = '__IDK__';
/** An answered skill item faster than this is counted as rushed. */
export const RUSHED_SECONDS = 3;

export interface AnswerBehaviour {
  keyed_total: number;
  keyed_answered: number;
  skip_count_skill: number;
  idk_count_skill: number;
  coverage: number | null;
  median_seconds_keyed: number | null;
  rushed_count: number;
}

export interface QuestionRowLite {
  element_type?: string | null;
  student_answer?: unknown;
  time_spent_seconds?: number | null;
  is_correct?: boolean | null;
}

const isUnanswered = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export function answerBehaviour(rows: ReadonlyArray<QuestionRowLite>): AnswerBehaviour {
  const keyed = (rows || []).filter((r) => SKILL_ELEMENT_TYPES.has(String(r?.element_type ?? '')));
  const answered = keyed.filter((r) => !isUnanswered(r.student_answer));
  const idk = answered.filter((r) => r.student_answer === IDK_ANSWER);
  const real = answered.filter((r) => r.student_answer !== IDK_ANSWER);
  const times = real
    .map((r) => Number(r.time_spent_seconds))
    .filter((t) => Number.isFinite(t) && t > 0)
    .sort((a, b) => a - b);
  const median = times.length === 0
    ? null
    : times.length % 2 === 1
      ? times[(times.length - 1) / 2]
      : (times[times.length / 2 - 1] + times[times.length / 2]) / 2;
  return {
    keyed_total: keyed.length,
    keyed_answered: answered.length,
    skip_count_skill: keyed.length - answered.length,
    idk_count_skill: idk.length,
    coverage: keyed.length > 0 ? Math.round((answered.length / keyed.length) * 100) / 100 : null,
    median_seconds_keyed: median === null ? null : Math.round(median * 10) / 10,
    rushed_count: times.filter((t) => t < RUSHED_SECONDS).length,
  };
}

export type DivergenceSeverity = 'info' | 'notable' | 'strong';

export interface Divergence {
  pair: string;
  declared: string;
  observed: string;
  gap: number | null;
  severity: DivergenceSeverity;
}

export interface DivergenceInput {
  traits: Record<string, string>;
  estimatedLevel: string | null;
  selfAssessedLevel: string | null;
  /** q44 matrix, 1-5 per situation label. */
  confidenceMatrix?: Record<string, unknown> | null;
  readingScore?: number | null;
  writingScore?: number | null;
  speakingScore?: number | null;
  selfAwarenessScore?: number | null;
  /** Skill items answered wrong or with "I don't know". */
  skillWrongOrIdk?: number;
  behaviour?: AnswerBehaviour | null;
}

export const LEVEL_NUMBER: Record<string, number> = {
  'A1': 1, 'A1-A2': 1.5, 'A2': 2, 'A2-B1': 2.5, 'B1': 3, 'B1-B2': 3.5, 'B2': 4, 'B2-C1': 4.5, 'C1': 5, 'C1-C2': 5.5, 'C2': 6,
};

const WEEKLY_TIME_ORDINAL: Record<string, number> = { none: 0, '15_30_min': 1, '1_hour': 2, '2_3_hours': 3, '3_plus_hours': 4 };
const LOW_COMMITMENT = new Set(['avoidant', 'low']);
const HIGH_COMMITMENT = new Set(['high', 'proactive']);

const LATENT_TO_MOTIVATION: Record<string, string> = {
  career_critical: 'instrumental',
  lifestyle: 'integrative',
  travel_lifestyle: 'integrative',
};

const label = (v: string | undefined | null): string => (v ? v.replace(/_/g, ' ') : 'unknown');

const CONFIDENCE_PAIRS: Array<{ pair: string; situation: string; skill: 'readingScore' | 'writingScore' | 'speakingScore' }> = [
  { pair: 'confidence_reading', situation: 'Reading news articles', skill: 'readingScore' },
  { pair: 'confidence_writing', situation: 'Writing formal emails', skill: 'writingScore' },
  { pair: 'confidence_speaking', situation: 'Speaking with strangers', skill: 'speakingScore' },
];

/** Only the pairs where the declared side and the measured side disagree. */
export function computeDivergences(input: DivergenceInput): Divergence[] {
  const out: Divergence[] = [];
  const t = input.traits || {};

  // 1. Self-assessed vs measured CEFR level.
  const est = input.estimatedLevel ? LEVEL_NUMBER[input.estimatedLevel] : undefined;
  const self = input.selfAssessedLevel ? LEVEL_NUMBER[input.selfAssessedLevel] : undefined;
  if (est !== undefined && self !== undefined) {
    const gap = self - est;
    if (Math.abs(gap) >= 1) {
      out.push({
        pair: 'level',
        declared: `self-assessed ${input.selfAssessedLevel}`,
        observed: `measured ${input.estimatedLevel}`,
        gap,
        severity: Math.abs(gap) >= 2 ? 'strong' : 'notable',
      });
    }
  }

  // 2. Direct motivation (q3) vs the latent-goal scenario (q3c).
  const latent = t.latent_goal ? LATENT_TO_MOTIVATION[t.latent_goal] : undefined;
  if (t.motivation_type && latent && t.motivation_type !== latent) {
    out.push({
      pair: 'motivation',
      declared: `${label(t.motivation_type)} motivation`,
      observed: `latent goal: ${label(t.latent_goal)}`,
      gap: null,
      severity: 'notable',
    });
  }

  // 3. Declared weekly time (q5) vs the homework scenario (q5c).
  const time = t.weekly_study_time !== undefined ? WEEKLY_TIME_ORDINAL[t.weekly_study_time] : undefined;
  if (time !== undefined && t.homework_commitment) {
    if (time >= 2 && LOW_COMMITMENT.has(t.homework_commitment)) {
      out.push({
        pair: 'capacity',
        declared: `study time: ${label(t.weekly_study_time)}`,
        observed: `homework under low motivation: ${label(t.homework_commitment)}`,
        gap: null,
        severity: 'notable',
      });
    } else if (time === 0 && HIGH_COMMITMENT.has(t.homework_commitment)) {
      out.push({
        pair: 'capacity',
        declared: 'study time: almost none',
        observed: `homework under low motivation: ${label(t.homework_commitment)}`,
        gap: null,
        severity: 'info',
      });
    }
  }

  // 4. Confidence matrix (1-5) vs measured skill score (0-100).
  const matrix = input.confidenceMatrix || {};
  for (const p of CONFIDENCE_PAIRS) {
    const raw = matrix[p.situation];
    const score = input[p.skill];
    if (typeof raw !== 'number' || typeof score !== 'number') continue;
    const declared = (raw - 1) * 25;
    const gap = declared - score;
    if (Math.abs(gap) > 30) {
      out.push({
        pair: p.pair,
        declared: `confidence ${raw}/5`,
        observed: `score ${score}%`,
        gap,
        severity: Math.abs(gap) > 50 ? 'strong' : 'notable',
      });
    }
  }

  // 5. Declared anxiety (q7) vs behaviour in the scenarios (q14, q5b).
  const avoidsInScenarios = t.error_attitude === 'avoidant' || t.deadline_response === 'avoidance';
  if (t.anxiety_level === 'low' && avoidsInScenarios) {
    out.push({
      pair: 'anxiety',
      declared: 'low anxiety',
      observed: t.deadline_response === 'avoidance' ? 'avoids an urgent English task' : 'avoids speaking when unsure',
      gap: null,
      severity: 'notable',
    });
  } else if (t.anxiety_level === 'high' && t.error_attitude === 'comfortable' && t.deadline_response === 'confident') {
    out.push({
      pair: 'anxiety',
      declared: 'high anxiety',
      observed: 'copes confidently in the scenarios',
      gap: null,
      severity: 'info',
    });
  }

  // 6. Metacognition: guessing instead of "I don't know", skipping skill items.
  const wrongOrIdk = input.skillWrongOrIdk ?? 0;
  if (typeof input.selfAwarenessScore === 'number' && wrongOrIdk >= 3 && input.selfAwarenessScore < 20) {
    out.push({
      pair: 'metacognition',
      declared: `"I don't know" used on ${input.selfAwarenessScore}% of uncertain items`,
      observed: `${wrongOrIdk} skill items wrong or unknown`,
      gap: null,
      severity: 'notable',
    });
  }
  const b = input.behaviour;
  if (b && b.keyed_total > 0 && b.coverage !== null && b.coverage < 0.8) {
    out.push({
      pair: 'metacognition',
      declared: `skipped ${b.skip_count_skill} of ${b.keyed_total} skill items`,
      observed: `${b.idk_count_skill} answered "I don't know"`,
      gap: null,
      severity: b.coverage < 0.5 ? 'strong' : 'notable',
    });
  }

  return out;
}

/** Plain lines for the model prompt; the model explains these, it does not compute them. */
export function divergencePromptLines(divergences: ReadonlyArray<Divergence>): string {
  if (divergences.length === 0) return '- No declared-vs-measured divergences were found.';
  return divergences
    .map((d) => `- [${d.severity}] ${d.pair}: declared ${d.declared}; observed ${d.observed}`)
    .join('\n');
}
