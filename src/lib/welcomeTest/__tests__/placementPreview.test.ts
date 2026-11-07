import { describe, expect, it } from 'vitest';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';
import { PLACEMENT_PREVIEW_QUESTIONS } from '../placementPreview';

describe('local placement preview boundary', () => {
  it('selects the four genuine context, grammar, writing and speaking tasks', () => {
    expect(PLACEMENT_PREVIEW_QUESTIONS.map((question) => question.id))
      .toEqual(['wt_q3', 'wt_q22', 'wt_q17', 'wt_q16s']);
    expect(PLACEMENT_PREVIEW_QUESTIONS.map((question) => question.type))
      .toEqual(['preference_choice', 'multiple_choice', 'open_ended', 'speaking_record']);
    for (const sample of PLACEMENT_PREVIEW_QUESTIONS) {
      expect(sample.text).toBe(ALL_WELCOME_TEST_QUESTIONS.find((question) => question.id === sample.id)?.question_text);
    }
  });

  it('does not expose scoring rules, skill labels or an invented CEFR result', () => {
    for (const question of PLACEMENT_PREVIEW_QUESTIONS) {
      expect(Object.keys(question).sort()).toEqual(['description', 'id', 'options', 'text', 'type']);
    }
  });
});