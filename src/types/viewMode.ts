// ============================================
// View Mode Types for Worksheet Display
// ============================================

// Full view mode including live-session
export type ViewMode = "student" | "teacher" | "live-session";

// Legacy view mode for exercise components that don't support live-session yet
export type ExerciseViewMode = "student" | "teacher";

// Helper function to convert full ViewMode to ExerciseViewMode
// In live-session mode, we show teacher view (with answers) but add blue student answers
export const toExerciseViewMode = (viewMode: ViewMode): ExerciseViewMode => {
  return viewMode === 'live-session' ? 'teacher' : viewMode;
};
