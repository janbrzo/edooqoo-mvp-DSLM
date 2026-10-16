import { describe, it, expect } from 'vitest';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';
import { toCanonicalId } from '@/utils/welcomeTestNumbering';
import { welcomeTestRatingFor } from '@/lib/welcomeTest/keyedAnswer';
import type { WelcomeTestQuestionDef } from '@/types/welcomeTest';
import {
  buildAnswerEvent,
  buildReconcileEvents,
  buildSkipEvent,
  canonicalIdForIndex,
  toEventQuestion,
} from '../../../../supabase/functions/_shared/welcomeTestEventPayload';
import { WELCOME_TEST_EVENT_QUESTIONS } from '../../../../supabase/functions/_shared/welcomeTestQuestionMeta';

const json = (v: unknown) => JSON.parse(JSON.stringify(v));

/** Frozen copy of the payload the browser built inline before the shared builder existed. */
function legacyClientPayload(q: WelcomeTestQuestionDef, index: number, answer: unknown, isCorrect: boolean | null, timeSpent: number, isIdk: boolean) {
  const nanoSkillRatings = q.nano_skill ? [{
    name: q.nano_skill,
    reason: q.scoring_logic || q.description || '',
    ...welcomeTestRatingFor(isCorrect),
    question_index: 0,
  }] : [];
  const canonicalId = toCanonicalId(q.id);
  let detectedTraitData: Record<string, string> | undefined;
  if (q.detected_trait) {
    if (Array.isArray(answer)) {
      const traitValues = (answer as string[]).map(a => {
        const idx = q.options?.indexOf(a);
        if (idx !== undefined && idx >= 0) return q.detected_trait!.mapping[String(idx)];
        return null;
      }).filter(Boolean);
      if (traitValues.length > 0) detectedTraitData = { [q.detected_trait.trait_name]: traitValues.join(', ') };
    } else if (typeof answer === 'string') {
      const optionIndex = q.options?.indexOf(answer);
      if (optionIndex !== undefined && optionIndex >= 0) {
        const traitValue = q.detected_trait.mapping[String(optionIndex)];
        if (traitValue) detectedTraitData = { [q.detected_trait.trait_name]: traitValue };
      }
    }
  }
  const FALLBACK: Record<string, string> = {
    wt_q2: 'main_frustrations', wt_q3b: 'usage_context', wt_q6: 'preferred_activities', wt_q9: 'learning_duration',
    wt_q10: 'learning_background', wt_q11: 'exam_experience', wt_q12: 'learning_goal', wt_q13: 'desired_topics',
    wt_q41: 'learning_priorities', wt_q43: 'interest_topics', wt_q45: 'final_message',
  };
  if (!detectedTraitData && !q.correct_answer && !q.nano_skill) {
    if (q.question_type === 'self_assessment_matrix' && typeof answer === 'object') {
      detectedTraitData = { confidence_matrix: JSON.stringify(answer) };
    } else if (q.question_type === 'preference_choice' && Array.isArray(answer)) {
      detectedTraitData = { [FALLBACK[q.id] || 'selected_preferences']: (answer as string[]).join('; ') };
    } else if (answer !== undefined && answer !== null && answer !== '__IDK__') {
      detectedTraitData = { [FALLBACK[q.id] || 'answer_value']: typeof answer === 'string' ? answer : JSON.stringify(answer) };
    }
  }
  return {
    p_answer_id: canonicalId,
    p_legacy_answer_id: q.id,
    p_element_type: q.element_type || q.question_type || null,
    p_event_payload: {
      answer_id: canonicalId,
      legacy_answer_id: q.id,
      exercise_type: q.question_type,
      exercise_index: index,
      is_correct: isCorrect,
      is_idk: isIdk ? true : undefined,
      nano_skill_ratings: nanoSkillRatings,
      detected_traits: detectedTraitData,
      time_spent_seconds: timeSpent,
    },
    p_skill_ids: q.nano_skill ? [q.nano_skill] : [],
  };
}

function sampleAnswers(q: WelcomeTestQuestionDef): unknown[] {
  const out: unknown[] = ['some typed answer', '__IDK__'];
  if (q.options?.length) {
    out.push(q.options[0], q.options[q.options.length - 1], [q.options[0], q.options[1] ?? q.options[0]], ['not an option']);
  }
  if (q.question_type === 'self_assessment_matrix') out.push({ 'Speaking with strangers': 2, 'Reading news articles': 4 });
  return out;
}

