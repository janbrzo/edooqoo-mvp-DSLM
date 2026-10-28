import { useState } from 'react';
import { toast } from 'sonner';
import { exerciseRegenerationService } from '@/services/exerciseRegenerationService';
import { chargeExerciseAction } from '@/services/exerciseCreditService';
import { devLog, devWarn } from '@/utils/logger';
import { useDemoContext } from '@/contexts/DemoContext';
import type { LessonMedia } from '@/lib/worksheetEditor/lessonMedia';

interface RegenerationState {
  isModalOpen: boolean;
  isLoading: boolean;
  loadingExerciseIndex: number | null;
  guidelines: string;
}

export const useExerciseRegeneration = () => {
  const { isDemoMode, showDemoBlockedToast } = useDemoContext();
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
    userId: string,
    options?: {
      lessonMedia?: LessonMedia | null;
      /** Latest worksheet state: the regeneration takes long and the teacher may keep editing. */
      getLatestWorksheet?: () => any;
    }
  ) => {
    if (isDemoMode) {
      showDemoBlockedToast('Regenerating exercises');
      closeModal();
      return;
    }
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
        userId,
        options?.lessonMedia
      );

      const replaceExercise = (worksheet: any) => {
        const exercises = [...(worksheet?.exercises ?? [])];
        exercises[exerciseIndex] = newExercise;
        return { ...worksheet, exercises };
      };

      const updatedWorksheet = replaceExercise(options?.getLatestWorksheet?.() ?? editableWorksheet);

      setEditableWorksheet((prev: any) => replaceExercise(prev ?? editableWorksheet));

      await exerciseRegenerationService.updateWorksheetInDatabase(
        worksheetId,
        updatedWorksheet,
        userId
      );

      // Charged only now: the new exercise was generated and saved. Never blocks or throws.
      await chargeExerciseAction({ worksheetId, action: 'regenerate_exercise', isDemo: isDemoMode });

      toast.success('Exercise regenerated successfully!');
      
    } catch (error) {
      devWarn('Error regenerating exercise:', error);
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
