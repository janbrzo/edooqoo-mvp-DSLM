import { describe, it, expect } from 'vitest';
import { matchAnswer, type MatchVerdict } from '../matchAnswer';
import { checkWelcomeTestKeyedAnswer } from '../../../../supabase/functions/_shared/welcomeTestKeyedAnswer';

/**
 * D8 matcher tightening: only provably wrong answers turn `wrong`.
 * Each row: [label, student, key, options, expected verdict].
 */
type Opts = NonNullable<Parameters<typeof matchAnswer>[2]>;
const grammar: Opts = { mode: 'word', grammar: true };
const vocab: Opts = { mode: 'word' };
const src = (sourceSentence: string): Opts => ({ mode: 'sentence', sourceSentence });

const table: Array<[string, string, string, Opts, MatchVerdict]> = [
  // Rule 1: error-correction copy of the source is wrong
  ['copy of source', 'She go to school.', 'She goes to school.', src('She go to school.'), 'wrong'],
  ['copy of source, other case and no dot', 'she go to school', 'She goes to school.', src('She go to school.'), 'wrong'],
  ['copy of source with contraction expanded', "He don't like tea.", 'He doesn\'t like tea.', src("He do not like tea."), 'wrong'],
  ['copy of a longer source', 'I have went to Paris last year.', 'I went to Paris last year.', src('I have went to Paris last year.'), 'wrong'],
  ['copy of source, extra spaces', '  She   go to school ', 'She goes to school.', src('She go to school.'), 'wrong'],
  ['key is the sentinel, source copy is correct', 'She has lived here since 2010.', 'This sentence is correct', src('She has lived here since 2010.'), 'correct'],
  ['key is "no error", source copy is correct', 'He is late.', 'No error', src('He is late.'), 'correct'],
  ['key is "no mistake", short affirmation', 'ok', 'No mistake', src('He is late.'), 'correct'],
  ['key equals source, copy stays correct', 'Am I late?', 'Am I late?', src('Am I late?'), 'correct'],
  ['key equals source, other wording stays review', 'Do I arrive late?', 'Am I late?', src('Am I late?'), 'review'],
  ['real correction stays correct', 'She goes to school.', 'She goes to school.', src('She go to school.'), 'correct'],
  ['typo in correction stays review', 'She goes to scool.', 'She goes to school.', src('She go to school.'), 'review'],
  ['different wrong rewrite stays wrong', 'They played football.', 'She goes to school.', src('She go to school.'), 'wrong'],
  ['no source given: no copy rule', 'She go to school.', 'She goes to school.', { mode: 'sentence' }, 'review'],

  // Rule 2: regular ending in grammar items is wrong
  ['walk vs walks', 'walk', 'walks', grammar, 'wrong'],
  ['walks vs walk', 'walks', 'walk', grammar, 'wrong'],
  ['play vs played', 'play', 'played', grammar, 'wrong'],
  ['love vs loved (d)', 'love', 'loved', grammar, 'wrong'],
  ['watch vs watches (es)', 'watch', 'watches', grammar, 'wrong'],
  ['work vs working (ing)', 'work', 'working', grammar, 'wrong'],
  ['quick vs quickly (ly)', 'quick', 'quickly', grammar, 'wrong'],
  ['fast vs faster (er)', 'fast', 'faster', grammar, 'wrong'],
  ['fast vs fastest (est)', 'fast', 'fastest', grammar, 'wrong'],
  ['study vs studies (ies)', 'study', 'studies', grammar, 'wrong'],
  ['studies vs study (ies)', 'studies', 'study', grammar, 'wrong'],
  ['ending inside a multi-word key', 'she walk', 'she walks', grammar, 'wrong'],
  ['has been work vs has been working', 'has been work', 'has been working', grammar, 'wrong'],
  ['capital letters ignored', 'Walk', 'walks', grammar, 'wrong'],
  ['trailing dot ignored', 'walk.', 'walks', grammar, 'wrong'],
  ['other variant matches exactly: correct', 'walk', 'walks OR walk', grammar, 'correct'],
  ['only ending diff against every variant', 'walk', 'walks OR walked', grammar, 'wrong'],
  ['ending diff plus real typo variant stays review', 'walkes', 'walk OR walked', grammar, 'review'],
  ['exact grammar answer', 'walks', 'walks', grammar, 'correct'],
  ['contraction still correct', "don't", 'do not', grammar, 'correct'],

  // Rule 2 limits: stay review
  ['stem repeats last letter: recommendss vs recommend (2 edits, unchanged by D8)', 'recommendss', 'recommend', grammar, 'wrong'],
  ['recommendss vs recommends', 'recommendss', 'recommends', grammar, 'review'],
  ['likeed vs like (repeated e, 2 edits, unchanged by D8)', 'likeed', 'like', grammar, 'wrong'],
  ['needd vs need (repeated d, one edit, near typo)', 'needd', 'need', grammar, 'review'],
  ['stem of 2 letters: go vs goes (unchanged by D8)', 'go', 'goes', grammar, 'wrong'],
  ['stem of 2 letters: do vs does (unchanged by D8)', 'do', 'does', grammar, 'wrong'],
  ['typo: beautifull', 'beautifull', 'beautiful', grammar, 'review'],
  ['transposition: recieve', 'recieve', 'receive', grammar, 'review'],
  ['want vs went', 'want', 'went', grammar, 'review'],
  ['spice vs spicy', 'spice', 'spicy', grammar, 'review'],
  ['gos vs goes', 'gos', 'goes', grammar, 'review'],
  ['unrelated word', 'cat', 'beautiful', grammar, 'wrong'],

  // Rule 3: vocabulary items and word order stay review
  // Vocabulary items (no grammar flag) keep the one-edit near match: review, not wrong.
  ['vocab: walk vs walks', 'walk', 'walks', vocab, 'review'],
  ['vocab: play vs played (2 edits, unchanged by D8)', 'play', 'played', vocab, 'wrong'],
  ['vocab: quick vs quickly (2 edits, unchanged by D8)', 'quick', 'quickly', vocab, 'wrong'],
  ['vocab: typo', 'beautifull', 'beautiful', vocab, 'review'],
  ['word order: swapped', 'late he is', 'he is late', { mode: 'sentence' }, 'review'],
  ['word order: valid variant', 'Yesterday I went home', 'I went home yesterday', { mode: 'sentence' }, 'review'],
  ['word order with grammar flag stays review', 'late he is', 'he is late', { mode: 'sentence', grammar: true }, 'review'],
];

