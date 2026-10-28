import { describe, expect, it } from 'vitest';
import { orderUpNext, type PlanSuggestionLite } from '@/lib/dslm/learningPlan';
import {
  createSuggestionOrigin,
  parseAppliedPreset,
  reconcileSuggestionOrigin,
  serializeAppliedPreset,
  suggestionIdForSubmit,
} from '../suggestionOrigin';

describe('suggestion origin', () => {
  it('stamps the suggestion only for the same student', () => {
    const origin = createSuggestionOrigin('sug-1', 'A');
    expect(suggestionIdForSubmit(origin, 'A')).toBe('sug-1');
    expect(suggestionIdForSubmit(origin, 'B')).toBeNull();
    expect(suggestionIdForSubmit(origin, 'no-student')).toBeNull();
  });

  it('binds an unbound origin to the first student the form resolves', () => {
    let origin = createSuggestionOrigin('sug-1', 'no-student');
    expect(suggestionIdForSubmit(origin, 'A')).toBeNull();
    origin = reconcileSuggestionOrigin(origin, 'no-student');
    expect(origin?.studentId).toBeNull();
    origin = reconcileSuggestionOrigin(origin, 'A');
    expect(origin?.studentId).toBe('A');
    expect(suggestionIdForSubmit(origin, 'A')).toBe('sug-1');
  });

  it('drops the origin when the student changes, and it never comes back', () => {
    let origin = createSuggestionOrigin('sug-1', 'A');
    origin = reconcileSuggestionOrigin(origin, 'B');
    expect(origin).toBeNull();
    origin = reconcileSuggestionOrigin(origin, 'A');
    expect(origin).toBeNull();
  });

  it('does not depend on the topic: an edited topic still marks the suggestion', () => {
    // The origin carries only ids; nothing about the typed text is compared.
    expect(suggestionIdForSubmit(createSuggestionOrigin('sug-1', 'A'), 'A')).toBe('sug-1');
  });

  it('round-trips the applied preset value and reads the legacy plain id', () => {
    const origin = createSuggestionOrigin('sug-2', 'A')!;
    expect(parseAppliedPreset(serializeAppliedPreset(origin))).toEqual(origin);
    expect(parseAppliedPreset('sug-legacy')).toEqual({ suggestionId: 'sug-legacy', studentId: null });
    expect(parseAppliedPreset(null)).toBeNull();
  });
});

describe('Up next after a suggestion is marked used', () => {
  const row = (id: string, sequence: number, used: boolean): PlanSuggestionLite => ({
    id,
    sequence_number: sequence,
    suggested_topic: `Topic ${id}`,
    phase_id: null,
    is_used: used,
    deleted_at: null,
  });

  it('advances to the next lesson once the stamped suggestion is used', () => {
    const before = orderUpNext({ phases: [], nextSteps: [row('a', 1, false), row('b', 2, false)] });
    expect(before[0].suggestion.id).toBe('a');
    const after = orderUpNext({ phases: [], nextSteps: [row('a', 1, true), row('b', 2, false)] });
    expect(after[0].suggestion.id).toBe('b');
  });
});
