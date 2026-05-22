
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SubmitFeedbackRequest } from './validation.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export interface FeedbackRecord {
  id: string;
  worksheet_id: string;
  user_id: string;
  rating: number;
  comment: string;
  status: string;
  created_at: string;
}

export async function submitFeedbackToDatabase(feedbackData: SubmitFeedbackRequest): Promise<{ success: boolean; data?: FeedbackRecord; error?: string }> {
  try {
    console.log('Submitting feedback to database:', {
      worksheet_id: feedbackData.worksheetId,
      user_id: feedbackData.userId,
      rating: feedbackData.rating,
      status: feedbackData.status
    });

    const { data, error } = await supabase
      .from('feedbacks')
      .insert([
        {
          worksheet_id: feedbackData.worksheetId,
          user_id: feedbackData.userId,
          rating: feedbackData.rating,
          comment: feedbackData.comment,
          status: feedbackData.status
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return { success: false, error: error.message };
    }

    console.log('Feedback successfully inserted:', data);
    return { success: true, data };

  } catch (error) {
    console.error('Unexpected database error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    };
  }
}

export async function checkExistingFeedback(worksheetId: string, userId: string): Promise<{ exists: boolean; feedback?: FeedbackRecord; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('worksheet_id', worksheetId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error checking existing feedback:', error);
      return { exists: false, error: error.message };
    }

    return { exists: !!data, feedback: data };

  } catch (error) {
    console.error('Unexpected error checking feedback:', error);
    return { 
      exists: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function updateExistingFeedback(feedbackId: string, updateData: Partial<SubmitFeedbackRequest>): Promise<{ success: boolean; data?: FeedbackRecord; error?: string }> {
  try {
    console.log('Updating existing feedback:', feedbackId, updateData);

    const { data, error } = await supabase
      .from('feedbacks')
      .update(updateData)
      .eq('id', feedbackId)
      .select()
      .single();

    if (error) {
      console.error('Error updating feedback:', error);
      return { success: false, error: error.message };
    }

    console.log('Feedback successfully updated:', data);
    return { success: true, data };

  } catch (error) {
    console.error('Unexpected error updating feedback:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
