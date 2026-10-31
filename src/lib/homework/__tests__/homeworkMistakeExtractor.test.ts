import { describe, expect, it } from 'vitest';
import { extractHomeworkMistakes, type MistakeAnswerRow } from '../homeworkMistakeExtractor';

const exercise = { type: 'multiple-choice', questions: [{ question: 'Choose a polite request.', options: [{ text: 'Send it!', correct: false }, { text: 'Could you send it?', correct: true }] }] };
const row: MistakeAnswerRow = { exercise_index: 0, exercise_type: 'multiple-choice', answers: { 0: 'Send it!' }, is_submitted: true, eval_trigger: 'submit_homework', item_evaluations: [{ question_index: 0, mastery: 0, hasValue: true }] };
const extract = (change: Partial<MistakeAnswerRow> = {}, ex: unknown = exercise) => extractHomeworkMistakes([ex], [{ ...row, ...change }]);
describe('Source-bound homework mistake cards', () => {
  it('uses readable prompt and correct answer, without exposing learner answer as a rule', () => {
    expect(extract()).toEqual([{ exercise_index: 0, question_index: 0, front_text: 'Choose a polite request.\nOptions: Send it!; Could you send it?', back_text: 'Could you send it?', front_example: null }]);
  });
  it('deduplicates multiple skill ratings of the same question', () => {
    expect(extract({ item_evaluations: [{ question_index: 0, mastery: 0, hasValue: true }, { question_index: 0, mastery: 0, hasValue: true }] })).toHaveLength(1);
  });
  it.each([
    { is_submitted: false }, { eval_trigger: null }, { answers: {} }, { answers: [] }, { exercise_index: -1 },
    { item_evaluations: null }, { item_evaluations: [{ question_index: 0, mastery: -1, hasValue: false }] },
    { item_evaluations: [{ question_index: 0, mastery: 0, hasValue: false }] },
    { item_evaluations: [{ question_index: 0, mastery: NaN, hasValue: true }] },
    { item_evaluations: [{ question_index: 0, mastery: 50, hasValue: true }] },
    { item_evaluations: [{ question_index: 0, mastery: 100, hasValue: true, source: 'ai_alternative' }] },
    { item_evaluations: [{ question_index: 0, mastery: 0, hasValue: true }, { question_index: 0, mastery: 100, hasValue: true }] },
  ])('excludes unsubmitted, missing, uncertain, accepted or conflicting evidence %j', change => expect(extract(change)).toEqual([]));
  it('teacher acceptance supersedes automatic wrong', () => {
    expect(extract({ item_evaluations: [{ question_index: 0, mastery: 0, hasValue: true }, { question_index: 0, mastery: 100, hasValue: true, source: 'teacher' }] })).toEqual([]);
  });
  it('uncertain word order requires a saved teacher decision', () => {
    const wordOrder = { type: 'word-order', sentences: [{ words: ['home', 'he', 'went'], correct_order: 'He went home' }] };
    const changed = { exercise_type: 'word-order', answers: { 0: 'Home went he' } };
    expect(extract(changed, wordOrder)).toEqual([]);
    expect(extract({ ...changed, item_evaluations: [{ question_index: 0, mastery: 0, hasValue: true, source: 'teacher' }] }, wordOrder)[0]?.back_text).toBe('He went home');
  });
  it('never turns a key-correct answer into an automatic mistake', () => expect(extract({ answers: { 0: 'Could you send it?' } })).toEqual([]));
  it('skips an unresolved answer key even after teacher rejection', () => expect(extract({}, { type: 'multiple-choice', questions: [{ question: 'Request?', options: [] }] })).toEqual([]));
  it('grammar gap uses the canonical matcher', () => {
    const gap = { type: 'gap-text', sentences: [{ text: 'She ___ the client.', answer: 'calls' }] };
    expect(extract({ exercise_type: 'gap-text', answers: { 0: 'call' } }, gap)[0]?.back_text).toBe('calls');
    expect(extract({ exercise_type: 'gap-text', answers: { 0: 'cals' } }, gap)).toEqual([]);
  });
  it('does not convert an ambiguous multi-blank aggregate', () => {
    expect(extract({ exercise_type: 'gap-text', answers: { '0_0': 'cal', '0_1': 'send' } }, { type: 'gap-text', sentences: [{ text: 'She ___ and ___', answer: 'calls / sends' }] })).toEqual([]);
  });
  it('open model answers are explicitly suggestions, not invented corrections', () => {
    expect(extract({ exercise_type: 'sentence-transformation', answers: { 0: 'Send it!' } }, { type: 'sentence-transformation', sentences: [{ original: 'Make this request polite: Send it!', transformed: 'Could you send it, please?' }] })[0]?.back_text).toBe('Suggested answer: Could you send it, please?');
  });
  it('a low open score without a model answer creates no card', () => expect(extract({ exercise_type: 'discussion' }, { type: 'discussion', questions: ['What would you do?'] })).toEqual([]));
  it('skips source-dependent and media-dependent tasks', () => {
    expect(extract({ exercise_type: 'reading' }, { type: 'reading', content: 'Private passage', questions: [{ question: 'What happened?', suggested_answer: 'A meeting.' }] })).toEqual([]);
    expect(extract({ exercise_type: 'multiple-choice-audio' }, { ...exercise, type: 'multiple-choice-audio' })).toEqual([]);
  });
  it.each(['content', 'passage', 'transcript', 'image_description'])('closed choice questions cannot discard their required %s', field => {
    expect(extract({}, { ...exercise, [field]: 'The client cancelled the meeting.' })).toEqual([]);
  });
  it('true/false questions about a passage are not standalone cards', () => {
    expect(extract({ exercise_type: 'true-false', answers: { 0: true } }, { type: 'true-false', content: 'Maya cancelled the meeting.', statements: [{ statement: 'Maya attended the meeting.', isTrue: false }] })).toEqual([]);
  });
});