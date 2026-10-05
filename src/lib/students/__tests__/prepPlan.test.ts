import { describe, it, expect } from 'vitest';
import {
  selectPrepSuggestion,
  buildRationale,
  formatRelativeAge,
  RATIONALE_MAX_LEN,
  FALLBACK_TOPIC,
  NO_SIGNAL_RATIONALE,
  PREP_TOPIC_MAX_LEN,
  type PrepSuggestionInput,
} from '../prepPlan';
import { FIELD_LIMITS } from '@/components/WorksheetForm/constants';

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

  it('regression: agrees with the Learning plan queue across phases', () => {
    // sequence_number restarts at 1 in every phase; the in-progress phase wins.
    const phases = [
      { id: 'P1', sequence_number: 1, status: 'in_progress', title: 'Meetings' },
      { id: 'P2', sequence_number: 2, status: 'planned', title: 'Negotiation' },
    ];
    const result = selectPrepSuggestion(
      [
        row({ id: 'p2-s1', phase_id: 'P2', sequence_number: 1, suggested_topic: 'Phase 2 step 1' }),
        row({ id: 'p1-s2', phase_id: 'P1', sequence_number: 2, suggested_topic: 'Phase 1 step 2' }),
      ],
      [],
      NO_FALLBACK,
      phases,
    );
    expect(result.topic).toBe('Phase 1 step 2');
    expect(result.source).toBe('phase_step');
    expect(result.phaseCaption).toBe('Phase 1: Meetings');
  });

  it('reports no phase caption for free steps and the fallback', () => {
    expect(selectPrepSuggestion([], [row({ id: 'n1' })], NO_FALLBACK).phaseCaption).toBeNull();
    expect(selectPrepSuggestion([], [], NO_FALLBACK).phaseCaption).toBeNull();
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

  it('keeps a long focus area intact as the fallback topic (no display ellipsis)', () => {
    const focus = 'Mixes past simple and present perfect when summarising campaign results in meetings';
    const result = selectPrepSuggestion([], [], { mainGoal: null, focusAreas: [focus] });
    expect(result.topic).toBe(focus);
    expect(result.topic).not.toContain('…');
  });

  it('fits the fallback topic into the Lesson topic field on a word boundary', () => {
    const focus = `${'word '.repeat(60)}end`;
    const result = selectPrepSuggestion([], [], { mainGoal: null, focusAreas: [focus] });
    expect(PREP_TOPIC_MAX_LEN).toBe(FIELD_LIMITS.lessonTopic);
    expect(result.topic.length).toBeLessThanOrEqual(PREP_TOPIC_MAX_LEN);
    expect(result.topic.endsWith('word')).toBe(true);
    expect(result.topic).not.toContain('…');
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
