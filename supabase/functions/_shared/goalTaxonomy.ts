// Goal taxonomy shared by Edge Functions and the app (pure, no I/O).
// `students.main_goal` stays the tutor's free/legacy goal text; the learning
// track is a derived, coarse domain used for pacing and conflict detection.

export const LEARNING_TRACKS = [
  'business', 'exam', 'general', 'travel', 'academic', 'social', 'relocation', 'custom',
] as const;
export type LearningTrack = typeof LEARNING_TRACKS[number];

export const GOAL_KINDS = ['milestone', 'skill', 'task'] as const;
export type GoalKind = typeof GOAL_KINDS[number];

export type GoalConflictStatus = 'aligned' | 'divergent' | 'neutral';

const LEGACY_MAIN_GOAL_TO_TRACK: Record<string, LearningTrack> = {
  work: 'business',
  exam: 'exam',
  general: 'general',
  travel: 'travel',
  academic: 'academic',
  'social-conversation': 'social',
  'personal-development': 'general',
  'fun-entertainment': 'general',
};

export function isLearningTrack(value: unknown): value is LearningTrack {
  return typeof value === 'string' && (LEARNING_TRACKS as readonly string[]).includes(value);
}

/** Maps a legacy `main_goal` value to a learning track (mirrors the SQL backfill). */
export function mainGoalToTrack(mainGoal: string | null | undefined): LearningTrack {
  const key = String(mainGoal ?? '').trim().toLowerCase();
  if (!key) return 'general';
  return LEGACY_MAIN_GOAL_TO_TRACK[key] ?? 'custom';
}

/** True when the tutor has not set a real main goal (empty, "unknown" or bare "custom"). */
export function isMainGoalMissing(mainGoal: string | null | undefined): boolean {
  const v = String(mainGoal ?? '').trim().toLowerCase();
  return v === '' || v === 'unknown';
}

/**
 * Compares the tutor's main goal with the Welcome Test suggestion.
 * neutral: nothing to compare (no tutor goal, custom text, or a general suggestion);
 * aligned: same track; divergent: different specific tracks. The tutor goal always wins.
 */
export function detectGoalConflict(
  tutorMainGoal: string | null | undefined,
  suggestedMainGoal: string | null | undefined,
): GoalConflictStatus {
  if (isMainGoalMissing(tutorMainGoal)) return 'neutral';
  const tutorTrack = mainGoalToTrack(tutorMainGoal);
  const suggestedTrack = mainGoalToTrack(suggestedMainGoal);
  if (tutorTrack === 'custom' || suggestedTrack === 'custom') return 'neutral';
  if (tutorTrack === 'general' || suggestedTrack === 'general') return 'neutral';
  return tutorTrack === suggestedTrack ? 'aligned' : 'divergent';
}

/**
 * Pacing delta from the learning track, applied only when the main goal text
 * matched no pacing keyword (so the same signal is never counted twice).
 */
export function trackPacingDelta(track: string | null | undefined): number {
  switch (track) {
    case 'exam':
    case 'academic':
      return -30;
    case 'business':
    case 'travel':
    case 'social':
    case 'relocation':
      return 20;
    default:
      return 0;
  }
}
