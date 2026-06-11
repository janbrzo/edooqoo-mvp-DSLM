
export type LessonTime = "45min" | "60min"; // Changed from "45 min" | "60 min" to match timeCalculator
export type EnglishLevel = "A1/A2" | "B1/B2" | "C1/C2";
export type ExerciseSelectionMode = "manual" | "random" | "smart";
export type MediaType = "video" | "audio" | "picture";

export type Tile = {
  id: string;
  title: string;
};

export interface FormData {
  lessonTime: LessonTime;
  lessonTopic: string;
  lessonGoal: string;
  teachingPreferences: string;
  additionalInformation?: string;
  englishLevel?: EnglishLevel;
  languageStyle?: number; // 1-10 scale: 1=very casual, 10=very formal
  fullPrompt?: string;
  formDataForStorage?: any;
  studentId?: string;
  selectedExercises?: string[]; // Optional array of exercise types
  selectionMode?: ExerciseSelectionMode; // New field for future use
  selectedMediaTypes?: MediaType[]; // New field for future media integration
  // NEW: Pre-calculated requirements for GeneratingModal
  requiresAudio?: boolean;  // Whether audio is required by selected exercises
  requiresImage?: boolean;  // Whether image is required by selected exercises
  hasGrammar?: boolean;     // Whether grammar focus was provided
  // v6.9.45 — internal transport flags, not part of the AI prompt.
  __autoGenerateFromSuggestion?: boolean;
  __tokenRetry?: number;
  // v6.9.47 — correlation id so Index.tsx can ack/refuse the auto-generate
  // request before the form drops sessionStorage flags.
  __autoGenerateRequestId?: string;
  // v6.9.53 — carry suggestionId through the FormData payload so the
  // generation hook can flip `future_worksheet_suggestions.is_used` even when
  // sessionStorage was cleared between intent write and completion.
  __autoGenerateSuggestionId?: string | null;
  // v6.9.55 — UI/transport metadata (NOT prompt input). Used by
  // `GeneratingModal` to show "For Evelyn H · evelyn@example.com" without
  // depending on fragile sessionStorage round-trips. Never injected into
  // the AI prompt by `format-worksheet-prompt`.
  studentName?: string | null;
  studentEmail?: string | null;
  // v6.9.55 — Stable id correlating a single client generation attempt
  // with the saved `worksheets.form_data.clientGenerationId`. Used by
  // post-stream reconciliation polling (problems 3 + 4) so we can mark
  // suggestions used / consume tokens only when a real worksheet row
  // for THIS attempt exists. Never part of the AI prompt input.
  clientGenerationId?: string;
  selectedImage?: {
    id: string;
    url: string;
    thumbnail: string;
    description: string;
    detailedDescription?: string;
    photographer: string;
    photographerUrl: string;
    source?: string;
    ai_generated_url?: string;
    generationPrompt?: string;
    topic?: string;
    englishLevel?: string;
  };
  exerciseFocusMap?: Record<string, 'vocabulary' | 'grammar'>;
  selectedAudio?: {
    id: string;
    url: string;
    ai_generated_audio_url?: string;
    transcript?: string;
    detailedTranscript?: string;
    duration?: number;
    voice?: string;
    source?: string;
    generationPrompt?: string;
    topic?: string;
    englishLevel?: string;
  };
}

export interface WorksheetData {
  title: string;
  subtitle: string;
  introduction: string;
  warmup_questions?: string[];
  exercises: any[];
  vocabulary_sheet: {
    term: string;
    meaning: string;
  }[];
}

export interface WorksheetFormProps {
  onSubmit: (data: FormData) => void;
}
