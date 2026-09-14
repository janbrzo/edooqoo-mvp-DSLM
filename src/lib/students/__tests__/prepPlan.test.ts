import { describe, it, expect } from 'vitest';
import {
  selectPrepSuggestion,
  buildRationale,
  formatRelativeAge,
  RATIONALE_MAX_LEN,
  FALLBACK_TOPIC,
  NO_SIGNAL_RATIONALE,
  type PrepSuggestionInput,
} from '../prepPlan';

function row(over: Partial<PrepSuggestionInput> = {}): PrepSuggestionInput {
  return {
    id: 'sug-1',
    student_id: 's1',
    teacher_id: 't1',
    sequence_number: 1,
    suggested_topic: 'Past simple in storytelling',
    suggested_goal: 'Tell a past project story',
    suggested_exercises: ['reading', 'true-false'],
    focus_elements: null,
    rationale: null,
    is_used: false,
    used_worksheet_id: null,
    used_at: null,
    source: 'ai_generated',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    deleted_at: null,
    ...over,
  } as PrepSuggestionInput;
}

const NO_FALLBACK = { mainGoal: null, focusAreas: [] as string[] };

describe('selectPrepSuggestion', () => {
  it('prefers a phase step over a next step', () => {
    const result = selectPrepSuggestion(
      [row({ id: 'p1', suggested_topic: 'Phase topic' })],
      [row({ id: 'n1', suggested_topic: 'Next topic' })],
      NO_FALLBACK,
    );
    expect(result.topic).toBe('Phase topic');
    expect(result.source).toBe('phase_step');
  });

  it('falls back to next steps when there is no phase step', () => {
    const result = selectPrepSuggestion([], [row({ id: 'n1' })], NO_FALLBACK);
    expect(result.source).toBe('next_step');
    expect(result.id).toBe('n1');
  });

  it('skips used suggestions', () => {
    const result = selectPrepSuggestion(
      [],
      [row({ id: 'a', is_used: true }), row({ id: 'b', sequence_number: 2, suggested_topic: 'Fresh' })],
      NO_FALLBACK,
    );
    expect(result.topic).toBe('Fresh');
  });

  it('skips soft-deleted suggestions', () => {
    const result = selectPrepSuggestion(
      [],
      [row({ id: 'a', deleted_at: '2026-09-02T00:00:00.000Z' })],
      NO_FALLBACK,
    );
    expect(result.source).toBe('fallback');
  });

  it('skips rows with an empty topic', () => {
    const result = selectPrepSuggestion(
      [],
      [row({ id: 'a', suggested_topic: '   ' }), row({ id: 'b', sequence_number: 5, suggested_topic: 'Real' })],
      NO_FALLBACK,
    );
    expect(result.topic).toBe('Real');
  });

  it('orders by sequence_number then id', () => {
    const result = selectPrepSuggestion(
      [],
      [
        row({ id: 'z', sequence_number: 3, suggested_topic: 'Third' }),
        row({ id: 'b', sequence_number: 1, suggested_topic: 'First' }),
        row({ id: 'a', sequence_number: 1, suggested_topic: 'Tie winner' }),
      ],
      NO_FALLBACK,
    );
    expect(result.topic).toBe('Tie winner');
  });

  it('trims text fields and defaults missing ones to empty strings', () => {
    const result = selectPrepSuggestion(
      [],
      [row({ suggested_topic: '  Topic  ', suggested_goal: null, suggested_grammar_focus: '  present perfect ' })],
      NO_FALLBACK,
    );
    expect(result.topic).toBe('Topic');
    expect(result.goal).toBe('');
    expect(result.grammarFocus).toBe('present perfect');
    expect(result.additionalInfo).toBe('');
  });

  it('filters the exercise focus map to vocabulary/grammar', () => {
    const result = selectPrepSuggestion(
      [],
      [row({ suggested_exercise_focus_map: { reading: 'grammar', matching: 'nonsense', gap: 'vocabulary' } })],
      NO_FALLBACK,
    );
    expect(result.exerciseFocusMap).toEqual({ reading: 'grammar', gap: 'vocabulary' });
  });

  it('defaults exercises to an empty array', () => {
    const result = selectPrepSuggestion([], [row({ suggested_exercises: null })], NO_FALLBACK);
    expect(result.exercises).toEqual([]);
  });

  it('falls back to the first focus area', () => {
    const result = selectPrepSuggestion([], [], {
      mainGoal: 'work',
      focusAreas: ['phrasal verbs', 'fluency'],
    });
    expect(result).toMatchObject({
      id: null,
      source: 'fallback',
      topic: 'phrasal verbs',
      goal: 'Work/Business',
    });
  });

  it('falls back to the formatted main goal when there are no focus areas', () => {
    const result = selectPrepSuggestion([], [], { mainGoal: 'exam', focusAreas: [] });
    expect(result.topic).toBe('Exam Preparation');
  });

  it('falls back to a generic topic when nothing is known', () => {
    const result = selectPrepSuggestion(null, undefined, NO_FALLBACK);
    expect(result.topic).toBe(FALLBACK_TOPIC);
    expect(result.rationale).toBeNull();
  });
});

