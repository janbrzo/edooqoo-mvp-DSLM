import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prefillPlacementLesson, pendingPlacementLessonId, rememberPlacementLesson } from '../placementLessonPrefill';
import type { PlacementLessonProposal } from '../placementReportApi';

const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
};
const lesson: PlacementLessonProposal = { id: 'lesson-1', topic: 'Status updates', goal: 'Use past tenses accurately', additionalInfo: null, grammarFocus: 'Past Simple', difficulty: 'A2', rationale: 'Placement gap', exercises: ['reading', 'fill-in-blanks', 'matching', 'dialogue', 'discussion', 'multiple-choice', 'true-false', 'error-correction'], exerciseFocusMap: { 'fill-in-blanks': 'grammar' } };
beforeEach(() => { vi.stubGlobal('window', {}); vi.stubGlobal('sessionStorage', storage()); vi.stubGlobal('localStorage', storage()); });

describe('manual placement lesson handoff', () => {
  it('passes the chosen topic, goal, CEFR and exercises without arming generation or an unclaimed student', () => {
    sessionStorage.setItem('autoGenerateWorksheet', 'true');
    sessionStorage.setItem('autoGenerateWorksheetRequest', '{"studentId":"unclaimed"}');
    sessionStorage.setItem('preSelectedStudent', '{"id":"another-student"}');
    prefillPlacementLesson(lesson);
    expect(JSON.parse(sessionStorage.getItem('prefillWorksheet') ?? '{}')).toEqual({ topic: 'Status updates', goal: 'Use past tenses accurately', grammarFocus: 'Past Simple', additionalInfo: '', englishLevel: 'A1/A2' });
    expect(JSON.parse(sessionStorage.getItem('prefillExercises') ?? '[]')).toHaveLength(8);
    expect(sessionStorage.getItem('autoGenerateWorksheet')).toBeNull();
    expect(sessionStorage.getItem('autoGenerateWorksheetRequest')).toBeNull();
    expect(sessionStorage.getItem('preSelectedStudent')).toBeNull();
    expect(sessionStorage.getItem('prefillSuggestionId')).toBeNull();
  });
  it('passes the owned student and stored suggestion only after an authenticated claim', () => {
    prefillPlacementLesson(lesson, { id: 'owned-student', name: 'Marta' });
    expect(JSON.parse(sessionStorage.getItem('preSelectedStudent') ?? '{}')).toEqual({ id: 'owned-student', name: 'Marta' });
    expect(sessionStorage.getItem('prefillSuggestionId')).toBe('lesson-1');
    expect(sessionStorage.getItem('autoGenerateWorksheet')).toBeNull();
  });
  it('binds the remembered selection to the exact teacher report', () => {
    rememberPlacementLesson('teacher-token-a', 'lesson-1');
    expect(pendingPlacementLessonId('teacher-token-a')).toBe('lesson-1');
    expect(pendingPlacementLessonId('teacher-token-b')).toBeNull();
  });
});