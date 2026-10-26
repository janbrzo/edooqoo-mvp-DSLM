import { describe, expect, it, vi } from 'vitest';
import { fetchThumbVotes, saveThumbVote, type ThumbClient } from '../aiThumbs';

const key = { teacherId: 't', worksheetId: 'w', exerciseIndex: 1, questionIndex: 2 };

function client(existing: Array<{ id: string }>, writeError: { message: string } | null = null) {
  const calls: Array<[string, unknown]> = [];
  const chain: any = {
    select: () => chain, match: () => chain,
    limit: () => Promise.resolve({ data: existing, error: null }),
    update: (row: unknown) => { calls.push(['update', row]); return { eq: () => Promise.resolve({ error: writeError }) }; },
    insert: (row: unknown) => { calls.push(['insert', row]); return Promise.resolve({ error: writeError }); },
  };
  return { c: { from: () => chain } as ThumbClient, calls };
}

describe('saveThumbVote', () => {
  it('inserts the first vote', async () => {
    const { c, calls } = client([]);
    expect(await saveThumbVote(key, { thumbsUp: true, exerciseType: 'discussion', qualityScore: 0.8 }, c)).toBeNull();
    expect(calls[0][0]).toBe('insert');
    expect(calls[0][1]).toMatchObject({ teacher_id: 't', worksheet_id: 'w', exercise_index: 1, question_index: 2, thumbs_up: true });
  });
  it('updates an existing vote and leaves feedback_text alone', async () => {
    const { c, calls } = client([{ id: 'r1' }]);
    await saveThumbVote(key, { thumbsUp: false, exerciseType: 'discussion', qualityScore: null }, c);
    expect(calls[0][0]).toBe('update');
    expect('feedback_text' in (calls[0][1] as object)).toBe(false);
  });
  it('returns the error message', async () => {
    const { c } = client([], { message: 'rls' });
    expect(await saveThumbVote(key, { thumbsUp: true, exerciseType: 'x', qualityScore: 1 }, c)).toBe('rls');
  });
});

describe('fetchThumbVotes', () => {
  it('maps question to the latest vote and swallows errors', async () => {
    const q: any = { select: () => q, eq: () => q, order: () => Promise.resolve({ data: [
      { question_index: 0, thumbs_up: true }, { question_index: 0, thumbs_up: false }, { question_index: 3, thumbs_up: true },
    ], error: null }) };
    expect(await fetchThumbVotes({ teacherId: 't', worksheetId: 'w', exerciseIndex: 0 }, { from: () => q })).toEqual({ 0: false, 3: true });
    expect(await fetchThumbVotes({ teacherId: 't', worksheetId: 'w', exerciseIndex: 0 }, { from: () => { throw new Error('x'); } })).toEqual({});
  });
});
