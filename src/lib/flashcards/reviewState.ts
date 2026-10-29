// Pure review-state helpers for flashcard learning. The server (save_flashcard_review_by_token)
// owns the schedule; calculateSM2 documents the shared formula and is kept for parity tests
// against the SQL implementation. The client never sends SRS numbers.

export type SaveQuality = 0 | 2;

export const SM2_MIN_EASINESS = 1.3;
export const DEFAULT_EASINESS = 2.5;
export const MAX_RESPONSE_TIME_MS = 600000;

export interface Sm2Result {
  newRepetition: number;
  newEF: number;
  newInterval: number;
}

export function calculateSM2(
  quality: number,
  repetition: number,
  easinessFactor: number,
  intervalDays: number,
): Sm2Result {
  let newRepetition = repetition;
  let newInterval = intervalDays;

  if (quality < 2) {
    newRepetition = 0;
    newInterval = 1;
  } else {
    if (repetition === 0) newInterval = 1;
    else if (repetition === 1) newInterval = 6;
    else newInterval = Math.round(intervalDays * easinessFactor);
    newRepetition = repetition + 1;
  }

  const raw = easinessFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
  return { newRepetition, newEF: Math.max(SM2_MIN_EASINESS, raw), newInterval };
}

/** Lower-case and trim the learner e-mail; the server normalises the same way. */
export function normalizeLearnerEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/** Whole milliseconds, never negative, capped at the server limit. */
export function clampResponseTimeMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(MAX_RESPONSE_TIME_MS, Math.round(ms));
}

/** Row returned by save_flashcard_review_by_token. */
export interface SaveReviewResult {
  counted: boolean;
  easiness_factor: number;
  repetition: number;
  interval_days: number;
  next_review_date: string | null;
  total_reviews: number;
  correct_count: number;
  incorrect_count: number;
}

export interface ReviewState {
  easiness_factor: number;
  repetition: number;
  interval_days: number;
  next_review_date: string | null;
  total_reviews: number;
  correct_count: number;
  incorrect_count: number;
  isNew: boolean;
}

/** Local state after a save: always the row the server returned. */
export function stateFromSaveResult(result: SaveReviewResult): ReviewState {
  return {
    easiness_factor: result.easiness_factor,
    repetition: result.repetition,
    interval_days: result.interval_days,
    next_review_date: result.next_review_date,
    total_reviews: result.total_reviews,
    correct_count: result.correct_count,
    incorrect_count: result.incorrect_count,
    isNew: result.total_reviews === 0,
  };
}

/** Accepts the first row of a table result (array) or a single object; null when unusable. */
export function parseSaveResult(data: unknown): SaveReviewResult | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    const n = typeof v === 'string' ? Number(v) : (v as number);
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  };
  const ef = num(r.easiness_factor);
  const rep = num(r.repetition);
  const interval = num(r.interval_days);
  const total = num(r.total_reviews);
  const correct = num(r.correct_count);
  const incorrect = num(r.incorrect_count);
  if (typeof r.counted !== 'boolean') return null;
  if (ef === null || rep === null || interval === null || total === null || correct === null || incorrect === null) return null;
  return {
    counted: r.counted,
    easiness_factor: ef,
    repetition: rep,
    interval_days: interval,
    next_review_date: typeof r.next_review_date === 'string' ? r.next_review_date : null,
    total_reviews: total,
    correct_count: correct,
    incorrect_count: incorrect,
  };
}
