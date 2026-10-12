import { describe, it, expect } from 'vitest';
import { checkWelcomeTestKeyedAnswer, welcomeTestRatingFor, WELCOME_TEST_IDK } from '../keyedAnswer';
import { formatWelcomeTestAnswer } from '../answerDisplay';

const fill = (correct_answer: string | string[]) => ({ question_type: 'fill_blank' as const, correct_answer });
const mc = (correct_answer: string) => ({ question_type: 'multiple_choice' as const, correct_answer });

describe('checkWelcomeTestKeyedAnswer', () => {
  it('returns null when the question has no key', () => {
    expect(checkWelcomeTestKeyedAnswer({ question_type: 'open_ended', correct_answer: undefined }, 'x')).toBeNull();
  });

  it('accepts what the old exact compare accepted', () => {
    expect(checkWelcomeTestKeyedAnswer(fill('goes'), '  Goes ')).toBe(true);
    expect(checkWelcomeTestKeyedAnswer(fill(['have been studying', 'have studied']), 'have studied')).toBe(true);
  });

  it('is more lenient for typed answers (punctuation, contractions)', () => {
    expect(checkWelcomeTestKeyedAnswer(fill('goes'), 'goes.')).toBe(true);
    expect(checkWelcomeTestKeyedAnswer(fill('has been raining'), "has been raining!")).toBe(true);
  });

  it('maps an uncertain typed answer to null, never false', () => {
    expect(checkWelcomeTestKeyedAnswer(fill('decision'), 'decison')).toBeNull();
    expect(checkWelcomeTestKeyedAnswer(fill(['has been working', 'has worked']), 'has workd')).toBeNull();
  });

  it('marks a clearly wrong typed answer as false', () => {
    expect(checkWelcomeTestKeyedAnswer(fill('goes'), 'go')).toBe(false);
    expect(checkWelcomeTestKeyedAnswer(fill('confidently'), 'happy')).toBe(false);
  });

  it('keeps I do not know as wrong (unchanged)', () => {
    expect(checkWelcomeTestKeyedAnswer(fill('goes'), WELCOME_TEST_IDK)).toBe(false);
    expect(checkWelcomeTestKeyedAnswer(mc('took'), WELCOME_TEST_IDK)).toBe(false);
  });

  it('keeps exact comparison for selection items', () => {
    expect(checkWelcomeTestKeyedAnswer(mc('took'), 'Took')).toBe(true);
    // A near option is still wrong: selection items are never fuzzy.
    expect(checkWelcomeTestKeyedAnswer(mc('took'), 'tooks')).toBe(false);
  });
});

describe('welcomeTestRatingFor', () => {
  it('writes no rating value for review', () => {
    expect(welcomeTestRatingFor(null)).toEqual({ mastery: -1, hasValue: false });
    expect(welcomeTestRatingFor(true)).toEqual({ mastery: 100, hasValue: true });
    expect(welcomeTestRatingFor(false)).toEqual({ mastery: 0, hasValue: true });
  });
});

describe('formatWelcomeTestAnswer', () => {
  it('shows the IDK sentinel as plain words', () => {
    expect(formatWelcomeTestAnswer(WELCOME_TEST_IDK)).toBe("I don't know");
    expect(formatWelcomeTestAnswer(['a', WELCOME_TEST_IDK])).toBe("a, I don't know");
  });

  it('formats other answers as before', () => {
    expect(formatWelcomeTestAnswer(true)).toBe('True');
    expect(formatWelcomeTestAnswer(['a', 'b'])).toBe('a, b');
    expect(formatWelcomeTestAnswer({ x: 1 })).toBe('{"x":1}');
    expect(formatWelcomeTestAnswer('goes')).toBe('goes');
  });
});
