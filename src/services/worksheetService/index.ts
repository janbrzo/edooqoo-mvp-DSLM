
import { supabase } from '@/integrations/supabase/client';
import { FormData as WorksheetFormData } from '@/components/WorksheetForm';
import { generateWorksheetAPI } from './apiService';
import { submitFeedbackAPI, updateFeedbackAPI } from './feedbackService';
import { trackWorksheetEventAPI } from './trackingService';
import { duplicateWorksheetAPI } from './duplicateService';

/**
 * Main service export for worksheet functionality
 */
export { 
  generateWorksheet,
  submitFeedback, 
  updateFeedback, 
  trackWorksheetEvent,
  duplicateWorksheet
};

/**
 * Generates a worksheet using the Edge Function
 */
async function generateWorksheet(prompt: WorksheetFormData & { fullPrompt?: string, formDataForStorage?: any, studentId?: string }, userId: string) {
  const result = await generateWorksheetAPI(prompt, userId);
  
  // Update student activity if studentId is provided
  if (prompt.studentId) {
    try {
      await supabase
        .from('students')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', prompt.studentId);
      
      // Emit event to notify other components
      window.dispatchEvent(new CustomEvent('studentUpdated', { detail: { studentId: prompt.studentId } }));
    } catch (error) {
      console.error('Error updating student activity:', error);
    }
  }
  
  return result;
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

/**
 * Duplicates a worksheet with a new student assignment
 */
async function duplicateWorksheet(originalWorksheetId: string, newStudentId: string | null, userId: string) {
  return duplicateWorksheetAPI(originalWorksheetId, newStudentId, userId);
}
