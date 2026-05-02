// Flashcard types for spaced repetition learning system

export interface FlashcardSet {
  id: string;
  teacher_id: string;
  student_id: string;
  title: string;
  description: string | null;
  is_bidirectional: boolean;
  back_type: 'translation' | 'definition';
  share_token: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Computed fields (from queries)
  cards_count?: number;
  mastered_count?: number;
  study_sessions_count?: number;
  last_studied_at?: string | null;
  student_name?: string;
  student_native_language?: string;
  student_email?: string;
  teacher_name?: string;
}

export interface FlashcardCard {
  id: string;
  set_id: string;
  source_worksheet_id: string | null;
  front_text: string;        // English term
  front_example: string | null;
  back_text: string;         // Translation/definition
  source_type: 'manual' | 'vocabulary_sheet';
  card_position: number;
  cefr_level: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface FlashcardProgress {
  id: string;
  card_id: string;
  set_id: string;
  learner_identifier: string;
  direction: 1 | 2;  // 1=EN→Native, 2=Native→EN
  easiness_factor: number;
  repetition: number;
  interval_days: number;
  next_review_date: string;
  last_reviewed_at: string | null;
  total_reviews: number;
  correct_count: number;
  incorrect_count: number;
  created_at: string;
  updated_at: string;
}

// Review quality for SM-2 algorithm
export type ReviewQuality = 0 | 1 | 2 | 3;
// 0 = Again (complete failure)
// 1 = Hard (correct with difficulty)
// 2 = Good (correct with some hesitation)
// 3 = Easy (perfect response)

// Card for learning session (combined data)
export interface LearningCard {
  card_id: string;
  front_text: string;
  front_example: string | null;
  back_text: string;
  card_position: number;
  direction: 1 | 2;
  easiness_factor: number;
  repetition: number;
  interval_days: number;
  next_review_date: string;
  total_reviews: number;
  correct_count: number;
  incorrect_count: number;
  cefr_level?: string | null;
  // Runtime state
  isNew?: boolean;
  isDueForReview?: boolean;
}

// Session statistics
export interface LearningSessionStats {
  totalCards: number;
  newCards: number;
  reviewedCards: number;
  correctAnswers: number;
  incorrectAnswers: number;
  averageEasiness: number;
}

// Create/Update DTOs
export interface CreateFlashcardSet {
  student_id: string;
  title: string;
  description?: string;
  is_bidirectional?: boolean;
  back_type?: 'translation' | 'definition';
}

export interface CreateFlashcardCard {
  set_id: string;
  front_text: string;
  front_example?: string;
  back_text: string;
  source_type?: 'manual' | 'vocabulary_sheet';
  source_worksheet_id?: string;
  card_position?: number;
  cefr_level?: string;
}

export interface UpdateFlashcardCard {
  front_text?: string;
  front_example?: string;
  back_text?: string;
  card_position?: number;
}

// Vocabulary sheet formats (for import)
export type VocabularySheetNewFormat = {
  title: string;
  words: Array<{
    word: string;
    definition: string;
    example?: string;
  }>;
};

export type VocabularySheetOldFormat = Array<{
  term: string;
  meaning: string;
}>;

export type VocabularySheet = VocabularySheetNewFormat | VocabularySheetOldFormat;

// Native language options with flags (50 most popular)
export const NATIVE_LANGUAGES = [
  { value: 'Arabic', label: 'Arabic', flag: '🇸🇦' },
  { value: 'Bengali', label: 'Bengali', flag: '🇧🇩' },
  { value: 'Bulgarian', label: 'Bulgarian', flag: '🇧🇬' },
  { value: 'Catalan', label: 'Catalan', flag: '🇪🇸' },
  { value: 'Chinese', label: 'Chinese', flag: '🇨🇳' },
  { value: 'Croatian', label: 'Croatian', flag: '🇭🇷' },
  { value: 'Czech', label: 'Czech', flag: '🇨🇿' },
  { value: 'Danish', label: 'Danish', flag: '🇩🇰' },
  { value: 'Dutch', label: 'Dutch', flag: '🇳🇱' },
  { value: 'Finnish', label: 'Finnish', flag: '🇫🇮' },
  { value: 'French', label: 'French', flag: '🇫🇷' },
  { value: 'German', label: 'German', flag: '🇩🇪' },
  { value: 'Greek', label: 'Greek', flag: '🇬🇷' },
  { value: 'Hebrew', label: 'Hebrew', flag: '🇮🇱' },
  { value: 'Hindi', label: 'Hindi', flag: '🇮🇳' },
  { value: 'Hungarian', label: 'Hungarian', flag: '🇭🇺' },
  { value: 'Indonesian', label: 'Indonesian', flag: '🇮🇩' },
  { value: 'Italian', label: 'Italian', flag: '🇮🇹' },
  { value: 'Japanese', label: 'Japanese', flag: '🇯🇵' },
  { value: 'Javanese', label: 'Javanese', flag: '🇮🇩' },
  { value: 'Korean', label: 'Korean', flag: '🇰🇷' },
  { value: 'Malay', label: 'Malay', flag: '🇲🇾' },
  { value: 'Marathi', label: 'Marathi', flag: '🇮🇳' },
  { value: 'Norwegian', label: 'Norwegian', flag: '🇳🇴' },
  { value: 'Persian', label: 'Persian', flag: '🇮🇷' },
  { value: 'Polish', label: 'Polish', flag: '🇵🇱' },
  { value: 'Portuguese', label: 'Portuguese', flag: '🇵🇹' },
  { value: 'Punjabi', label: 'Punjabi', flag: '🇮🇳' },
  { value: 'Romanian', label: 'Romanian', flag: '🇷🇴' },
  { value: 'Russian', label: 'Russian', flag: '🇷🇺' },
  { value: 'Serbian', label: 'Serbian', flag: '🇷🇸' },
  { value: 'Slovak', label: 'Slovak', flag: '🇸🇰' },
  { value: 'Slovenian', label: 'Slovenian', flag: '🇸🇮' },
  { value: 'Spanish', label: 'Spanish', flag: '🇪🇸' },
  { value: 'Swahili', label: 'Swahili', flag: '🇰🇪' },
  { value: 'Swedish', label: 'Swedish', flag: '🇸🇪' },
  { value: 'Tagalog', label: 'Tagalog', flag: '🇵🇭' },
  { value: 'Tamil', label: 'Tamil', flag: '🇮🇳' },
  { value: 'Telugu', label: 'Telugu', flag: '🇮🇳' },
  { value: 'Thai', label: 'Thai', flag: '🇹🇭' },
  { value: 'Turkish', label: 'Turkish', flag: '🇹🇷' },
  { value: 'Ukrainian', label: 'Ukrainian', flag: '🇺🇦' },
  { value: 'Urdu', label: 'Urdu', flag: '🇵🇰' },
  { value: 'Vietnamese', label: 'Vietnamese', flag: '🇻🇳' },
] as const;

// Helper to normalize vocabulary sheet format
export function normalizeVocabularySheet(vocab: VocabularySheet | any) {
  if (Array.isArray(vocab)) {
    // Old format: [{ term, meaning }] or new array format [{ word, definition }]
    return vocab.map(item => ({
      word: item.word || item.term || '',
      definition: item.definition || item.meaning || '',
      example: item.example || undefined,
      cefr_level: item.cefr_level || undefined
    }));
  } else if (vocab?.words) {
    // New format: { title, words: [{ word, definition, example }] }
    return vocab.words.map((item: any) => ({
      word: item.word || '',
      definition: item.definition || '',
      example: item.example || undefined,
      cefr_level: item.cefr_level || undefined
    }));
  }
  // Fallback for unexpected format
  return [];
}
