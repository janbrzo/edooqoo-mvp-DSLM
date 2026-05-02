
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// URL for the Edge Function
const SUBMIT_FEEDBACK_URL = 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/submitFeedback';

/**
 * Submits feedback for a worksheet
 */
export async function submitFeedbackAPI(worksheetId: string, rating: number, comment: string, userId: string) {
  try {
    console.log('Submitting feedback:', { worksheetId, rating, comment, userId });
    
    if (!worksheetId || !userId) {
      console.error('Missing required parameters for feedback:', { worksheetId, userId });
      throw new Error('Missing worksheet ID or user ID');
    }
    
    // Try using the edge function first
    try {
      const response = await fetch(SUBMIT_FEEDBACK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          worksheetId,
          rating,
          comment,
          userId,
          status: 'submitted' // Ensure status is set to 'submitted'
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Feedback submission successful via API:', result);
        toast.success('Thank you for your feedback!');
        return result.data;
      }
      
      const errorText = await response.text();
      console.error('Error submitting feedback via API:', errorText);
    } catch (apiError) {
      console.error('API feedback submission error:', apiError);
    }
    
    // If edge function fails, try direct database submission
    const { data, error } = await supabase
      .from('feedbacks')
      .insert([
        { 
          worksheet_id: worksheetId, 
          user_id: userId, 
          rating, 
          comment,
          status: 'submitted'
        }
      ])
      .select();
      
    if (error) {
      console.error('Direct feedback submission error:', error);
      
      // If direct insert fails and we don't have a worksheet_id, try creating a placeholder
      if (error.message.includes('violates foreign key constraint')) {
        console.log('Creating placeholder worksheet for feedback');
        
        const { data: placeholderData, error: placeholderError } = await supabase
          .from('worksheets')
          .insert([
            {
              prompt: 'Generated worksheet',
              form_data: JSON.stringify({ title: 'Generated Worksheet' }),
              ai_response: 'Placeholder response',
              html_content: JSON.stringify({ title: 'Generated Worksheet', exercises: [] }),
              user_id: userId,
              ip_address: 'client-side',
              status: 'created',
              title: 'Generated Worksheet'
            }
          ])
          .select();
          
        if (placeholderError) {
          console.error('Error creating placeholder worksheet:', placeholderError);
          throw new Error('Failed to create feedback record: worksheet reference is required');
        }
          
        if (placeholderData && placeholderData.length > 0) {
          // Try feedback again with new worksheet ID
          const { data: retryData, error: retryError } = await supabase
            .from('feedbacks')
            .insert([
              { 
                worksheet_id: placeholderData[0].id, 
                user_id: userId, 
                rating, 
                comment,
                status: 'submitted'
              }
            ])
            .select();
              
          if (retryError) {
            console.error('Retry feedback submission error:', retryError);
            throw new Error(`Failed to submit feedback after retry: ${retryError.message}`);
          }
            
          toast.success('Thank you for your feedback!');
          return retryData;
        }
      } else {
        throw new Error(`Failed to submit feedback: ${error.message}`);
      }
    }
      
    toast.success('Thank you for your feedback!');
    return data;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    toast.error(`We couldn't submit your rating: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Updates existing feedback with a comment
 */
export async function updateFeedbackAPI(id: string, comment: string, userId: string) {
  try {
    console.log('Updating feedback with comment:', { id, comment });

    const { data, error } = await supabase
      .from('feedbacks')
      .update({ comment })
      .eq('id', id)
      .eq('user_id', userId)
      .select();
      
    if (error) {
      console.error('Error updating feedback:', error);
      throw new Error(`Failed to update feedback: ${error.message}`);
    }
    
    console.log('Feedback updated successfully:', data);
    return data;
  } catch (error) {
    console.error('Error updating feedback:', error);
    throw error;
  }
}
