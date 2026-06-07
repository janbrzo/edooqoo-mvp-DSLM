/**
 * Types for the Student Progress tracking system
 */

export type GoalType = 'supporting' | 'additional';

export type ElementType = 
  | 'grammar' 
  | 'vocabulary' 
  | 'pronunciation' 
  | 'speaking' 
  | 'listening' 
  | 'reading' 
  | 'writing' 
  | 'functional' 
  | 'cultural' 
  | 'strategy' 
  | 'other';

export type ElementSource = 'manual' | 'ai_generated';

export interface ProgressGoal {
  id: string;
  student_id: string;
  teacher_id: string;
  goal_type: string; // GoalType from DB
  title: string;
  description: string | null;
  target_date: string | null;
  is_achieved: boolean;
  achieved_at: string | null;
  display_order: number;
  archived_at?: string | null;
  manual_progress_pct?: number | null;
  accepted_at?: string | null;
  source?: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  // Joined data
  elements?: LearningElement[];
}

export interface LearningElement {
  id: string;
  goal_id: string;
  student_id: string;
  teacher_id: string;
  element_type: string; // ElementType from DB
  title: string;
  description: string | null;
  current_rating: number | null;
  target_rating: number;
  source: string; // ElementSource from DB
  display_order: number;
  last_rated_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

export interface WorksheetSuggestion {
  id: string;
  student_id: string;
  teacher_id: string;
  sequence_number: number;
  suggested_topic: string;
  suggested_goal: string | null;
  suggested_exercises: string[] | null;
  focus_elements: string[] | null;
  rationale: string | null;
  is_used: boolean;
  used_worksheet_id: string | null;
  used_at: string | null;
  source: string; // ElementSource from DB
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

// Constants for UI
export const ELEMENT_TYPES: { value: ElementType; label: string; description: string }[] = [
  { value: 'grammar', label: 'Grammar', description: 'Sentence structure, tenses, syntax' },
  { value: 'vocabulary', label: 'Vocabulary', description: 'Words, phrases, collocations' },
  { value: 'pronunciation', label: 'Pronunciation', description: 'Sounds, stress, intonation' },
  { value: 'speaking', label: 'Speaking', description: 'Fluency, conversation skills' },
  { value: 'listening', label: 'Listening', description: 'Comprehension, note-taking' },
  { value: 'reading', label: 'Reading', description: 'Comprehension, analysis' },
  { value: 'writing', label: 'Writing', description: 'Essays, emails, creative writing' },
  { value: 'functional', label: 'Functional Language', description: 'Requests, opinions, suggestions' },
  { value: 'cultural', label: 'Cultural Awareness', description: 'Idioms, customs, context' },
  { value: 'strategy', label: 'Learning Strategies', description: 'Self-study, test-taking' },
  { value: 'other', label: 'Other', description: 'Custom skills' },
];

export const GOAL_TYPES: { value: GoalType; label: string; description: string }[] = [
  { value: 'supporting', label: 'Supporting Goal', description: 'Aligned with main learning goal' },
  { value: 'additional', label: 'Additional Goal', description: 'Important side objective' },
];

export const RATING_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Basic',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Mastered',
};
