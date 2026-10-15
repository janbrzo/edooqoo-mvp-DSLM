/**
 * Welcome Test answer events: ONE builder for the client (useWelcomeTest) and
 * the server (reconcile_welcome_test_events), so a reconciled event is
 * byte-for-byte the event the browser would have logged. Pure (no Deno APIs).
 *
 * The question bank lives in src/data/welcomeTestQuestions.ts, which an Edge
 * Function cannot import. `welcomeTestQuestionMeta.ts` holds the fields this
 * builder needs, generated from the bank and parity-tested against it
 * (src/lib/welcomeTest/__tests__/welcomeTestEventPayload.test.ts).
 */

export const WELCOME_TEST_IDK_ANSWER = '__IDK__';

/** The question fields an answer event depends on. */
export interface WelcomeEventQuestion {
  id: string;
  question_type: string;
  element_type: string | null;
  nano_skill: string | null;
  /** scoring_logic || description || '' */
  reason: string;
  /** The question has a correct_answer (keyed item). */
  has_key: boolean;
  /** Only present when detected_trait is. */
  options?: string[];
  detected_trait?: { trait_name: string; mapping: Record<string, string> };
}

/** Structural subset of WelcomeTestQuestionDef (src/types/welcomeTest.ts). */
interface QuestionDefLike {
  id: string;
  question_type: string;
  element_type?: string | null;
  nano_skill?: string | null;
  scoring_logic?: string;
  description?: string;
  correct_answer?: unknown;
  options?: string[];
  detected_trait?: { trait_name: string; mapping: Record<string, string> };
}

export function toEventQuestion(q: QuestionDefLike): WelcomeEventQuestion {
  const out: WelcomeEventQuestion = {
    id: q.id,
    question_type: q.question_type,
    element_type: q.element_type ?? null,
    nano_skill: q.nano_skill ?? null,
    reason: q.scoring_logic || q.description || '',
    has_key: !!q.correct_answer,
  };
  if (q.detected_trait) {
    out.options = q.options ? [...q.options] : [];
    out.detected_trait = { trait_name: q.detected_trait.trait_name, mapping: { ...q.detected_trait.mapping } };
  }
  return out;
}

/** wt_q01..wt_q58 (same as toCanonicalId in src/utils/welcomeTestNumbering.ts). */
export const canonicalIdForIndex = (index: number): string => `wt_q${String(index + 1).padStart(2, '0')}`;

/** Mastery and hasValue written to the nano skill rating (same as welcomeTestRatingFor). */
export const eventRatingFor = (isCorrect: boolean | null): { mastery: number; hasValue: boolean } => ({
  mastery: isCorrect === true ? 100 : isCorrect === false ? 0 : -1,
  hasValue: isCorrect !== null,
});

// Round 8: semantic trait keys instead of a generic 'answer_value'.
const QUESTION_TRAIT_FALLBACK: Record<string, string> = {
  wt_q2: 'main_frustrations',
  wt_q3b: 'usage_context',
  wt_q6: 'preferred_activities',
  wt_q9: 'learning_duration',
  wt_q10: 'learning_background',
  wt_q11: 'exam_experience',
  wt_q12: 'learning_goal',
  wt_q13: 'desired_topics',
  wt_q41: 'learning_priorities',
  wt_q43: 'interest_topics',
  wt_q45: 'final_message',
};

/** Trait detected from an answer (multi-select values are joined with ", "). */
export function detectTraitFromAnswer(q: WelcomeEventQuestion, answer: unknown): Record<string, string> | undefined {
  const dt = q.detected_trait;
  if (!dt) return undefined;
  if (Array.isArray(answer)) {
    const values = (answer as string[])
      .map((a) => {
        const idx = q.options?.indexOf(a);
        return idx !== undefined && idx >= 0 ? dt.mapping[String(idx)] : null;
      })
      .filter(Boolean);
    return values.length > 0 ? { [dt.trait_name]: values.join(', ') } : undefined;
  }
  if (typeof answer === 'string') {
    const idx = q.options?.indexOf(answer);
    if (idx !== undefined && idx >= 0) {
      const value = dt.mapping[String(idx)];
      if (value) return { [dt.trait_name]: value };
    }
  }
  return undefined;
}

export interface WelcomeEventArgs {
  questionIndex: number;
  answer: unknown;
  /** Keyed verdict (true/false) or null when unscored (open or review). */
  isCorrect: boolean | null;
  timeSpentSeconds: number;
  isIdk?: boolean;
  /** Server only: AI score already stored for an open item (0-100). */
  aiScore?: number | null;
}

export interface WelcomeEventDraft {
  answer_id: string;
  legacy_answer_id: string;
  element_type: string | null;
  skill_ids: string[];
  event_payload: Record<string, unknown>;
}