describe('Welcome Test event payload builder', () => {
  it('server question meta equals the question bank (regenerate with scripts/welcomeTest/generate-question-meta.ts)', () => {
    expect(json(WELCOME_TEST_EVENT_QUESTIONS)).toEqual(json(ALL_WELCOME_TEST_QUESTIONS.map(toEventQuestion)));
  });

  it('canonical ids match toCanonicalId for every question', () => {
    ALL_WELCOME_TEST_QUESTIONS.forEach((q, i) => expect(canonicalIdForIndex(i)).toBe(toCanonicalId(q.id)));
  });

  it('answer events equal the payload the browser built before (all questions, all answer shapes, JSON-wise)', () => {
    let checked = 0;
    ALL_WELCOME_TEST_QUESTIONS.forEach((q, i) => {
      for (const answer of sampleAnswers(q)) {
        for (const isCorrect of [true, false, null] as const) {
          const isIdk = answer === '__IDK__';
          const want = legacyClientPayload(q, i, answer, isCorrect, 7, isIdk);
          const got = buildAnswerEvent(toEventQuestion(q), { questionIndex: i, answer, isCorrect, timeSpentSeconds: 7, isIdk });
          expect(json({
            p_answer_id: got.answer_id, p_legacy_answer_id: got.legacy_answer_id, p_element_type: got.element_type,
            p_event_payload: got.event_payload, p_skill_ids: got.skill_ids,
          })).toEqual(json(want));
          checked++;
        }
      }
    });
    expect(checked).toBeGreaterThan(300);
  });

  it('client builder and server builder (from meta) give identical events', () => {
    ALL_WELCOME_TEST_QUESTIONS.forEach((q, i) => {
      for (const answer of sampleAnswers(q)) {
        const args = { questionIndex: i, answer, isCorrect: q.correct_answer ? true : null, timeSpentSeconds: 3, isIdk: answer === '__IDK__' };
        expect(json(buildAnswerEvent(WELCOME_TEST_EVENT_QUESTIONS[i], args))).toEqual(json(buildAnswerEvent(toEventQuestion(q), args)));
      }
      expect(json(buildSkipEvent(WELCOME_TEST_EVENT_QUESTIONS[i], i))).toEqual(json(buildSkipEvent(toEventQuestion(q), i)));
    });
  });

  it('skip event keeps the shape the browser sent', () => {
    const q = ALL_WELCOME_TEST_QUESTIONS[2];
    expect(buildSkipEvent(toEventQuestion(q), 2).event_payload).toEqual({
      answer_id: 'wt_q03', legacy_answer_id: q.id, exercise_type: q.question_type, exercise_index: 2, is_skipped: true,
    });
  });
});

describe('reconcile events from stored rows', () => {
  const keyedIdx = ALL_WELCOME_TEST_QUESTIONS.findIndex((q) => q.correct_answer && q.nano_skill && q.question_type !== 'fill_blank');
  const openIdx = ALL_WELCOME_TEST_QUESTIONS.findIndex((q) => q.nano_skill && !q.correct_answer);
  const profIdx = ALL_WELCOME_TEST_QUESTIONS.findIndex((q) => q.detected_trait);

  it('rebuilds a keyed answer exactly as the browser logged it', () => {
    const q = ALL_WELCOME_TEST_QUESTIONS[keyedIdx];
    const answer = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer;
    const [ev] = buildReconcileEvents([{ question_index: keyedIdx, student_answer: answer, is_correct: true, time_spent_seconds: 12, answered_at: '2026-10-06T10:00:00Z' }], WELCOME_TEST_EVENT_QUESTIONS);
    const want = buildAnswerEvent(toEventQuestion(q), { questionIndex: keyedIdx, answer, isCorrect: true, timeSpentSeconds: 12 });
    expect(json(ev.event_payload)).toEqual(json(want.event_payload));
    expect(ev.answered_at).toBe('2026-10-06T10:00:00Z');
  });

  it('open items are unscored in the event unless an AI score is stored', () => {
    const rows = (qd: unknown) => [{ question_index: openIdx, student_answer: 'My answer', is_correct: true, time_spent_seconds: 5, question_data: qd as any }];
    const [plain] = buildReconcileEvents(rows({}), WELCOME_TEST_EVENT_QUESTIONS);
    expect(plain.event_payload.is_correct).toBeNull();
    expect((plain.event_payload.nano_skill_ratings as any)[0]).toMatchObject({ mastery: -1, hasValue: false });
    const [scored] = buildReconcileEvents(rows({ ai_score: 0 }), WELCOME_TEST_EVENT_QUESTIONS);
    expect((scored.event_payload.nano_skill_ratings as any)[0]).toMatchObject({ mastery: 0, hasValue: true });
  });

  it('skips rows whose stored question_type differs from the bank at that index', () => {
    const type = WELCOME_TEST_EVENT_QUESTIONS[keyedIdx].question_type;
    const row = { question_index: keyedIdx, student_answer: 'x', is_correct: true };
    expect(buildReconcileEvents([{ ...row, question_type: type }], WELCOME_TEST_EVENT_QUESTIONS)).toHaveLength(1);
    expect(buildReconcileEvents([{ ...row, question_type: `${type}_other` }], WELCOME_TEST_EVENT_QUESTIONS)).toHaveLength(0);
    expect(buildReconcileEvents([row], WELCOME_TEST_EVENT_QUESTIONS)).toHaveLength(1);
  });

  it('IDK, profiling traits, unanswered and out-of-range rows', () => {
    const idk = buildReconcileEvents([{ question_index: keyedIdx, student_answer: '__IDK__', is_correct: false }], WELCOME_TEST_EVENT_QUESTIONS);
    expect(idk[0].event_payload.is_idk).toBe(true);
    const q = ALL_WELCOME_TEST_QUESTIONS[profIdx];
    const prof = buildReconcileEvents([{ question_index: profIdx, student_answer: q.options![0] }], WELCOME_TEST_EVENT_QUESTIONS);
    expect(prof[0].event_payload.detected_traits).toEqual({ [q.detected_trait!.trait_name]: q.detected_trait!.mapping['0'] });
    expect(buildReconcileEvents([
      { question_index: 0, student_answer: null }, { question_index: 999, student_answer: 'x' }, { question_index: null, student_answer: 'x' },
    ], WELCOME_TEST_EVENT_QUESTIONS)).toEqual([]);
  });
});
