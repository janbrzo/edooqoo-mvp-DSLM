// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const rpc = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

import { useFlashcardLearning } from '../useFlashcardLearning';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (id: string, over: Record<string, unknown> = {}) => ({
  card_id: id, card_position: 0, front_text: `f-${id}`, back_text: `b-${id}`, front_example: null,
  cefr_level: null, back_type: 'translation', is_bidirectional: false,
  d1_easiness_factor: 2.5, d1_repetition: 0, d1_interval_days: 0, d1_next_review_date: null,
  d1_total_reviews: 0, d1_correct_count: 0, d1_incorrect_count: 0,
  d2_easiness_factor: 2.5, d2_repetition: 0, d2_interval_days: 0, d2_next_review_date: null,
  d2_total_reviews: 0, d2_correct_count: 0, d2_incorrect_count: 0,
  ...over,
});

const saved = (counted: boolean) => ({
  data: [{
    counted, easiness_factor: 2.5, repetition: 1, interval_days: 1,
    next_review_date: '2099-01-01T00:00:00Z', total_reviews: 1, correct_count: 1, incorrect_count: 0,
  }],
  error: null,
});

let api: ReturnType<typeof useFlashcardLearning>;
function Harness({ email }: { email: string }) {
  api = useFlashcardLearning('tok-1', email);
  return null;
}

let container: HTMLDivElement;
let root: Root;

async function mountAndLoad(rows: unknown[], email = '  Anna@Example.com ') {
  rpc.mockImplementation(async (fn: string) =>
    fn === 'get_flashcard_learning_cards_by_token' ? { data: rows, error: null } : { data: null, error: { message: 'unexpected' } });
  act(() => { root.render(<Harness email={email} />); });
  await act(async () => { await api.loadSession('all'); });
}

beforeEach(() => {
  rpc.mockReset();
  toast.mockReset();
  container = document.createElement('div');
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); });

const saveCalls = () => rpc.mock.calls.filter((c) => c[0] === 'save_flashcard_review_by_token');

describe('useFlashcardLearning', () => {
  it('loads through the token RPC with a normalised e-mail and no bidirectional lookup', async () => {
    await mountAndLoad([row('a'), row('b', { is_bidirectional: true })]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('get_flashcard_learning_cards_by_token', { p_share_token: 'tok-1', p_email: 'anna@example.com' });
    expect(api.cards).toHaveLength(3);
    expect(api.loaded).toBe(true);
    expect(api.isSessionComplete).toBe(false);
  });

  it('saves the entry picked by entryKey (not card_id) and never sends SRS numbers', async () => {
    await mountAndLoad([row('a', { is_bidirectional: true })]);
    rpc.mockImplementationOnce(async () => saved(true));
    let ok = false;
    await act(async () => { ok = await api.submitReview('a:2', 2); });
    expect(ok).toBe(true);
    const [fn, args] = saveCalls()[0];
    expect(fn).toBe('save_flashcard_review_by_token');
    expect(args).toMatchObject({ p_share_token: 'tok-1', p_email: 'anna@example.com', p_card_id: 'a', p_direction: 2, p_quality: 2 });
    expect(Object.keys(args).sort()).toEqual(
      ['p_card_id', 'p_direction', 'p_email', 'p_quality', 'p_response_time_ms', 'p_share_token']);
    expect(Number.isInteger(args.p_response_time_ms)).toBe(true);
    expect(api.cards.find((c) => c.entryKey === 'a:2')?.total_reviews).toBe(1);
    expect(api.cards.find((c) => c.entryKey === 'a:1')?.total_reviews).toBe(0);
  });

  it('ignores a second submit while one is in flight', async () => {
    await mountAndLoad([row('a'), row('b')]);
    let release!: (v: unknown) => void;
    rpc.mockImplementationOnce(() => new Promise((res) => { release = res; }));
    let first!: Promise<boolean>;
    let second = true;
    await act(async () => {
      first = api.submitReview(api.cards[0].entryKey, 2);
      second = await api.submitReview(api.cards[0].entryKey, 0);
    });
    expect(second).toBe(false);
    expect(api.isSaving).toBe(true);
    await act(async () => { release(saved(true)); await first; });
    expect(saveCalls()).toHaveLength(1);
    expect(api.currentIndex).toBe(1);
    expect(api.isSaving).toBe(false);
  });

  it('keeps the index, stats and shows an error when the save fails, then allows a retry', async () => {
    await mountAndLoad([row('a'), row('b')]);
    const key = api.cards[0].entryKey;
    rpc.mockImplementationOnce(async () => ({ data: null, error: { message: 'boom' } }));
    let ok = true;
    await act(async () => { ok = await api.submitReview(key, 2); });
    expect(ok).toBe(false);
    expect(api.currentIndex).toBe(0);
    expect(api.sessionStats.reviewedCards).toBe(0);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(api.isSaving).toBe(false);

    rpc.mockImplementationOnce(async () => saved(true));
    await act(async () => { ok = await api.submitReview(key, 2); });
    expect(ok).toBe(true);
    expect(api.currentIndex).toBe(1);
  });

  it('counts a not-counted result as practice, not as a scheduled review', async () => {
    await mountAndLoad([row('a')]);
    rpc.mockImplementationOnce(async () => saved(false));
    await act(async () => { await api.submitReview('a:1', 2); });
    expect(api.sessionStats).toMatchObject({ reviewedCards: 1, scheduledReviews: 0, practiceReviews: 1, correctAnswers: 1 });
    expect(api.isSessionComplete).toBe(true);
  });

  it('counts a counted result as a scheduled review', async () => {
    await mountAndLoad([row('a')]);
    rpc.mockImplementationOnce(async () => saved(true));
    await act(async () => { await api.submitReview('a:1', 0); });
    expect(api.sessionStats).toMatchObject({ reviewedCards: 1, scheduledReviews: 1, practiceReviews: 0, incorrectAnswers: 1 });
  });

  it('ignores an unknown entryKey', async () => {
    await mountAndLoad([row('a')]);
    let ok = true;
    await act(async () => { ok = await api.submitReview('zzz:1', 2); });
    expect(ok).toBe(false);
    expect(saveCalls()).toHaveLength(0);
  });

  it('reports an empty set and a load error distinctly from completion', async () => {
    await mountAndLoad([]);
    expect(api.isEmptySet).toBe(true);

    rpc.mockImplementationOnce(async () => ({ data: null, error: { message: 'invalid_access' } }));
    await act(async () => { await api.loadSession('due'); });
    expect(api.loadError).toBe(true);
  });

  it('exposes the next due date when nothing is due', async () => {
    await mountAndLoad([row('a', { d1_total_reviews: 2, d1_next_review_date: '2099-01-01T00:00:00Z' })]);
    await act(async () => { await api.loadSession('due'); });
    expect(api.cards).toHaveLength(0);
    expect(api.isSessionComplete).toBe(true);
    expect(api.nextDueAt).toBe('2099-01-01T00:00:00Z');
  });

  it('does not call the RPC without a token-scoped e-mail', async () => {
    await mountAndLoad([row('a')], '   ');
    expect(rpc).not.toHaveBeenCalled();
    expect(api.loaded).toBe(false);
  });
});
