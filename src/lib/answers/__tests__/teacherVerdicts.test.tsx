import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyTeacherVerdict, TeacherVerdictsContext } from '../teacherVerdicts';
import { teacherVerdictsOf } from '@/lib/homework/reviewItems';
import ExerciseWordOrder from '@/components/worksheet/ExerciseWordOrder';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

const sentences = [{ scrambled_words: 'is she a boss', correct_order: 'She is a boss' }];
const render = (verdicts: Record<number, 'correct' | 'wrong'>) => renderToStaticMarkup(
  <TeacherVerdictsContext.Provider value={verdicts}>
    <ExerciseWordOrder
      sentences={sentences} isEditing={false} viewMode="teacher" onSentenceChange={() => {}}
      isInteractive studentAnswers={{ 0: 'She boss is a' }} showCorrectAnswers disabled
    />
  </TeacherVerdictsContext.Provider>,
);

describe('applyTeacherVerdict', () => {
  it('replaces only a review verdict', () => {
    expect(applyTeacherVerdict({ 0: 'correct' }, 0, 'review')).toBe('correct');
    expect(applyTeacherVerdict({ 0: 'wrong' }, 0, 'review')).toBe('wrong');
    expect(applyTeacherVerdict({ 0: 'correct' }, 0, 'wrong')).toBe('wrong');
    expect(applyTeacherVerdict({}, 0, 'review')).toBe('review');
  });
});

describe('teacherVerdictsOf', () => {
  it('reads the teacher decisions from stored ratings', () => {
    expect(teacherVerdictsOf([
      { question_index: 0, mastery: 100, hasValue: true, source: 'teacher' },
      { question_index: 1, mastery: 0, hasValue: true, source: 'teacher' },
      { question_index: 2, mastery: 85, hasValue: true, source: 'ai_alternative' },
      { question_index: 3, mastery: -1, hasValue: false },
    ])).toEqual({ 0: 'correct', 1: 'wrong' });
    expect(teacherVerdictsOf(null)).toEqual({});
  });
});

describe('exercise renderer with a teacher verdict', () => {
  it('shows "Needs teacher review" until the teacher decided', () => {
    expect(render({})).toContain('Needs teacher review');
    expect(render({ 0: 'correct' })).not.toContain('Needs teacher review');
    expect(render({ 0: 'wrong' })).not.toContain('Needs teacher review');
  });
});
