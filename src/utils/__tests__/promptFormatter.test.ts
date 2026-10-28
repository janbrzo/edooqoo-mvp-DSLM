import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: vi.fn() } } }));

import { buildPromptServiceFormData } from '../promptFormatter';

describe('buildPromptServiceFormData', () => {
  it('sends only the fields format-worksheet-prompt reads', () => {
    const sent = buildPromptServiceFormData({
      lessonTime: '60min',
      lessonTopic: 'Ordering food',
      lessonGoal: 'Order politely',
      teachingPreferences: 'modals',
      additionalInformation: 'Shy student',
      englishLevel: 'B1/B2',
      languageStyle: 3,
      selectedExercises: ['reading'],
      exerciseFocusMap: { reading: 'grammar' },
      studentId: 's1',
      studentName: 'Anna Kowalska',
      studentEmail: 'anna@example.com',
      __autoGenerateRequestId: 'r1',
    } as never);
    expect(Object.keys(sent).sort()).toEqual([
      'additionalInformation', 'englishLevel', 'exerciseFocusMap', 'languageStyle',
      'lessonGoal', 'lessonTopic', 'selectedExercises', 'teachingPreferences',
    ]);
    expect(JSON.stringify(sent)).not.toMatch(/anna|s1|r1/i);
  });
});