/** The test_answer_submitted event of an answered question. */
export function buildAnswerEvent(q: WelcomeEventQuestion, args: WelcomeEventArgs): WelcomeEventDraft {
  const { questionIndex, answer, isCorrect, timeSpentSeconds } = args;
  const canonical = canonicalIdForIndex(questionIndex);
  const rating = eventRatingFor(isCorrect);
  const hasAi = typeof args.aiScore === 'number' && Number.isFinite(args.aiScore);
  const nanoSkillRatings = q.nano_skill
    ? [{
        name: q.nano_skill,
        reason: q.reason,
        mastery: hasAi ? args.aiScore as number : rating.mastery,
        hasValue: hasAi ? true : rating.hasValue,
        question_index: 0,
      }]
    : [];

  let detected = detectTraitFromAnswer(q, answer);
  // Profiling questions without detected_trait: keep the answer under a semantic key.
  if (!detected && !q.has_key && !q.nano_skill) {
    if (q.question_type === 'self_assessment_matrix' && typeof answer === 'object') {
      detected = { confidence_matrix: JSON.stringify(answer) };
    } else if (q.question_type === 'preference_choice' && Array.isArray(answer)) {
      detected = { [QUESTION_TRAIT_FALLBACK[q.id] || 'selected_preferences']: (answer as string[]).join('; ') };
    } else if (answer !== undefined && answer !== null && answer !== WELCOME_TEST_IDK_ANSWER) {
      detected = { [QUESTION_TRAIT_FALLBACK[q.id] || 'answer_value']: typeof answer === 'string' ? answer : JSON.stringify(answer) };
    }
  }

  const payload: Record<string, unknown> = {
    answer_id: canonical,
    legacy_answer_id: q.id,
    exercise_type: q.question_type,
    exercise_index: questionIndex,
    is_correct: isCorrect,
  };
  if (args.isIdk === true) payload.is_idk = true;
  payload.nano_skill_ratings = nanoSkillRatings;
  if (detected) payload.detected_traits = detected;
  payload.time_spent_seconds = timeSpentSeconds;

  return {
    answer_id: canonical,
    legacy_answer_id: q.id,
    element_type: q.element_type || q.question_type || null,
    skill_ids: q.nano_skill ? [q.nano_skill] : [],
    event_payload: payload,
  };
}

/** The test_answer_skipped event. */
export function buildSkipEvent(q: WelcomeEventQuestion, questionIndex: number): WelcomeEventDraft {
  const canonical = canonicalIdForIndex(questionIndex);
  return {
    answer_id: canonical,
    legacy_answer_id: q.id,
    element_type: q.element_type || q.question_type || null,
    skill_ids: q.nano_skill ? [q.nano_skill] : [],
    event_payload: {
      answer_id: canonical,
      legacy_answer_id: q.id,
      exercise_type: q.question_type,
      exercise_index: questionIndex,
      is_skipped: true,
    },
  };
}

export interface StoredQuestionRow {
  question_index?: number | null;
  question_type?: string | null;
  student_answer?: unknown;
  is_correct?: boolean | null;
  time_spent_seconds?: number | null;
  answered_at?: string | null;
  question_data?: { ai_score?: unknown } | null;
}

export interface ReconcileEvent extends WelcomeEventDraft {
  answered_at: string | null;
}

/**
 * Events for every ANSWERED question row (student_answer present), as the
 * array `reconcile_welcome_test_events(p_test_id, p_events)` takes. Unanswered
 * rows produce nothing (a skip cannot be told from an unseen question).
 *
 * is_correct comes from the stored row only for keyed items (the client sent
 * exactly that value); for open items the client always sent null and the AI
 * pass later writes the score, so a stored ai_score is applied here instead.
 */
export function buildReconcileEvents(
  rows: ReadonlyArray<StoredQuestionRow>,
  meta: ReadonlyArray<WelcomeEventQuestion>,
): ReconcileEvent[] {
  const out: ReconcileEvent[] = [];
  for (const r of rows || []) {
    const idx = r?.question_index;
    if (typeof idx !== 'number' || idx < 0 || idx >= meta.length) continue;
    if (r.student_answer === null || r.student_answer === undefined) continue;
    const q = meta[idx];
    // A row whose stored type differs from the bank at that index is another test layout.
    if (typeof r.question_type === 'string' && r.question_type !== q.question_type) continue;
    const ai = Number(r.question_data?.ai_score);
    const hasAi = !q.has_key && r.question_data?.ai_score !== undefined && r.question_data?.ai_score !== null && Number.isFinite(ai);
    const draft = buildAnswerEvent(q, {
      questionIndex: idx,
      answer: r.student_answer,
      isCorrect: q.has_key && typeof r.is_correct === 'boolean' ? r.is_correct : null,
      timeSpentSeconds: Math.max(0, Math.round(Number(r.time_spent_seconds) || 0)),
      isIdk: r.student_answer === WELCOME_TEST_IDK_ANSWER,
      aiScore: hasAi ? ai : null,
    });
    out.push({ ...draft, answered_at: r.answered_at ?? null });
  }
  return out;
}
