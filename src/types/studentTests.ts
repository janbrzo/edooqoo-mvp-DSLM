/**
 * Types for the Student Tests module
 * Intelligent tests that integrate with Progress, Knowledge Base, and Flashcards
 */

// =====================================================
// ENUMS AND UNION TYPES
// =====================================================

export type TestType = 'placement' | 'progress_check' | 'skill_verification' | 'goal_check' | 'welcome';

export type TestStatus = 'draft' | 'assigned' | 'in_progress' | 'completed' | 'reviewed';

export type QuestionType = 
  | 'multiple_choice' 
  | 'fill_blank' 
  | 'true_false' 
  | 'matching' 
  | 'open_ended' 
  | 'sentence_order'
  | 'self_assessment'
  | 'preference_choice'
  | 'scenario_reaction'
  | 'open_reflection'
  | 'self_assessment_matrix';

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

// =====================================================
// MAIN INTERFACES
// =====================================================

export interface StudentTest {
  id: string;
  student_id: string;
  teacher_id: string;
  
  // Test metadata
  test_type: TestType;
  title: string;
  description: string | null;
  
  // Links to Progress module
  linked_goal_id: string | null;
  linked_element_ids: string[];
  
  // Status workflow
  status: TestStatus;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  
  // Summary results
  total_questions: number;
  correct_answers: number;
  score_percentage: number | null;
  answered_count: number | null;
  time_spent_seconds: number;
  
  // Sharing
  share_token: string | null;
  
  // AI generation
  ai_generated: boolean;
  generation_params: GenerationParams;
  
  // Timestamps
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  
  // Joined data
  questions?: TestQuestion[];
  skill_results?: TestSkillResult[];
  student?: { name: string; english_level: string };
}

export interface TestQuestion {
  id: string;
  test_id: string;
  question_index: number;
  
  // Question content
  question_type: QuestionType;
  question_text: string;
  question_data: QuestionData;
  correct_answer: CorrectAnswer;
  explanation: string | null;
  
  // Skill mapping
  element_type: ElementType | null;
  difficulty_level: number; // 1-5
  skill_tags: string[];
  
  // Student answer
  student_answer: StudentAnswer | null;
  is_correct: boolean | null;
  answered_at: string | null;
  time_spent_seconds: number | null;
  
  // AI feedback
  ai_feedback: string | null;
  
  created_at: string | null;
}

export interface TestSkillResult {
  id: string;
  test_id: string;
  student_id: string;
  
  // Skill identification
  element_type: ElementType;
  skill_tags: string[];
  
  // Results
  total_questions: number;
  correct_answers: number;
  score_percentage: number | null;
  
  // Progress integration
  suggested_rating: number | null; // 1-5
  applied_to_element_id: string | null;
  applied_at: string | null;
  
  created_at: string | null;
}

// =====================================================
// QUESTION DATA TYPES
// =====================================================

export interface MultipleChoiceData {
  options: string[];
  allow_multiple?: boolean;
}

export interface FillBlankData {
  blanks_count: number;
  hint?: string;
}

export interface MatchingData {
  pairs: { left: string; right: string }[];
}

export interface SentenceOrderData {
  words: string[];
}

export type QuestionData = 
  | MultipleChoiceData 
  | FillBlankData 
  | MatchingData 
  | SentenceOrderData 
  | Record<string, unknown>;

export type CorrectAnswer = 
  | string 
  | string[] 
  | number 
  | number[] 
  | boolean 
  | { [key: string]: string };

export type StudentAnswer = 
  | string 
  | string[] 
  | number 
  | number[] 
  | boolean 
  | { [key: string]: string };

// =====================================================
// AI GENERATION TYPES
// =====================================================

export interface GenerationParams {
  focus_skills?: string[];
  difficulty_range?: { min: number; max: number };
  include_flashcards?: boolean;
  include_weaknesses?: boolean;
  question_count?: number;
  question_types?: QuestionType[];
}

export interface GenerateTestRequest {
  student_id: string;
  test_type: TestType;
  title?: string;
  linked_goal_id?: string;
  linked_element_ids?: string[];
  question_count?: number;
  difficulty_range?: { min: number; max: number };
  focus_skills?: string[];
  include_flashcards?: boolean;
  include_weaknesses?: boolean;
}

export interface GeneratedQuestion {
  question_type: QuestionType;
  question_text: string;
  question_data: QuestionData;
  correct_answer: CorrectAnswer;
  explanation?: string;
  element_type: ElementType;
  difficulty_level: number;
  skill_tags: string[];
}

// =====================================================
// FORM TYPES
// =====================================================

export interface NewTestData {
  student_id: string;
  test_type: TestType;
  title: string;
  description?: string;
  linked_goal_id?: string;
  linked_element_ids?: string[];
  // Plan v6.0 — attempt tracking for welcome test retakes
  attempt_number?: number;
  previous_attempt_id?: string | null;
}

export interface NewQuestionData {
  question_type: QuestionType;
  question_text: string;
  question_data: QuestionData;
  correct_answer: CorrectAnswer;
  explanation?: string;
  element_type?: ElementType;
  difficulty_level?: number;
  skill_tags?: string[];
}

// =====================================================
// CONSTANTS
// =====================================================

export const TEST_TYPES: { value: TestType; label: string; description: string; icon: string }[] = [
  {
    value: 'welcome',
    label: 'Welcome Test',
    description: 'Comprehensive placement & profiling test for new students',
    icon: 'Sparkles'
  },
];

export const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice', description: 'Select correct answer(s)' },
  { value: 'fill_blank', label: 'Fill in the Blank', description: 'Complete the sentence' },
  { value: 'true_false', label: 'True/False', description: 'Is the statement correct?' },
  { value: 'matching', label: 'Matching', description: 'Match pairs together' },
  { value: 'open_ended', label: 'Open Ended', description: 'Write a free response' },
  { value: 'sentence_order', label: 'Sentence Order', description: 'Arrange words correctly' },
];

export const ELEMENT_TYPES: { value: ElementType; label: string }[] = [
  { value: 'grammar', label: 'Grammar' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'pronunciation', label: 'Pronunciation' },
  { value: 'speaking', label: 'Speaking' },
  { value: 'listening', label: 'Listening' },
  { value: 'reading', label: 'Reading' },
  { value: 'writing', label: 'Writing' },
  { value: 'functional', label: 'Functional Language' },
  { value: 'cultural', label: 'Cultural Awareness' },
  { value: 'strategy', label: 'Learning Strategies' },
  { value: 'other', label: 'Other' },
];

export const TEST_STATUS_CONFIG: Record<TestStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  assigned: { label: 'Assigned', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  completed: { label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-100' },
  reviewed: { label: 'Reviewed', color: 'text-purple-700', bgColor: 'bg-purple-100' },
};

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Very Easy',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Very Hard',
};

export const RATING_FROM_SCORE = (scorePercentage: number): number => {
  if (scorePercentage >= 80) return 5;
  if (scorePercentage >= 60) return 4;
  if (scorePercentage >= 40) return 3;
  if (scorePercentage >= 20) return 2;
  return 1;
};
