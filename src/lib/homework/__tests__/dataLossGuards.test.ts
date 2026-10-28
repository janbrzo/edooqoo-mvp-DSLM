import { describe, it, expect } from 'vitest';
import { sanitizeAnswerValue, MAX_ANSWER_CHARS } from '@/lib/answers/sanitizeAnswer';
import { buildHomeworkDelta } from '../deltaSave';
import { buildKeepaliveSaveRequest, KEEPALIVE_BODY_LIMIT } from '../keepaliveSave';

describe('sanitizeAnswerValue', () => {
  it('drops NUL characters and keeps ordinary text', () => {
    expect(sanitizeAnswerValue('ab\u0000c')).toBe('abc');
    expect(sanitizeAnswerValue('plain text')).toBe('plain text');
  });
  it('cuts over-long text and walks arrays and objects', () => {
    expect(sanitizeAnswerValue('x'.repeat(MAX_ANSWER_CHARS + 5))).toHaveLength(MAX_ANSWER_CHARS);
    expect(sanitizeAnswerValue(['a\u0000', { k: 'b\u0000' }])).toEqual(['a', { k: 'b' }]);
    expect(sanitizeAnswerValue(5)).toBe(5);
    expect(sanitizeAnswerValue(null)).toBeNull();
  });
});

describe('homework delta', () => {
  it('never carries a NUL character to the server', () => {
    const delta = buildHomeworkDelta({
      exerciseData: { type: 'reading', questions: [{}] }, exerciseType: 'reading',
      answers: { 0: 'ok\u0000text' }, audio: {}, dirtyKeys: ['0'], dirtyAudio: [],
    });
    expect(delta?.answers['0']).toBe('oktext');
  });
});

describe('keepalive save request', () => {
  it('is a keepalive POST to the RPC with the key and the arguments', () => {
    const req = buildKeepaliveSaveRequest('save_homework_answer_by_share_token', { p_exercise_index: 0 });
    expect(req?.url).toMatch(/\/rest\/v1\/rpc\/save_homework_answer_by_share_token$/);
    expect(req?.init.keepalive).toBe(true);
    expect(req?.init.method).toBe('POST');
    expect(JSON.parse(String(req?.init.body))).toEqual({ p_exercise_index: 0 });
  });
  it('is not sent when the body exceeds the browser keepalive limit', () => {
    expect(buildKeepaliveSaveRequest('x', { p_answers: 'a'.repeat(KEEPALIVE_BODY_LIMIT + 1) })).toBeNull();
  });
});
