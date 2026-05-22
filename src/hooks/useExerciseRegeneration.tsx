import { useState } from 'react';
import { toast } from 'sonner';
import { exerciseRegenerationService } from '@/services/exerciseRegenerationService';
import { devLog } from '@/utils/logger';

interface RegenerationState {
  isModalOpen: boolean;
  isLoading: boolean;
  loadingExerciseIndex: number | null;
  guidelines: string;
}

export const useExerciseRegeneration = () => {
  const [state, setState] = useState<RegenerationState>({
    isModalOpen: false,
    isLoading: false,
    loadingExerciseIndex: null,
    guidelines: ''
  });

  const openModal = (exerciseIndex: number) => {
    setState(prev => ({
      ...prev,
      isModalOpen: true,
      loadingExerciseIndex: exerciseIndex,
      guidelines: ''
    }));
  };

  const closeModal = () => {
    setState(prev => ({
      ...prev,
      isModalOpen: false,
      guidelines: ''
    }));
  };

  const setGuidelines = (guidelines: string) => {
    setState(prev => ({ ...prev, guidelines }));
  };

  const regenerateExercise = async (
    worksheetId: string,
    exerciseIndex: number,
    originalFormData: any,
    currentExercise: any,
    editableWorksheet: any,
    setEditableWorksheet: React.Dispatch<React.SetStateAction<any>>,
    userId: string
  ) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      closeModal();

      devLog('🔄 Starting exercise regeneration:', {
        worksheetId,
        exerciseIndex,
        exerciseType: currentExercise.type,
        guidelines: state.guidelines
      });

      const newExercise = await exerciseRegenerationService.regenerateExercise(
        worksheetId,
        exerciseIndex,
        originalFormData,
        currentExercise,
        state.guidelines,
        userId
      );

      const updatedExercises = [...editableWorksheet.exercises];
      updatedExercises[exerciseIndex] = newExercise;

      const updatedWorksheet = {
        ...editableWorksheet,
        exercises: updatedExercises
      };

      setEditableWorksheet(updatedWorksheet);

      await exerciseRegenerationService.updateWorksheetInDatabase(
        worksheetId,
        updatedWorksheet,
        userId
      );

      toast.success('Exercise regenerated successfully!');
      
    } catch (error) {
      console.error('Error regenerating exercise:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to regenerate exercise');
    } finally {
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        loadingExerciseIndex: null
      }));
    }
  };

  return {
    ...state,
    openModal,
    closeModal,
    setGuidelines,
    regenerateExercise
  };
};
