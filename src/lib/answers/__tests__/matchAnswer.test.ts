import { describe, it, expect } from 'vitest';
import { matchAnswer, splitAnswerVariants, normalizeAnswerText } from '../matchAnswer';
import { expandContractions } from '../contractions';

const verdict = (a: unknown, b: unknown, opts?: Parameters<typeof matchAnswer>[2]) =>
  matchAnswer(a, b, opts).verdict;

describe('normalizeAnswerText', () => {
  it('unifies typographic apostrophes and quotes', () => {
    expect(normalizeAnswerText('don\u2019t')).toBe("don't");
    expect(normalizeAnswerText('\u201Chello\u201D')).toBe('"hello"');
  });

  it('strips only trailing punctuation', () => {
    expect(normalizeAnswerText('He is late.')).toBe('he is late');
    expect(normalizeAnswerText("It's fine, really!")).toBe("it's fine, really");
  });

  it('collapses whitespace', () => {
    expect(normalizeAnswerText('  he   is    late ')).toBe('he is late');
  });
});

describe('expandContractions', () => {
  it('expands common negations both ways', () => {
    expect(expandContractions("don't")).toBe('do not');
    expect(expandContractions("won't")).toBe('will not');
    expect(expandContractions("can't")).toBe('can not');
    expect(expandContractions("she isn't here")).toBe('she is not here');
  });

  it('is idempotent', () => {
    expect(expandContractions(expandContractions("i'm late"))).toBe('i am late');
  });
});

describe('splitAnswerVariants', () => {
  it('splits on OR', () => {
    expect(splitAnswerVariants('big OR large')).toEqual(['big', 'large']);
  });

  it('splits on spaced slash and semicolon', () => {
    expect(splitAnswerVariants('big / large')).toEqual(['big', 'large']);
    expect(splitAnswerVariants('big; large')).toEqual(['big', 'large']);
  });

  it('splits bare slash only for single-token keys', () => {
    expect(splitAnswerVariants('un/in')).toEqual(['un', 'in']);
    expect(splitAnswerVariants('he went to the shop/store')).toContain('he went to the shop/store');
  });

  it('expands optional parentheses', () => {
    const variants = splitAnswerVariants('he (has) gone');
    expect(variants).toContain('he has gone');
    expect(variants).toContain('he gone');
  });
});

describe('matchAnswer — correct verdicts', () => {
  const cases: Array<[string, string, Parameters<typeof matchAnswer>[2]?]> = [
    ['he is late', 'He is late'],
    ['He is late.', 'he is late'],
    ['  he   is late  ', 'he is late'],
    ["don't", 'do not', { mode: 'word' }],
    ['do not', "don't", { mode: 'word' }],
    ['I\u2019m ready', 'I am ready'],
    ['she will not come', "she won't come"],
    ['large', 'big OR large', { mode: 'word' }],
    ['big', 'big / large', { mode: 'word' }],
    ['in', 'un/in', { mode: 'word' }],
    ['he has gone', 'he (has) gone'],
    ['It is raining', 'it\u2019s raining'],
  ];

  it.each(cases)('accepts "%s" against "%s"', (student, key, opts) => {
    expect(verdict(student, key, opts)).toBe('correct');
  });
});

describe('matchAnswer — sentinel "This sentence is correct"', () => {
  const opts = { sourceSentence: 'She has lived here since 2010.', mode: 'sentence' as const };

  it('accepts repeating the source sentence', () => {
    expect(verdict('She has lived here since 2010.', 'This sentence is correct', opts)).toBe('correct');
  });

  it('accepts a short affirmation', () => {
    expect(verdict('no error', 'This sentence is correct', opts)).toBe('correct');
    expect(verdict('correct', 'No mistake', opts)).toBe('correct');
  });

  it('accepts the literal key text', () => {
    expect(verdict('This sentence is correct', 'This sentence is correct', opts)).toBe('correct');
  });
});

describe('matchAnswer — review verdicts (never red when unsure)', () => {
  it('flags a one-character typo in a word answer', () => {
    expect(verdict('beautifull', 'beautiful', { mode: 'word' })).toBe('review');
  });

  it('flags reordered words in a sentence answer', () => {
    expect(verdict('late he is', 'he is late', { mode: 'sentence' })).toBe('review');
  });

  it('flags a small typo in a sentence answer', () => {
    expect(verdict('She has lived here sinse 2010', 'She has lived here since 2010')).toBe('review');
  });

  it('never marks wrong when the key is missing', () => {
    expect(verdict('anything', '')).toBe('review');
    expect(verdict('anything', null)).toBe('review');
  });
});

describe('matchAnswer — wrong and empty verdicts', () => {
  it('marks a genuinely different answer wrong', () => {
    expect(verdict('the dog ate my homework', 'he is late')).toBe('wrong');
    expect(verdict('cat', 'beautiful', { mode: 'word' })).toBe('wrong');
  });

  it('returns empty for a blank answer', () => {
    expect(verdict('', 'he is late')).toBe('empty');
    expect(verdict('   ', 'he is late')).toBe('empty');
    expect(verdict(undefined, 'he is late')).toBe('empty');
  });
});

describe('regression guard — never stricter than the legacy comparison', () => {
  const legacy = (a: string, b: string) => a.toLowerCase().trim() === b.toLowerCase().trim();

  const pairs: Array<[string, string]> = [
    ['He is late', 'he is late'],
    ['BEAUTIFUL', 'beautiful'],
    ['  go home ', 'go home'],
    ['un', 'UN'],
    ['She does not like it', 'she does not like it'],
  ];

  it.each(pairs)('"%s" vs "%s" stays correct', (a, b) => {
    expect(legacy(a, b)).toBe(true);
    expect(verdict(a, b)).toBe('correct');
  });
});
