
import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/utils/logger';

/**
 * Tracks an event (view, download, etc.)
 */
export async function trackWorksheetEventAPI(type: string, worksheetId: string, userId: string, metadata: any = {}) {
  try {
    // Skip tracking if worksheetId is not a valid UUID
    if (!worksheetId || worksheetId.length < 10) {
      devLog(`Skipping ${type} event tracking for invalid worksheetId: ${worksheetId}`);
      return;
    }
    
    devLog(`Tracking event: ${type} for worksheet: ${worksheetId}`);
    
    try {
      // For download events, increment the download counter
      if (type === 'download') {
        try {
          devLog(`Attempting to increment download count for worksheet: ${worksheetId}`);
          
          // Use the dedicated function for incrementing download count
          const { data, error } = await supabase.rpc('increment_worksheet_download_count', {
            p_worksheet_id: worksheetId
          });
          
          if (error) {
            console.error(`RPC function error: ${error.message}`);
            // Fallback: try simple increment by fetching current value and updating
            const { data: currentData, error: fetchError } = await supabase
              .from('worksheets')
              .select('download_count')
              .eq('id', worksheetId)
              .single();
            
            if (!fetchError && currentData) {
              const newCount = (currentData.download_count || 0) + 1;
              const { error: updateError } = await supabase
                .from('worksheets')
                .update({ 
                  download_count: newCount,
                  last_modified_at: new Date().toISOString()
                })
                .eq('id', worksheetId);
              
              if (!updateError) {
                devLog(`Download count updated to ${newCount} for worksheet: ${worksheetId}`);
              } else {
                console.error(`Update error: ${updateError.message}`);
              }
            }
          } else {
            devLog(`Download count incremented via RPC for worksheet: ${worksheetId}`, data);
          }
        } catch (countError) {
          console.error(`Failed to increment download count: ${countError}`);
        }
      }
      
      // For view events, update the last_modified_at timestamp
      if (type === 'view') {
        try {
          await supabase
            .from('worksheets')
            .update({ 
              last_modified_at: new Date().toISOString() 
            })
            .eq('id', worksheetId);
          devLog(`Last viewed timestamp updated for worksheet: ${worksheetId}`);
        } catch (viewError) {
          console.error(`Failed to update view timestamp: ${viewError}`);
        }
      }
    } catch (innerError) {
      console.error(`Error in event tracking flow: ${innerError}`);
    }
  } catch (error) {
    console.error(`Error tracking ${type} event:`, error);
  }
}
