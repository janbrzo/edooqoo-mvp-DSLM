/**
 * Welcome Test Types
 * Comprehensive placement + profiling test for new students
 */

// =====================================================
// QUESTION TYPES specific to Welcome Test
// =====================================================

export type WelcomeQuestionType =
  | 'self_assessment'      // Descriptive self-rating (not A1/B2)
  | 'preference_choice'    // Single or multi-select preferences
  | 'scenario_reaction'    // Situational response
  | 'open_reflection'      // Free text reflection
  | 'multiple_choice'      // Standard MC (grammar/vocab/reading)
  | 'fill_blank'           // Fill in the blank
  | 'open_ended'           // Open writing task
  | 'matching'             // Match pairs
  | 'self_assessment_matrix' // Rate multiple items on a scale
  | 'speaking_record'      // Student records audio via microphone
  | 'listening_comprehension'; // Audio playback + answer

export type WelcomeTestSection =
  | 'about_you'
  | 'experience'
  | 'scenarios'
  | 'grammar'
  | 'vocabulary'
  | 'communication'
  | 'goals';

// =====================================================
// QUESTION DEFINITION (static, predefined)
// =====================================================

export interface WelcomeTestQuestionDef {
  id: string;                        // e.g. "wt_q1"
  section: WelcomeTestSection;
  question_type: WelcomeQuestionType;
  question_text: string;
  description?: string;              // Helper text for the student
  options?: string[];                // For MC, preference_choice, scenario_reaction
  multi_select?: boolean;            // Allow multiple selections
  max_selections?: number;           // Limit for multi-select
  correct_answer?: string | string[];// For grammar/vocab questions
  matrix_items?: string[];           // For self_assessment_matrix (Q44)
  matrix_scale?: { min: number; max: number; labels?: Record<number, string> };
  audio_url?: string;                // Pre-generated audio for listening questions
  audio_transcript?: string;         // Fallback transcript for listening questions
  max_recording_seconds?: number;    // Max recording time for speaking questions
  
  // Metadata for scoring/logging
  element_type?: 'grammar' | 'vocabulary' | 'reading' | 'writing' | 'speaking' | 'listening' | 'pronunciation' | null;
  difficulty_level?: number;         // 1-5
  nano_skill?: string;              // e.g. "ns.grammar.third_person_s"
  scoring_logic: string;            // Description of what this question measures
  
  // Trait detection config
  detected_trait?: {
    trait_name: string;              // e.g. "anxiety_level", "motivation_type"
    mapping: Record<string, string>; // option_index -> trait_value
  };
}

export interface WelcomeTestSectionDef {
  id: WelcomeTestSection;
  title: string;
  subtitle: string;
  icon: string;
  questions: WelcomeTestQuestionDef[];
}

// =====================================================
// LEARNING PROFILE (result of Welcome Test)
// =====================================================

export interface LearningProfile {
  id: string;
  student_id: string;
  teacher_id: string;
  welcome_test_id: string | null;

  // Level assessment
  estimated_level: string | null;
  self_assessed_level: string | null;
  level_confidence: 'overestimates' | 'accurate' | 'underestimates' | null;

  // Motivation & personality
  motivation_type: 'instrumental' | 'integrative' | 'mixed' | null;
  anxiety_level: 'low' | 'medium' | 'high' | null;
  ambiguity_tolerance: 'low' | 'medium' | 'high' | null;
  error_attitude: 'comfortable' | 'cautious' | 'avoidant' | null;

  // Learning preferences
  preferred_activities: string[];
  preferred_input_channel: 'visual' | 'auditory' | 'kinesthetic' | null;
  feedback_preference: string | null;
  interest_topics: string[];
  weekly_study_time: string | null;

  // Skill scores
  grammar_score: number | null;
  vocabulary_score: number | null;
  reading_score: number | null;
  writing_score: number | null;
  communication_score: number | null;
  strongest_skill: string | null;
  weakest_skill: string | null;

  // Self-efficacy (Q44)
  confidence_speaking: number | null;
  confidence_writing: number | null;
  confidence_listening: number | null;
  confidence_reading: number | null;
  confidence_presenting: number | null;
  confidence_small_talk: number | null;

  // Meta
  raw_answers: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// EVENT PAYLOAD for Welcome Test answers
// =====================================================

export interface WelcomeTestAnswerPayload {
  test_type: 'welcome';
  question_index: number;
  question_id: string;
  question_type: WelcomeQuestionType;
  section: WelcomeTestSection;
  student_answer: unknown;
  is_correct: boolean | null;
  time_spent_seconds: number;
  nano_skill_ratings?: Array<{
    name: string;
    reason: string;
    mastery: number;
  }>;
  detected_traits?: Record<string, string>;
}

// =====================================================
// LEARNING PATH RESULT (calculated from Welcome Test)
// Stored in raw_answers.learning_path in student_learning_profiles
// =====================================================

export type LearningPathType = 'comfort' | 'guided' | 'accelerated' | 'target';

export interface LearningPathResult {
  score: number;                    // 0-100
  path: LearningPathType;
  component_scores: {
    // 5 new behavioral questions (50% weight)
    deadline_response: number;
    learning_timeline: number;
    persistence_level: number;
    career_importance: number;
    usage_context: number;
    // 10 existing questions (50% weight)
    motivation_type: number;
    ambiguity_tolerance: number;
    weekly_study_time: number;
    anxiety_level: number;
    learning_duration: number;
    learning_autonomy: number;
    error_attitude: number;
    reading_strategy: number;
    feedback_preference: number;
    confidence_overall: number;
  };
  overrides_applied: string[];      // e.g. ['urgent_critical_override']
}

export interface WelcomeTestCompletedPayload {
  test_type: 'welcome';
  total_questions: number;
  completed_questions: number;
  time_total_seconds: number;
  grammar_score: number;
  vocabulary_score: number;
  estimated_level: string;
  self_assessed_level: string;
  level_gap: string;
  profile_summary: {
    motivation_type: string;
    anxiety_level: string;
    preferred_activities: string[];
    interest_topics: string[];
    feedback_preference: string;
    learning_time_weekly: string;
    ambiguity_tolerance: string;
    strongest_skill: string;
    weakest_skill: string;
    self_awareness: string;
  };
}

// =====================================================
// SECTION CONFIG for UI rendering
// =====================================================

export const WELCOME_TEST_SECTIONS: { id: WelcomeTestSection; title: string; subtitle: string; icon: string }[] = [
  { id: 'about_you', title: 'About You', subtitle: 'Help us understand your learning style', icon: 'User' },
  { id: 'experience', title: 'Your English Experience', subtitle: 'Tell us about your journey so far', icon: 'BookOpen' },
  { id: 'scenarios', title: 'Real-Life Scenarios', subtitle: 'How would you handle these situations?', icon: 'MessageSquare' },
  { id: 'grammar', title: 'Grammar Check', subtitle: 'Let\'s see where you stand', icon: 'PenTool' },
  { id: 'vocabulary', title: 'Vocabulary & Expressions', subtitle: 'Test your word power', icon: 'BookOpen' },
  { id: 'communication', title: 'Communication Style', subtitle: 'How do you use English in practice?', icon: 'MessageCircle' },
  { id: 'goals', title: 'Your Goals & Preferences', subtitle: 'What do you want to achieve?', icon: 'Target' },
];
