import { describe, it, expect } from 'vitest';
import { questionIndexOfKey, questionIndicesOf, hasAnswerForQuestion } from '../answerKeys';

describe('answer keys with per-blank composite keys', () => {
  it('reads the question index from plain and composite keys, ignores metadata keys', () => {
    expect(questionIndexOfKey('3')).toBe(3);
    expect(questionIndexOfKey('3_1')).toBe(3);
    expect(questionIndexOfKey('_transcription_3')).toBeNull();
    expect(questionIndexOfKey('abc')).toBeNull();
  });

  it('counts a multi-blank sentence once, sorted', () => {
    expect(questionIndicesOf({ 2: 'x', '0_0': 'a', '0_1': 'b', _transcription_2: 't' })).toEqual([0, 2]);
    expect(questionIndicesOf(null)).toEqual([]);
  });

  it('finds an answer under the plain key or under any blank', () => {
    expect(hasAnswerForQuestion({ 1: 'x' }, 1)).toBe(true);
    expect(hasAnswerForQuestion({ '1_0': '', '1_1': 'b' }, 1)).toBe(true);
    expect(hasAnswerForQuestion({ '1_0': '', '1_1': '' }, 1)).toBe(false);
    expect(hasAnswerForQuestion({ '10_0': 'x' }, 1)).toBe(false);
    expect(hasAnswerForQuestion(undefined, 1)).toBe(false);
  });
});
