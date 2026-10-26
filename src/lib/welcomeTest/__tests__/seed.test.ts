import { describe, it, expect } from 'vitest';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';
import {
  CURRENT_WELCOME_BANK,
  bankQuestions,
  welcomeTestGenerationParams,
  welcomeTestQuestionsToAdd,
  welcomeTestSeedRows,
} from '../seed';
import {
  WELCOME_TEST_BANK_SIZES,
  bankOfRowCount,
  readWelcomeTestParams,
  storedQuestionId,
} from '../../../../supabase/functions/_shared/welcomeTestBank';
import {
  WELCOME_TEST_QUESTION_IDS,
  answersFromQuestionRows,
} from '../../../../supabase/functions/_shared/welcomeTestTraits';

describe('Welcome Test banks', () => {
  it('bank 1 is the first 58 questions of the array, in order, and the id list matches it', () => {
    const q = bankQuestions(1);
    expect(q).toHaveLength(WELCOME_TEST_BANK_SIZES[1]);
    expect(q.map((x) => x.id)).toEqual([...WELCOME_TEST_QUESTION_IDS].slice(0, q.length));
    expect(q).toEqual(ALL_WELCOME_TEST_QUESTIONS.slice(0, q.length));
  });

  it('an unknown bank is refused instead of seeding a wrong test', () => {
    expect(() => bankQuestions(99)).toThrow(/Unknown Welcome Test bank/);
  });

  it('recognises the bank from the number of seeded rows; legacy sizes belong to no bank', () => {
    expect(bankOfRowCount(58)).toBe(1);
    expect(bankOfRowCount(54)).toBeNull();
    expect(bankOfRowCount(49)).toBeNull();
    expect(bankOfRowCount(0)).toBeNull();
  });

  it('reads bank and form from generation_params with safe defaults for old tests', () => {
    expect(readWelcomeTestParams(welcomeTestGenerationParams(1, 'B'))).toEqual({ welcome_bank: 1, welcome_form: 'B' });
    expect(readWelcomeTestParams({})).toEqual({ welcome_bank: 1, welcome_form: 'A' });
    expect(readWelcomeTestParams(null)).toEqual({ welcome_bank: 1, welcome_form: 'A' });
    expect(readWelcomeTestParams({ welcome_bank: 'x', welcome_form: 'Z' })).toEqual({ welcome_bank: 1, welcome_form: 'A' });
    expect(readWelcomeTestParams({ welcome_bank: 7 })).toEqual({ welcome_bank: 1, welcome_form: 'A' });
  });
});

describe('seeded rows', () => {
  it('both seed shapes carry the same fields, the options and the question id', () => {
    const add = welcomeTestQuestionsToAdd();
    const rows = welcomeTestSeedRows('test-1');
    expect(add).toHaveLength(WELCOME_TEST_BANK_SIZES[CURRENT_WELCOME_BANK]);
    expect(rows).toHaveLength(add.length);
    rows.forEach((r, i) => {
      expect(r.question_index).toBe(i);
      expect(r.test_id).toBe('test-1');
      expect(r.question_text).toBe(add[i].question_text);
      expect(r.correct_answer).toEqual(add[i].correct_answer);
      expect(storedQuestionId(r)).toBe(ALL_WELCOME_TEST_QUESTIONS[i].id);
      expect(storedQuestionId({ question_data: add[i].question_data })).toBe(ALL_WELCOME_TEST_QUESTIONS[i].id);
    });
  });

  it('keeps the option list next to the id so the options reader is unchanged', () => {
    const mc = welcomeTestQuestionsToAdd().find((q) => (q.question_data as any).options);
    expect(Array.isArray((mc!.question_data as any).options)).toBe(true);
  });

  it('answers are read by the stored id and fall back to the position for old rows', () => {
    const answers = answersFromQuestionRows([
      { question_index: 0, student_answer: 'a', question_data: { question_id: 'wt_q1' } },
      { question_index: 3, student_answer: 'b', question_data: {} }, // old row: id from position
      { question_index: 9, student_answer: 'c', question_data: { question_id: 'wt_q99' } }, // stored id wins
      { question_index: 5, student_answer: null, question_data: { question_id: 'wt_q4' } },
    ]);
    expect(answers).toEqual({ wt_q1: 'a', [WELCOME_TEST_QUESTION_IDS[3]]: 'b', wt_q99: 'c' });
  });
});
