// ============================================
// FAZA 2: Interactive Shared Worksheets - TypeScript Types
// ============================================

import { ExerciseAnswers } from './interactiveHomework';

/**
 * Represents a student's answers for a shared worksheet exercise
 * Maps to worksheet_student_answers table
 */
export interface WorksheetStudentAnswer {
  id: string;
  worksheet_id: string;
  student_email: string;
  exercise_index: number;
  exercise_type: string;
  answers: ExerciseAnswers;
  is_completed: boolean;
  started_at: string; // ISO timestamp
  last_saved_at: string; // ISO timestamp
  completed_at: string | null; // ISO timestamp
}

/**
 * State for managing interactive shared worksheet in the frontend
 */
export interface InteractiveSharedWorksheetState {
  worksheetId: string;
  studentEmail: string;
  answers: Record<number, ExerciseAnswers>; // exerciseIndex -> answers
  isSaving: boolean;
  lastSavedAt: Date | null;
  isStudyMode: boolean;
}

/**
 * Progress information for shared worksheet completion
 */
export interface SharedWorksheetProgress {
  totalExercises: number;
  answeredExercises: number;
  percentageComplete: number;
  totalTasks: number;
  answeredTasks: number;
}

/**
 * Props for SharedWorksheet component with interactive mode
 */
export interface SharedWorksheetData {
  id: string;
  title: string;
  ai_response: string;
  html_content: string;
  created_at: string;
  teacher_email: string;
  student_id?: string;
  share_recipient_email?: string;
  selected_image?: any;
  selected_audio?: any;
  audio_url?: string;
}

/**
 * Live session answer from Realtime subscription
 */
export interface LiveSessionAnswer {
  id: string;
  student_email: string;
  exercise_index: number;
  exercise_type: string;
  answers: ExerciseAnswers;
  last_saved_at: string;
}
