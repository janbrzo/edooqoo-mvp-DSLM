import type { LearningCard, LearningQueueMode, LearningRpcRow } from '@/types/flashcards';
import { DEFAULT_EASINESS } from './reviewState';

export interface BuildQueueOptions {
  mode: LearningQueueMode;
  now: Date;
  rng?: () => number;
}

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};

export const entryKeyOf = (cardId: string, direction: 1 | 2): string => `${cardId}:${direction}`;

/** Fisher-Yates; rng injectable for deterministic tests. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function isDueAt(nextReviewDate: string | null, now: Date): boolean {
  if (!nextReviewDate) return true;
  const t = new Date(nextReviewDate).getTime();
  return Number.isNaN(t) || t <= now.getTime();
}

export function isMistake(entry: Pick<LearningCard, 'incorrect_count' | 'correct_count' | 'easiness_factor'>): boolean {
  return entry.incorrect_count > entry.correct_count || entry.easiness_factor < 2.0;
}

function entryFor(row: LearningRpcRow, direction: 1 | 2, now: Date): LearningCard {
  const p = direction === 1 ? 'd1_' : 'd2_';
  const r = row as unknown as Record<string, unknown>;
  const totalReviews = num(r[`${p}total_reviews`], 0);
  const next = (r[`${p}next_review_date`] as string | null | undefined) ?? null;
  return {
    entryKey: entryKeyOf(row.card_id, direction),
    card_id: row.card_id,
    front_text: row.front_text,
    front_example: row.front_example ?? null,
    back_text: row.back_text,
    back_type: row.back_type === 'definition' ? 'definition' : 'translation',
    card_position: num(row.card_position, 0),
    direction,
    easiness_factor: num(r[`${p}easiness_factor`], DEFAULT_EASINESS),
    repetition: num(r[`${p}repetition`], 0),
    interval_days: num(r[`${p}interval_days`], 0),
    next_review_date: next,
    total_reviews: totalReviews,
    correct_count: num(r[`${p}correct_count`], 0),
    incorrect_count: num(r[`${p}incorrect_count`], 0),
    cefr_level: row.cefr_level ?? null,
    isNew: totalReviews === 0,
    isDue: isDueAt(next, now),
  };
}

/** Every (card, direction) entry in card order, unfiltered and unshuffled. */
export function expandEntries(rows: readonly LearningRpcRow[], now: Date): LearningCard[] {
  const out: LearningCard[] = [];
  for (const row of rows) {
    out.push(entryFor(row, 1, now));
    if (row.is_bidirectional) out.push(entryFor(row, 2, now));
  }
  return out;
}

/** One entry per (card, direction), filtered by mode and shuffled. */
export function buildSessionQueue(rows: readonly LearningRpcRow[], opts: BuildQueueOptions): LearningCard[] {
  const all = expandEntries(rows, opts.now);
  let picked: LearningCard[];
  if (opts.mode === 'due') picked = all.filter((e) => e.isNew || e.isDue);
  else if (opts.mode === 'mistakes') picked = all.filter(isMistake);
  else picked = all;
  return shuffle(picked, opts.rng);
}

/** Earliest scheduled review in the future across all entries, or null when none. */
export function earliestNextReview(entries: readonly LearningCard[], now: Date): string | null {
  let best: { t: number; iso: string } | null = null;
  for (const e of entries) {
    if (!e.next_review_date) continue;
    const t = new Date(e.next_review_date).getTime();
    if (Number.isNaN(t) || t <= now.getTime()) continue;
    if (!best || t < best.t) best = { t, iso: e.next_review_date };
  }
  return best ? best.iso : null;
}
