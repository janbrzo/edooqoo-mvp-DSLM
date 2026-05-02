// ============================================
// FAZA 2: Interactive Worksheets - TypeScript Types
// ============================================

/**
 * Answer types for different exercise types
 * Each exercise type has its own answer structure stored in JSONB
 */

// ============================================
// ANSWER TYPES FOR SPECIFIC EXERCISES
// ============================================

// For exercises with multiple choice questions (radio buttons)
export interface MultipleChoiceAnswers {
  [questionIndex: number]: string; // Selected option text
}

// For True/False exercises (radio buttons)
export interface TrueFalseAnswers {
  [statementIndex: number]: boolean; // true or false
}

// For Fill-in-blanks exercises (text inputs)
export interface FillInBlanksAnswers {
  [blankIndex: number]: string; // User's text input
}

// For Reading comprehension questions (text inputs/textareas)
export interface ReadingAnswers {
  [questionIndex: number]: string; // User's text answer
}

// For Matching exercises (select dropdowns)
export interface MatchingAnswers {
  [leftItemIndex: number]: string; // Selected right item text
}

// For Matching Halves exercises (select dropdowns)
export interface MatchingHalvesAnswers {
  [firstHalfIndex: number]: string; // Selected second half text
}

// For Synonyms/Antonyms exercises (select dropdowns)
export interface SynonymsAntonymsAnswers {
  [wordIndex: number]: string; // Selected synonym/antonym
}

// For Categorize exercises (select dropdowns)
export interface CategorizeAnswers {
  [itemIndex: number]: string; // Selected category
}

// For Odd One Out exercises (radio buttons)
export interface OddOneOutAnswers {
  [groupIndex: number]: string; // Selected odd word
}

// For Word Order exercises (text input with comma-separated words)
export interface WordOrderAnswers {
  [sentenceIndex: number]: string; // Ordered words as comma-separated string
}

// For Gap Text exercises (text inputs)
export interface GapTextAnswers {
  [gapIndex: number]: string; // User's text input
}

// For Dialogue exercises (textareas for role-play)
export interface DialogueAnswers {
  [lineIndex: number]: string; // User's dialogue response
}

// For Answer Questions exercises (textareas)
export interface AnswerQuestionsAnswers {
  [questionIndex: number]: string; // User's answer
}

// For Describe Picture exercises (textarea)
export interface DescribePictureAnswers {
  description: string; // User's description of the picture
}

// For Negative Prefixes exercises (text inputs)
export interface NegativePrefixesAnswers {
  [wordIndex: number]: string; // Word with negative prefix
}

// For Paraphrasing exercises (textareas)
export interface ParaphrasingAnswers {
  [sentenceIndex: number]: string; // Paraphrased sentence
}

// For Sentence Transformation exercises (textareas)
export interface SentenceTransformationAnswers {
  [sentenceIndex: number]: string; // Transformed sentence
}

// For Complete Word exercises (text inputs)
export interface CompleteWordAnswers {
  [wordIndex: number]: string; // Completed word
}

// For Listening Comprehension exercises (textareas)
export interface ListeningComprehensionAnswers {
  [questionIndex: number]: string; // User's answer to listening question
}

// Union type for all possible answer structures
export type ExerciseAnswers =
  | MultipleChoiceAnswers
  | TrueFalseAnswers
  | FillInBlanksAnswers
  | ReadingAnswers
  | MatchingAnswers
  | MatchingHalvesAnswers
  | SynonymsAntonymsAnswers
  | CategorizeAnswers
  | OddOneOutAnswers
  | WordOrderAnswers
  | GapTextAnswers
  | DialogueAnswers
  | AnswerQuestionsAnswers
  | DescribePictureAnswers
  | NegativePrefixesAnswers
  | ParaphrasingAnswers
  | SentenceTransformationAnswers
  | CompleteWordAnswers
  | ListeningComprehensionAnswers;

// ============================================
// DATABASE TABLE INTERFACES
// ============================================

/**
 * Represents a student's answers for a homework exercise
 * Maps to homework_student_answers table
 */
export interface HomeworkStudentAnswer {
  id: string;
  homework_id: string;
  student_email: string;
  exercise_index: number;
  exercise_type: string;
  answers: ExerciseAnswers;
  is_submitted: boolean;
  started_at: string; // ISO timestamp
  last_saved_at: string; // ISO timestamp
  submitted_at: string | null; // ISO timestamp
}

/**
 * Represents a teacher's comment on a student's exercise
 * Maps to homework_teacher_comments table
 */
