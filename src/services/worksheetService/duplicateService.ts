import { supabase } from '@/integrations/supabase/client';

/**
 * Duplicates a worksheet - creates a 1:1 copy with a new student assignment
 */
export async function duplicateWorksheetAPI(
  originalWorksheetId: string,
  newStudentId: string | null,
  userId: string
): Promise<{ success: boolean; worksheetId?: string; error?: string }> {
  try {
    console.log('🔄 Duplicating worksheet:', { originalWorksheetId, newStudentId, userId });
    
    // 1. Fetch the original worksheet
    const { data: original, error: fetchError } = await supabase
      .from('worksheets')
      .select('*')
      .eq('id', originalWorksheetId)
      .eq('teacher_id', userId)
      .maybeSingle();
    
    if (fetchError) {
      console.error('❌ Error fetching original worksheet:', fetchError);
      return { success: false, error: `Failed to fetch worksheet: ${fetchError.message}` };
    }
    
    if (!original) {
      console.error('❌ Worksheet not found:', originalWorksheetId);
      return { success: false, error: 'Worksheet not found or access denied' };
    }
    
    // 2. Prepare duplicate data - remove id, timestamps, update student_id
    const { 
      id, 
      created_at, 
      last_modified_at, 
      sequence_number, 
      ...worksheetData 
    } = original;
    
    const duplicateData = {
      ...worksheetData,
      student_id: newStudentId,
      teacher_id: userId,
      title: original.title,
      status: 'copy',
      // Reset download count and share token for the copy
      download_count: 0,
      share_token: null
    };
    
    console.log('📝 Duplicate data prepared:', { 
      originalTitle: original.title,
      newTitle: duplicateData.title,
      newStudentId
    });
    
    // 3. Insert the duplicate
    const { data: newWorksheet, error: insertError } = await supabase
      .from('worksheets')
      .insert(duplicateData)
      .select('id, title, student_id, created_at')
      .maybeSingle();
    
    if (insertError) {
      console.error('❌ Error inserting duplicate worksheet:', insertError);
      return { success: false, error: `Failed to create duplicate: ${insertError.message}` };
    }
    
    if (!newWorksheet) {
      console.error('❌ Insert returned no data');
      return { success: false, error: 'Failed to create duplicate worksheet' };
    }
    
    console.log('✅ Worksheet duplicated successfully:', newWorksheet);
    return { success: true, worksheetId: newWorksheet.id };
    
  } catch (error: any) {
    console.error('💥 Duplicate worksheet error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
