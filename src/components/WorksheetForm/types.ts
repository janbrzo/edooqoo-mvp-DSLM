
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
