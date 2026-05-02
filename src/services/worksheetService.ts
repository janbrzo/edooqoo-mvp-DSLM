
import { supabase } from '@/integrations/supabase/client';
import { FormData as WorksheetFormData } from '@/components/WorksheetForm';
import { generateWorksheetAPI } from './worksheetService/apiService';
import { submitFeedbackAPI, updateFeedbackAPI } from './worksheetService/feedbackService';
import { trackWorksheetEventAPI } from './worksheetService/trackingService';
import { updateWorksheetAPI, updateWorksheetStudentAPI } from './worksheetService/updateService';

/**
 * Main service export for worksheet functionality
 */
export { 
  generateWorksheet,
  submitFeedback, 
  updateFeedback, 
  trackWorksheetEvent,
  updateWorksheet,
  updateWorksheetStudent
};

/**
 * Generates a worksheet using the Edge Function
 */
async function generateWorksheet(prompt: WorksheetFormData & { fullPrompt?: string, formDataForStorage?: any, studentId?: string }, userId: string) {
  return generateWorksheetAPI(prompt, userId);
}

/**
 * Updates a worksheet with edited content
 */
async function updateWorksheet(worksheetId: string, editableWorksheet: any, userId: string) {
  return updateWorksheetAPI(worksheetId, editableWorksheet, userId);
}

/**
 * Updates the student assignment for a worksheet
 */
async function updateWorksheetStudent(worksheetId: string, studentId: string | null, userId: string) {
  return updateWorksheetStudentAPI(worksheetId, studentId, userId);
}

/**
 * Submits feedback for a worksheet
 */
async function submitFeedback(worksheetId: string, rating: number, comment: string, userId: string) {
  return submitFeedbackAPI(worksheetId, rating, comment, userId);
}

/**
 * Updates existing feedback with a comment
 */
async function updateFeedback(id: string, comment: string, userId: string) {
  return updateFeedbackAPI(id, comment, userId);
}

/**
 * Tracks an event (view, download, etc.)
 */
async function trackWorksheetEvent(type: string, worksheetId: string, userId: string, metadata: any = {}) {
  return trackWorksheetEventAPI(type, worksheetId, userId, metadata);
}
