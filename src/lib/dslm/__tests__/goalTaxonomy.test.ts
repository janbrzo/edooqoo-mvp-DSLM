import { describe, it, expect } from 'vitest';
import {
  detectGoalConflict,
  isMainGoalMissing,
  mainGoalToTrack,
  trackPacingDelta,
} from '../../../../supabase/functions/_shared/goalTaxonomy';
import { autoPacingIndex } from '../../../../supabase/functions/_shared/pacing';
import { divergentSuggestion } from '../goalConflict';

describe('goal taxonomy', () => {
  it('maps legacy main_goal codes to tracks like the SQL backfill', () => {
    expect(mainGoalToTrack('work')).toBe('business');
    expect(mainGoalToTrack('social-conversation')).toBe('social');
    expect(mainGoalToTrack('personal-development')).toBe('general');
    expect(mainGoalToTrack('')).toBe('general');
    expect(mainGoalToTrack('Pass CAE in June')).toBe('custom');
  });

  it('treats "custom" as a tutor choice that is never overwritten', () => {
    expect(isMainGoalMissing('custom')).toBe(false);
    expect(isMainGoalMissing('')).toBe(true);
    expect(isMainGoalMissing(null)).toBe(true);
    expect(isMainGoalMissing('unknown')).toBe(true);
  });

  it('flags divergence only between two different specific tracks', () => {
    expect(detectGoalConflict('exam', 'work')).toBe('divergent');
    expect(detectGoalConflict('work', 'work')).toBe('aligned');
    expect(detectGoalConflict(null, 'work')).toBe('neutral');
    expect(detectGoalConflict('general', 'work')).toBe('neutral');
    expect(detectGoalConflict('Pass CAE', 'work')).toBe('neutral');
  });

  it('applies the track pacing delta only when main_goal has no keyword', () => {
    expect(trackPacingDelta('exam')).toBe(-30);
    expect(trackPacingDelta('business')).toBe(20);
    expect(autoPacingIndex({ main_goal: 'custom', learning_track: 'exam' }, null)).toBe(20);
    // keyword already scored: the track does not double count
    expect(autoPacingIndex({ main_goal: 'exam', learning_track: 'exam' }, null))
      .toBe(autoPacingIndex({ main_goal: 'exam' }, null));
  });

  it('reads the divergence flag from suggestions', () => {
    expect(divergentSuggestion([
      { metadata: { conflict_status: 'aligned' } },
      { metadata: { conflict_status: 'divergent', tutor_main_goal: 'exam', suggested_main_goal: 'work' } },
    ])).toEqual({ tutor: 'exam', suggested: 'work' });
    expect(divergentSuggestion([{ metadata: null }])).toBeNull();
  });
});
