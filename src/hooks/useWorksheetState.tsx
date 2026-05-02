
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { FormData } from "@/components/WorksheetForm";
import { devLog } from '@/utils/logger';

export const useWorksheetState = (authLoading: boolean) => {
  const [generatedWorksheet, setGeneratedWorksheet] = useState<any>(null);
  const [editableWorksheet, setEditableWorksheet] = useState<any>(null);
  const [inputParams, setInputParams] = useState<FormData | null>(null);
  const [generationTime, setGenerationTime] = useState(0);
  const [sourceCount, setSourceCount] = useState(0);
  const [worksheetId, setWorksheetId] = useState<string | null>(null);
  const { toast } = useToast();

  // Restore worksheet state from sessionStorage on component mount
  useEffect(() => {
    const restoreWorksheetState = () => {
      try {
        const forceNewWorksheet = sessionStorage.getItem('forceNewWorksheet');
        if (forceNewWorksheet) {
          devLog('Force new worksheet flag detected - clearing all state');
          sessionStorage.removeItem('forceNewWorksheet');
          clearWorksheetStorage();
          return;
        }

        const returningFromPayment = sessionStorage.getItem('returningFromPayment');
        if (returningFromPayment) {
          sessionStorage.removeItem('returningFromPayment');
          devLog('User returning from payment, skipping restore message but proceeding with restoration.');
        }

        const savedWorksheet = sessionStorage.getItem('currentWorksheet');
        const savedEditableWorksheet = sessionStorage.getItem('currentEditableWorksheet');
        const savedInputParams = sessionStorage.getItem('currentInputParams');
        const savedGenerationTime = sessionStorage.getItem('currentGenerationTime');
        const savedSourceCount = sessionStorage.getItem('currentSourceCount');
        const savedWorksheetId = sessionStorage.getItem('currentWorksheetId');

        if (savedWorksheet && savedInputParams) {
          devLog('Restoring worksheet state from sessionStorage');
          const parsedWorksheet = JSON.parse(savedWorksheet);
          setGeneratedWorksheet(parsedWorksheet);
          
          if (savedEditableWorksheet) {
            setEditableWorksheet(JSON.parse(savedEditableWorksheet));
            devLog('Restored edited worksheet from sessionStorage');
          } else {
            setEditableWorksheet(parsedWorksheet);
          }
          
          const parsedInputParams = JSON.parse(savedInputParams);
          if (parsedInputParams.languageStyle && parsedInputParams.languageStyle > 5) {
            const oldValue = parsedInputParams.languageStyle;
            let newValue;
            if (oldValue <= 2) newValue = 1;
            else if (oldValue <= 4) newValue = 2;
            else if (oldValue <= 6) newValue = 3;
            else if (oldValue <= 8) newValue = 4;
            else newValue = 5;
            
            parsedInputParams.languageStyle = newValue;
            devLog(`Migrated language style from ${oldValue}/10 to ${newValue}/5`);
          }
          
          setInputParams(parsedInputParams);
          setGenerationTime(savedGenerationTime ? parseInt(savedGenerationTime) : 0);
          setSourceCount(savedSourceCount ? parseInt(savedSourceCount) : 0);
          setWorksheetId(savedWorksheetId);
          
          if (!returningFromPayment) {
            toast({
              title: "Worksheet restored",
              description: "Your previous worksheet has been restored.",
              className: "bg-green-50 border-green-200"
            });
          }
        }
      } catch (error) {
        console.error('Error restoring worksheet state:', error);
        clearWorksheetStorage();
      }
    };

    if (!authLoading) {
      restoreWorksheetState();
    }
  }, [authLoading, toast]);

  useEffect(() => {
    if (generatedWorksheet && inputParams) {
      try {
        sessionStorage.setItem('currentWorksheet', JSON.stringify(generatedWorksheet));
        sessionStorage.setItem('currentInputParams', JSON.stringify(inputParams));
        sessionStorage.setItem('currentGenerationTime', generationTime.toString());
        sessionStorage.setItem('currentSourceCount', sourceCount.toString());
        if (worksheetId) {
          sessionStorage.setItem('currentWorksheetId', worksheetId);
        }
        devLog('Worksheet state saved to sessionStorage');
      } catch (error) {
        console.error('Error saving worksheet state:', error);
      }
    }
  }, [generatedWorksheet, inputParams, generationTime, sourceCount, worksheetId]);

  useEffect(() => {
    if (editableWorksheet) {
      try {
        sessionStorage.setItem('currentEditableWorksheet', JSON.stringify(editableWorksheet));
        devLog('Editable worksheet saved to sessionStorage');
      } catch (error) {
        console.error('Error saving editable worksheet state:', error);
      }
    }
  }, [editableWorksheet]);

  const clearWorksheetStorage = () => {
    sessionStorage.removeItem('currentWorksheet');
    sessionStorage.removeItem('currentEditableWorksheet');
    sessionStorage.removeItem('currentInputParams');
    sessionStorage.removeItem('currentGenerationTime');
    sessionStorage.removeItem('currentSourceCount');
    sessionStorage.removeItem('currentWorksheetId');
  };

  const clearPaymentStorage = () => {
    sessionStorage.removeItem('downloadToken');
    sessionStorage.removeItem('downloadTokenExpiry');
    devLog('Payment tokens cleared from sessionStorage');
  };

  const resetWorksheetState = () => {
    setGeneratedWorksheet(null);
    setEditableWorksheet(null);
    setInputParams(null);
    setWorksheetId(null);
    clearWorksheetStorage();
    clearPaymentStorage();
  };

  const forceNewWorksheet = () => {
    devLog('Setting force new worksheet flag');
    sessionStorage.setItem('forceNewWorksheet', 'true');
    resetWorksheetState();
  };

  return {
    generatedWorksheet,
    setGeneratedWorksheet,
    editableWorksheet,
    setEditableWorksheet,
    inputParams,
    setInputParams,
    generationTime,
    setGenerationTime,
    sourceCount,
    setSourceCount,
    worksheetId,
    setWorksheetId,
    clearWorksheetStorage,
    resetWorksheetState,
    forceNewWorksheet
  };
};
