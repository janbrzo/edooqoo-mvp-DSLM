
import { useState } from 'react';
import { updateWorksheetStudentAPI } from '@/services/worksheetService/updateService';
import { toast } from '@/hooks/use-toast';
import { devLog } from '@/utils/logger';

export const useStudentSelector = (onSuccess?: () => void) => {
  const [isLoading, setIsLoading] = useState(false);

  const updateWorksheetStudent = async (
    worksheetId: string, 
    newStudentId: string | null, 
    userId: string,
    worksheetTitle?: string,
    newStudentName?: string
  ) => {
    if (!userId) {
      toast({
        title: "Error",
        description: "You must be logged in to transfer worksheets",
        variant: "destructive"
      });
      return false;
    }

    setIsLoading(true);
    
    try {
      devLog('🔄 Updating worksheet student:', { worksheetId, newStudentId, userId });
      
      const result = await updateWorksheetStudentAPI(worksheetId, newStudentId, userId);
      
      if (result.success) {
        const message = newStudentId && newStudentName 
          ? `Worksheet "${worksheetTitle || 'Untitled'}" moved to ${newStudentName}`
          : `Worksheet "${worksheetTitle || 'Untitled'}" unassigned from student`;
          
        toast({
          title: "Success",
          description: message,
        });
        
        if (onSuccess) {
          onSuccess();
        }
        
        return true;
      }
    } catch (error: any) {
      console.error('❌ Error updating worksheet student:', error);
      toast({
        title: "Error", 
        description: error.message || "Failed to transfer worksheet",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
    
    return false;
  };

  return {
    updateWorksheetStudent,
    isLoading
  };
};