export interface HomeworkTeacherComment {
  id: string;
  homework_id: string;
  exercise_index: number;
  student_email: string;
  teacher_id: string;
  comment_text: string;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// ============================================
// STATE MANAGEMENT INTERFACES
// ============================================

/**
 * State for managing interactive homework in the frontend
 */
export interface InteractiveHomeworkState {
  homeworkId: string;
  studentEmail: string;
  answers: Record<number, ExerciseAnswers>; // exerciseIndex -> answers
  isSaving: boolean;
  lastSavedAt: Date | null;
  isSubmitted: boolean;
  submittedAt: Date | null;
}

/**
 * Progress information for homework completion
 */
export interface HomeworkProgress {
  totalExercises: number;
  answeredExercises: number;
  percentageComplete: number;
  totalTasks: number;
  answeredTasks: number;
}

// ============================================
// COMPONENT PROPS INTERFACES
// ============================================

/**
 * AI evaluation result for a single question
 */
export interface AiEvaluation {
  is_acceptable: boolean;
  quality_score: number;
  feedback: string;
  question_index?: number;
  writing_score?: number;
  speaking_score?: number;
}

/**
 * Props for making exercise components interactive
 * These props should be added to existing Exercise components
 */
export interface InteractiveExerciseProps {
  /**
   * Whether the exercise is in interactive mode (student view)
   */
  isInteractive?: boolean;

  /**
   * Student's current answers for this exercise
   * Key is question/item index, value is the answer
   */
  studentAnswers?: Record<number, any>;

  /**
   * Callback when student changes an answer
   * @param questionIndex - Index of the question/item being answered
   * @param value - The answer value (string, boolean, etc.)
   */
  onAnswerChange?: (questionIndex: number, value: any) => void;

  /**
   * Whether to show correct answers (teacher view)
   * When true, display student answers alongside correct answers
   */
  showCorrectAnswers?: boolean;

  /**
   * Teacher's comment for this exercise (if any)
   */
  teacherComment?: string;

  /**
   * AI evaluations per question index (for open-ended exercises)
   * Key is question index, value is the AI evaluation result
   */
  aiEvaluations?: Record<number, AiEvaluation>;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

/**
 * Request payload for saving a homework answer
 */
export interface SaveAnswerRequest {
  homework_id: string;
  student_email: string;
  exercise_index: number;
  exercise_type: string;
  answers: ExerciseAnswers;
}

/**
 * Request payload for submitting homework
 */
export interface SubmitHomeworkRequest {
  homework_id: string;
  student_email: string;
}

/**
 * Request payload for adding/updating teacher comment
 */
export interface SaveCommentRequest {
  homework_id: string;
  exercise_index: number;
  student_email: string;
  teacher_id: string;
  comment_text: string;
}

/**
 * Response from get_student_homework_answers function
 */
export interface GetAnswersResponse {
  answers: HomeworkStudentAnswer[];
  comments: HomeworkTeacherComment[];
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Map of exercise types to their answer type
 * Useful for type narrowing
 */
export type ExerciseTypeAnswerMap = {
  'multiple-choice': MultipleChoiceAnswers;
  'multiple-choice-audio': MultipleChoiceAnswers;
  'multiple-choice-picture': MultipleChoiceAnswers;
  'true-false': TrueFalseAnswers;
  'true-false-audio': TrueFalseAnswers;
  'true-false-picture': TrueFalseAnswers;
  'fill-in-blanks': FillInBlanksAnswers;
  'fill-in-blanks-audio': FillInBlanksAnswers;
  'reading': ReadingAnswers;
  'matching': MatchingAnswers;
  'matching-halves': MatchingHalvesAnswers;
  'synonyms-antonyms': SynonymsAntonymsAnswers;
  'categorize': CategorizeAnswers;
  'odd-one-out': OddOneOutAnswers;
  'word-order': WordOrderAnswers;
  'gap-text': GapTextAnswers;
  'dialogue': DialogueAnswers;
  'answer-questions': AnswerQuestionsAnswers;
  'answer-questions-audio': AnswerQuestionsAnswers;
  'answer-questions-picture': AnswerQuestionsAnswers;
  'describe-picture': DescribePictureAnswers;
  'negative-prefixes': NegativePrefixesAnswers;
  'paraphrasing': ParaphrasingAnswers;
  'sentence-transformation': SentenceTransformationAnswers;
  'complete-word': CompleteWordAnswers;
  'listening-comprehension': ListeningComprehensionAnswers;
  'error-correction': ReadingAnswers; // Similar to reading questions
  'discussion': ReadingAnswers; // Similar to reading questions
};

/**
 * Helper type to get answer type from exercise type string
 */
export type AnswerTypeForExercise<T extends keyof ExerciseTypeAnswerMap> =
  ExerciseTypeAnswerMap[T];