describe('D8 matcher tightening counterexample table', () => {
  it('has at least 45 cases', () => {
    expect(table.length).toBeGreaterThanOrEqual(45);
  });

  it.each(table)('%s', (_label, student, key, opts, expected) => {
    expect(matchAnswer(student, key, opts).verdict).toBe(expected);
  });
});

describe('D8: reasons', () => {
  it('reports source-copy and ending', () => {
    expect(matchAnswer('She go.', 'She goes.', src('She go.')).reason).toBe('source-copy');
    expect(matchAnswer('walk', 'walks', grammar).reason).toBe('ending');
  });
});

describe('D8: Welcome Test grammar items keep their strict comparison', () => {
  const grammarQ = (key: string) => ({ question_type: 'fill_blank', correct_answer: key, section: 'grammar' });
  it.each([
    ['walk', 'walks', false],
    ['recommendss', 'recommends', false],
    ['gos', 'goes', false],
    ['go', 'goes', false],
    ['want', 'went', false],
    ['Walks.', 'walks', true],
  ])('%s vs %s -> %s', (student, key, expected) => {
    expect(checkWelcomeTestKeyedAnswer(grammarQ(key), student)).toBe(expected);
  });

  it('vocabulary fill_blank items still go to review (null) for a regular ending', () => {
    expect(checkWelcomeTestKeyedAnswer({ question_type: 'fill_blank', correct_answer: 'walks', section: 'vocabulary' }, 'walk')).toBeNull();
  });
});

describe('D8: server scoring (calculateItemMastery) uses the same rules', () => {
  it('scores per exercise type', async () => {
    const { calculateItemMastery } = await import('../../../../supabase/functions/_shared/itemMastery');
    const gap = { sentences: [{ text: 'She ____ every day.', answer: 'walks' }] };
    expect(calculateItemMastery('gap-text', gap, 0, 'walk')).toBe(0);
    expect(calculateItemMastery('fill-in-blanks', gap, 0, 'walk')).toBe(0);
    expect(calculateItemMastery('complete-word', { words: [{ word: 'walks' }] }, 0, 'walk')).toBe(0);
    // vocabulary type keeps review (null = unscored)
    expect(calculateItemMastery('negative-prefixes', { words: [{ prefix: 'walks' }] }, 0, 'walk')).toBeNull();
    const ec = { sentences: [{ incorrect: 'She go to school.', answer: 'She goes to school.' }] };
    expect(calculateItemMastery('error-correction', ec, 0, 'She go to school.')).toBe(0);
    expect(calculateItemMastery('error-correction', ec, 0, 'She goes to school.')).toBe(100);
  });
});
