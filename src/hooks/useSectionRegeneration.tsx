import { useState } from 'react';
import { toast } from 'sonner';
import { exerciseRegenerationService } from '@/services/exerciseRegenerationService';
import { devLog } from '@/utils/logger';

interface SectionRegenerationState {
  isModalOpen: boolean;
  isLoading: boolean;
  loadingSectionType: 'warmup' | 'grammar' | null;
  guidelines: string;
}

export const useSectionRegeneration = () => {
  const [state, setState] = useState<SectionRegenerationState>({
    isModalOpen: false,
    isLoading: false,
    loadingSectionType: null,
    guidelines: ''
  });

  const openModal = (sectionType: 'warmup' | 'grammar') => {
    setState(prev => ({
      ...prev,
      isModalOpen: true,
      loadingSectionType: sectionType,
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

  const regenerateSection = async (
    worksheetId: string,
    sectionType: 'warmup' | 'grammar',
    originalFormData: any,
    currentSectionData: any,
    editableWorksheet: any,
    setEditableWorksheet: React.Dispatch<React.SetStateAction<any>>,
    userId: string
  ) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      closeModal();

      devLog('🔄 Starting section regeneration:', {
        worksheetId,
        sectionType,
        guidelines: state.guidelines
      });

      let updatedWorksheet;

      if (sectionType === 'warmup') {
        const newWarmupQuestions = await exerciseRegenerationService.regenerateWarmupSection(
          worksheetId,
          originalFormData,
          currentSectionData,
          state.guidelines,
          userId
        );

        updatedWorksheet = {
          ...editableWorksheet,
          warmup_questions: newWarmupQuestions
        };
      } else {
        const newGrammarRules = await exerciseRegenerationService.regenerateGrammarSection(
          worksheetId,
          originalFormData,
          currentSectionData,
          state.guidelines,
          userId
        );

        updatedWorksheet = {
          ...editableWorksheet,
          grammar_rules: newGrammarRules
        };
      }

      setEditableWorksheet(updatedWorksheet);

      await exerciseRegenerationService.updateWorksheetInDatabase(
        worksheetId,
        updatedWorksheet,
        userId
      );

      toast.success(`${sectionType === 'warmup' ? 'Warmup' : 'Grammar'} section regenerated successfully!`);
      
    } catch (error) {
      console.error('Error regenerating section:', error);
      toast.error(error instanceof Error ? error.message : `Failed to regenerate ${sectionType} section`);
    } finally {
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        loadingSectionType: null
      }));
    }
  };

  return {
    ...state,
    openModal,
    closeModal,
    setGuidelines,
    regenerateSection
  };
};
