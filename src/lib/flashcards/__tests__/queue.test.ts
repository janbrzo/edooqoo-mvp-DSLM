import { describe, it, expect } from 'vitest';
import { buildSessionQueue, earliestNextReview, expandEntries, shuffle } from '../queue';
import type { LearningRpcRow } from '@/types/flashcards';

const NOW = new Date('2026-10-29T12:00:00Z');
const PAST = '2026-10-28T00:00:00Z';
const FUTURE = '2026-11-02T00:00:00Z';

function row(id: string, over: Partial<LearningRpcRow> = {}): LearningRpcRow {
  return {
    card_id: id, card_position: 0, front_text: `f-${id}`, back_text: `b-${id}`, front_example: null,
    cefr_level: 'B1', back_type: 'translation', is_bidirectional: false,
    d1_easiness_factor: 2.5, d1_repetition: 0, d1_interval_days: 0, d1_next_review_date: null,
    d1_total_reviews: 0, d1_correct_count: 0, d1_incorrect_count: 0,
    d2_easiness_factor: 2.5, d2_repetition: 0, d2_interval_days: 0, d2_next_review_date: null,
    d2_total_reviews: 0, d2_correct_count: 0, d2_incorrect_count: 0,
    ...over,
  };
}

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe('buildSessionQueue', () => {
  it('returns nothing for an empty set', () => {
    for (const mode of ['due', 'all', 'mistakes'] as const) {
      expect(buildSessionQueue([], { mode, now: NOW })).toEqual([]);
    }
  });

  it('creates one entry per card for a non-bidirectional set', () => {
    const q = buildSessionQueue([row('a'), row('b')], { mode: 'all', now: NOW });
    expect(q.map((e) => e.entryKey).sort()).toEqual(['a:1', 'b:1']);
  });

  it('creates exactly one entry per direction for a bidirectional set with stable keys', () => {
    const q = buildSessionQueue([row('a', { is_bidirectional: true })], { mode: 'all', now: NOW });
    expect(q.map((e) => e.entryKey).sort()).toEqual(['a:1', 'a:2']);
    expect(new Set(q.map((e) => e.entryKey)).size).toBe(2);
  });

  it('carries the state of each direction independently', () => {
    const r = row('a', {
      is_bidirectional: true,
      d1_total_reviews: 3, d1_repetition: 3, d1_next_review_date: FUTURE, d1_easiness_factor: 2.6,
      d2_total_reviews: 1, d2_next_review_date: PAST, d2_incorrect_count: 1,
    });
    const [e1, e2] = expandEntries([r], NOW);
    expect(e1).toMatchObject({ direction: 1, isNew: false, isDue: false, easiness_factor: 2.6 });
    expect(e2).toMatchObject({ direction: 2, isNew: false, isDue: true, incorrect_count: 1 });
  });

  it('due mode keeps new and due entries only, per direction', () => {
    const r = row('a', {
      is_bidirectional: true,
      d1_total_reviews: 2, d1_next_review_date: FUTURE,
      d2_total_reviews: 0,
    });
    const q = buildSessionQueue([r, row('b', { d1_total_reviews: 1, d1_next_review_date: PAST })], { mode: 'due', now: NOW });
    expect(q.map((e) => e.entryKey).sort()).toEqual(['a:2', 'b:1']);
  });

  it('treats a null next_review_date and a date equal to now as due', () => {
    const r = row('a', { d1_total_reviews: 1, d1_next_review_date: NOW.toISOString() });
    expect(buildSessionQueue([r], { mode: 'due', now: NOW })).toHaveLength(1);
    const n = row('b', { d1_total_reviews: 1, d1_next_review_date: null });
    expect(buildSessionQueue([n], { mode: 'due', now: NOW })).toHaveLength(1);
  });

  it('mistakes mode: incorrect > correct or EF < 2.0, per direction', () => {
    const rows = [
      row('a', { d1_total_reviews: 3, d1_incorrect_count: 2, d1_correct_count: 1, d1_next_review_date: FUTURE }),
      row('b', { d1_total_reviews: 3, d1_easiness_factor: 1.9, d1_correct_count: 3, d1_next_review_date: FUTURE }),
      row('c', { d1_total_reviews: 3, d1_correct_count: 3, d1_next_review_date: FUTURE }),
      row('d'), // new card with defaults is not a mistake
    ];
    const q = buildSessionQueue(rows, { mode: 'mistakes', now: NOW });
    expect(q.map((e) => e.entryKey).sort()).toEqual(['a:1', 'b:1']);
  });

  it('all mode returns every entry regardless of schedule', () => {
    const rows = [row('a', { d1_total_reviews: 2, d1_next_review_date: FUTURE }), row('b')];
    expect(buildSessionQueue(rows, { mode: 'all', now: NOW })).toHaveLength(2);
  });

  it('is deterministic with a seeded rng and a permutation of the input', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`c${i}`));
    const a = buildSessionQueue(rows, { mode: 'all', now: NOW, rng: seeded(7) }).map((e) => e.entryKey);
    const b = buildSessionQueue(rows, { mode: 'all', now: NOW, rng: seeded(7) }).map((e) => e.entryKey);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(rows.map((r) => `${r.card_id}:1`).sort());
    expect(a).not.toEqual(rows.map((r) => `${r.card_id}:1`));
  });

  it('defaults missing back_type to translation and keeps definition', () => {
    const q = buildSessionQueue([row('a', { back_type: null }), row('b', { back_type: 'definition' })], { mode: 'all', now: NOW });
    const byKey = Object.fromEntries(q.map((e) => [e.entryKey, e.back_type]));
    expect(byKey).toEqual({ 'a:1': 'translation', 'b:1': 'definition' });
  });
});

describe('shuffle', () => {
  it('does not mutate its input and keeps all items', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seeded(3));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(input);
  });

  it('produces every permutation of 3 items with a uniform-ish rng sweep (no bias to identity)', () => {
    const seen = new Set<string>();
    const rng = seeded(11);
    for (let i = 0; i < 300; i++) seen.add(shuffle([1, 2, 3], rng).join(''));
    expect(seen.size).toBe(6);
  });
});

describe('earliestNextReview', () => {
  it('returns the earliest future date and ignores past or null', () => {
    const entries = expandEntries([
      row('a', { d1_next_review_date: '2026-11-05T00:00:00Z' }),
      row('b', { d1_next_review_date: '2026-10-30T00:00:00Z' }),
      row('c', { d1_next_review_date: PAST }),
      row('d'),
    ], NOW);
    expect(earliestNextReview(entries, NOW)).toBe('2026-10-30T00:00:00Z');
    expect(earliestNextReview([], NOW)).toBeNull();
  });
});

import { sideLabels } from '../sideLabels';

describe('sideLabels', () => {
  it('labels translation sets with the native language and definition sets with Definition', () => {
    expect(sideLabels({ direction: 1, back_type: 'translation' }, 'Polish')).toEqual({ front: 'English', back: 'Polish' });
    expect(sideLabels({ direction: 2, back_type: 'translation' }, 'Polish')).toEqual({ front: 'Polish', back: 'English' });
    expect(sideLabels({ direction: 1, back_type: 'definition' }, 'Polish')).toEqual({ front: 'English', back: 'Definition' });
    expect(sideLabels({ direction: 2, back_type: 'definition' }, null)).toEqual({ front: 'Definition', back: 'English' });
    expect(sideLabels({ direction: 1, back_type: 'translation' }, null).back).toBe('Translation');
  });
});
