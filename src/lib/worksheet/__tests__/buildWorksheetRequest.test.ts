import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWorksheetRequest } from '../buildWorksheetRequest';
import { buildAutoGeneratePayload, writeAutoGenerateIntent } from '../autoGenerateBootstrap';
import { installBrowserStubs } from './browserStubs';

const base = {
  lessonTime: '60min' as const,
  lessonTopic: 'Ordering food',
  englishLevel: 'B1/B2' as const,
};

describe('buildWorksheetRequest', () => {
  it('trims every field and turns empty optionals into undefined', () => {
    const { request } = buildWorksheetRequest({
      ...base,
      lessonTopic: '  Ordering food \n',
      lessonGoal: '  ',
      grammarFocus: '   \n  ',
      additionalInformation: '   ',
      studentId: '  ',
      selectedExercises: [],
    });
    expect(request.lessonTopic).toBe('Ordering food');
    expect(request.lessonGoal).toBe('');
    // A whitespace-only grammar focus must be falsy, or the server-side
    // `grammarFocus:` line would swallow the next prompt line.
    expect(request.teachingPreferences).toBe('');
    expect(request.additionalInformation).toBeUndefined();
    expect(request.studentId).toBeUndefined();
  });

  it('gives 45 min exactly 6 exercises and 60 min exactly 8, deterministically', () => {
    const eight = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out', 'multiple-choice', 'discussion'];
    const lesson45 = buildWorksheetRequest({ ...base, lessonTime: '45min', selectedExercises: eight }).request;
    expect(lesson45.selectedExercises).toEqual(eight.slice(0, 6));

    const a = buildWorksheetRequest({ ...base, selectedExercises: ['reading', 'matching'] });
    const b = buildWorksheetRequest({ ...base, selectedExercises: ['reading', 'matching'] });
    expect(a.request.selectedExercises).toHaveLength(8);
    expect(a.request.selectedExercises).toEqual(b.request.selectedExercises);
    expect(a.autoCompletedCount).toBe(6);
  });

  it('keeps one media family and never pads with the other family', () => {
    const { request } = buildWorksheetRequest({
      ...base,
      selectedExercises: ['describe-picture', 'listening-comprehension', 'reading'],
      selectedMediaTypes: ['picture'],
    });
    expect(request.selectedMediaTypes).toEqual(['picture']);
    expect(request.selectedExercises).toContain('describe-picture');
    expect(request.selectedExercises).not.toContain('listening-comprehension');
  });

  it('prunes the focus map to the final exercises', () => {
    const { request } = buildWorksheetRequest({
      ...base,
      selectedExercises: ['reading'],
      exerciseFocusMap: { reading: 'grammar', ghost: 'vocabulary' },
    });
    expect(request.exerciseFocusMap).toEqual({ reading: 'grammar' });
  });
});

describe('form and auto-generate bootstrap parity', () => {
  beforeEach(() => {
    installBrowserStubs();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('produce the same request for the same suggestion', () => {
    const suggestion = {
      topic: ' Past simple for travel ',
      goal: 'Tell a trip story',
      additionalInfo: '  ',
      grammarFocus: ' past simple ',
      exercises: ['reading', 'describe-picture', 'matching'],
      exerciseFocusMap: { reading: 'grammar' as const },
    };
    writeAutoGenerateIntent({ studentId: 's1', ...suggestion, studentEnglishLevel: 'B2' });
    const auto = buildAutoGeneratePayload();

    const { request: form } = buildWorksheetRequest({
      lessonTime: '60min',
      lessonTopic: suggestion.topic,
      lessonGoal: suggestion.goal,
      grammarFocus: suggestion.grammarFocus,
      additionalInformation: suggestion.additionalInfo,
      englishLevel: 'B1/B2',
      languageStyle: 3,
      studentId: 's1',
      selectedExercises: suggestion.exercises,
      selectedMediaTypes: ['picture'],
      exerciseFocusMap: suggestion.exerciseFocusMap,
    });

    for (const key of [
      'lessonTime', 'lessonTopic', 'lessonGoal', 'teachingPreferences', 'additionalInformation',
      'englishLevel', 'languageStyle', 'studentId', 'selectedExercises', 'selectedMediaTypes', 'exerciseFocusMap',
    ] as const) {
      expect(auto?.[key]).toEqual(form[key]);
    }
    expect(auto?.selectedExercises).toHaveLength(8);
  });
});
