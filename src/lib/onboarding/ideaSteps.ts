/**
 * ideaSteps — completion rule for the two weekly-prep onboarding steps.
 *
 * The checklist sends teachers to the Learning plan's lesson suggestions
 * ("Get lesson suggestions", "Use a lesson suggestion"), so suggestions are
 * the primary signal. The teacher's own "Next Lesson Ideas" notes keep
 * counting as before, so no teacher loses a step that was already ticked.
 *
 * No React, no Supabase — unit-testable.
 */
export interface IdeaStepCounts {
  /** future_worksheet_suggestions rows (active or used, not deleted). */
  suggestions: number;
  /** future_worksheet_suggestions rows with is_used = true. */
  usedSuggestions: number;
  /** student_knowledge_entries with category 'Next Lesson Ideas'. */
  ideaNotes: number;
  /** Those notes already used in a worksheet. */
  usedIdeaNotes: number;
}

export function resolveIdeaSteps(counts: IdeaStepCounts): {
  generate_next_ideas: boolean;
  pick_idea: boolean;
} {
  const n = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);
  return {
    generate_next_ideas: n(counts.suggestions) > 0 || n(counts.ideaNotes) > 0,
    pick_idea: n(counts.usedSuggestions) > 0 || n(counts.usedIdeaNotes) > 0,
  };
}
