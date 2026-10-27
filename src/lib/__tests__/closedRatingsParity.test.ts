import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildItemEvaluations } from '@/utils/masteryCalculator';
import { buildClosedItemEvaluations } from '../../../supabase/functions/_shared/closedRatings';

const ns = (name: string) => ({ name, reason: 'r', confidence: 0.8 });

const FIXTURES: Array<{ type: string; exercise: any; answers: Record<string, any> }> = [
  {
    type: 'multiple-choice',
    exercise: { questions: [
      { question: 'Q1', options: ['a', 'b', 'c'], correct_answer: 'B', nano_skill: ns('grammar.tenses.present') },
      { question: 'Q2', options: ['a', 'b', 'c'], correct_answer: 'A', nano_skill: [ns('grammar.tenses.past'), ns('reading.main_idea.x')] },
      { question: 'Q3', options: ['a', 'b'], correct_answer: 'A' },
    ] },
    answers: { 0: 'B', 1: 'C', 2: 'A' },
  },
  {
    type: 'true-false',
    exercise: { statements: [
      { statement: 'S1', correct_answer: true, nano_skill: ns('reading.detail.a') },
      { statement: 'S2', correct_answer: false, nano_skill: ns('reading.detail.b') },
    ] },
    answers: { 0: 'true', 1: 'true' },
  },
  {
    type: 'fill-in-blanks',
    exercise: { sentences: [
      { text: 'The ___ is big.', answer: 'boss', nano_skill: ns('vocabulary.work.a') },
      { text: 'A ___ B ___ C.', answers: ['x', 'y'], nano_skill: [ns('writing.spelling.a'), ns('speaking.pron.a')] },
      { text: 'Unanswered ___', answer: 'z', nano_skill: ns('vocabulary.work.b') },
    ] },
    answers: { 0: 'manager', '1_0': 'x', '1_1': 'y' },
  },
  {
    type: 'gap-text',
    exercise: { sentences: [{ text: 'It ___ rains.', answer: 'often', nano_skill: ns('grammar.adverbs.a') }] },
    answers: { 0: 'often' },
  },
];

describe('server closed ratings match the client buildItemEvaluations', () => {
  for (const f of FIXTURES) {
    it(`${f.type}`, () => {
      const client = buildItemEvaluations(f.exercise, f.answers, f.type, null, null);
      const server = buildClosedItemEvaluations(f.type, f.exercise, f.answers);
      expect(server).toEqual(client);
    });
  }

  it('returns null when nothing is answered or rated', () => {
    expect(buildClosedItemEvaluations('multiple-choice', FIXTURES[0].exercise, {})).toBeNull();
    expect(buildClosedItemEvaluations('multiple-choice', null, { 0: 'A' })).toBeNull();
  });

  it('the homework grader builds closed ratings itself and ignores stored ones', () => {
    const src = readFileSync('supabase/functions/process-pending-ai-evaluations/homeworkEval.ts', 'utf8');
    expect(src).toContain('buildClosedItemEvaluations(');
    expect(src).not.toContain('storedItemEvaluations:');
  });

  it('the scheduled run also re-rates unsubmitted closed drafts from the key', () => {
    const src = readFileSync('supabase/functions/process-pending-ai-evaluations/homeworkEval.ts', 'utf8');
    expect(src).toContain('finalizeClosedRows(supabase, (scan.data || []) as SelectionRow[], submitted)');
    expect(src).toContain(".eq('is_submitted', false)");
    expect(src).toContain("'10min_inactivity'");
  });
});
