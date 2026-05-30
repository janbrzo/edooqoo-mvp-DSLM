/**
 * Welcome Test — canonical sequential question IDs (wt_q1..wt_qN).
 *
 * Source of truth for analytics-facing IDs stored in
 * `student_events.event_payload.answer_id`. The legacy `id` field on each
 * question definition (e.g. `wt_q3b`, `wt_q5c`, `wt_q13c`) is preserved as
 * `legacy_answer_id` on the same event payload so prior records remain
 * traceable.
 *
 * The map is built at module load from the live question array — this
 * guarantees parity with `welcomeTestQuestions.ts` regardless of how the
 * legacy IDs evolve.
 */
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';

export const QUESTION_CANONICAL_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  ALL_WELCOME_TEST_QUESTIONS.forEach((q, i) => {
    const canonical = `wt_q${i + 1}`;
    map[q.id] = canonical;        // legacy → canonical
    map[canonical] = canonical;   // identity (idempotent)
  });
  return map;
})();

export const toCanonicalId = (legacyOrCanonical: string): string =>
  QUESTION_CANONICAL_MAP[legacyOrCanonical] ?? legacyOrCanonical;

/**
 * Returns the most accurate "total questions" value for a welcome test,
 * defending against drift between `student_tests.total_questions` (snapshot at
 * creation time) and the actual count of seeded `student_test_questions` rows
 * (which grows when the canonical question list is extended).
 */
export const getWelcomeTestTotal = (test: {
  total_questions?: number | null;
  answered_count?: number | null;
}): number => {
  const total = test.total_questions ?? 0;
  const answered = test.answered_count ?? 0;
  return Math.max(total, answered, ALL_WELCOME_TEST_QUESTIONS.length);
};