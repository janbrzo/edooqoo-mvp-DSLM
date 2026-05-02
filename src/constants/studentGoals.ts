/**
 * Unified student goal constants used across the application.
 * Single source of truth for Main Goals dropdown in:
 * - AddStudentDialog
 * - StudentEditDialog
 * - StudentPage
 */

export const MAIN_GOALS = [
  { value: 'work', label: 'Work/Business' },
  { value: 'exam', label: 'Exam Preparation' },
  { value: 'general', label: 'General English' },
  { value: 'travel', label: 'Travel' },
  { value: 'academic', label: 'Academic' },
  { value: 'social-conversation', label: 'Social Conversation & Talking to People' },
  { value: 'personal-development', label: 'Personal Development & Self-Improvement' },
  { value: 'fun-entertainment', label: 'Fun & Entertainment' },
  { value: 'custom', label: 'Custom Goal' }
] as const;

export const ENGLISH_LEVELS = [
  { value: 'unknown', label: "I don't know yet" },
  { value: 'A1', label: 'A1 - Beginner' },
  { value: 'A2', label: 'A2 - Elementary' },
  { value: 'B1', label: 'B1 - Intermediate' },
  { value: 'B2', label: 'B2 - Upper Intermediate' },
  { value: 'C1', label: 'C1 - Advanced' },
  { value: 'C2', label: 'C2 - Proficiency' }
] as const;

/**
 * Helper function to format goal value to display label.
 * Falls back to the raw value if not found (for custom goals).
 */
export const formatGoalLabel = (goalValue: string): string => {
  const goal = MAIN_GOALS.find(g => g.value === goalValue);
  return goal?.label || goalValue;
};

/**
 * Check if a goal value is a standard (non-custom) goal.
 */
export const isStandardGoal = (goalValue: string): boolean => {
  return MAIN_GOALS.some(g => g.value === goalValue && g.value !== 'custom');
};