describe('buildRationale', () => {
  const base = selectPrepSuggestion([], [], NO_FALLBACK);

  it('uses the AI rationale when present', () => {
    const s = { ...base, rationale: 'Three past-tense errors in the last two worksheets.' };
    expect(buildRationale(s, ['past simple'])).toBe(
      'Three past-tense errors in the last two worksheets.',
    );
  });

  it('trims a long rationale on a word boundary', () => {
    const long = `${'word '.repeat(60)}end`;
    const out = buildRationale({ ...base, rationale: long }, []);
    expect(out.length).toBeLessThanOrEqual(RATIONALE_MAX_LEN);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('wor…');
  });

  it('falls back to focus areas, capped at three', () => {
    const out = buildRationale(base, ['a', 'b', 'c', 'd']);
    expect(out).toBe('Based on recent focus: a, b, c');
  });

  it('reports honestly when there is no signal at all', () => {
    expect(buildRationale(base, [])).toBe(NO_SIGNAL_RATIONALE);
  });
});

describe('formatRelativeAge', () => {
  const now = new Date(2026, 8, 14, 12, 0, 0); // 14 Sep 2026, local

  it('returns an empty string for missing or invalid input', () => {
    expect(formatRelativeAge(null, now)).toBe('');
    expect(formatRelativeAge('not-a-date', now)).toBe('');
  });

  it('handles today and future dates', () => {
    expect(formatRelativeAge(new Date(2026, 8, 14, 8, 0, 0).toISOString(), now)).toBe('Today');
    expect(formatRelativeAge(new Date(2026, 8, 15, 8, 0, 0).toISOString(), now)).toBe('Today');
  });

  it('handles yesterday and the day range', () => {
    expect(formatRelativeAge(new Date(2026, 8, 13, 23, 0, 0).toISOString(), now)).toBe('Yesterday');
    expect(formatRelativeAge(new Date(2026, 8, 10).toISOString(), now)).toBe('4 days ago');
    expect(formatRelativeAge(new Date(2026, 8, 8).toISOString(), now)).toBe('6 days ago');
  });

  it('handles the week range', () => {
    expect(formatRelativeAge(new Date(2026, 8, 7).toISOString(), now)).toBe('1 week ago');
    expect(formatRelativeAge(new Date(2026, 7, 31).toISOString(), now)).toBe('2 weeks ago');
  });

  it('falls back to an absolute date beyond four weeks, across a month boundary', () => {
    expect(formatRelativeAge(new Date(2026, 7, 10).toISOString(), now)).toBe('Aug 10, 2026');
    expect(formatRelativeAge(new Date(2025, 11, 31).toISOString(), now)).toBe('Dec 31, 2025');
  });
});
