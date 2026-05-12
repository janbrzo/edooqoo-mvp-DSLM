/**
 * Prompt composer - combines all prompt parts into the complete system message
 */

import { getCoreInstructions } from './core-instructions.ts';
import { getExerciseTemplates } from './exercise-templates.ts';
import { getFinalRequirements } from './final-requirements.ts';
import { normalizeExerciseId } from '../helpers.ts';

export const composeSystemMessage = (
  hasGrammarFocus: boolean, 
  grammarFocus: string | null, 
  formData: any, 
  exerciseCount: number = 8, 
  selectedExercises?: string[],
  selectedImage?: any,
  selectedAudio?: any,
  exerciseFocusMap?: Record<string, string>
): string => {
  // ✅ Pass ORIGINAL selectedExercises (with -picture or -audio suffix) to ALL functions
  const coreInstructions = getCoreInstructions(hasGrammarFocus, grammarFocus, formData, exerciseCount, selectedExercises, selectedImage, selectedAudio, exerciseFocusMap);
  
  // ✅ Pass ORIGINAL exercises - exerciseTemplates will normalize internally for lookup
  const exerciseTemplates = getExerciseTemplates(hasGrammarFocus, grammarFocus, exerciseCount, selectedExercises, !!selectedImage, !!selectedAudio);
  
  // ✅ Pass ORIGINAL selectedExercises (with -picture or -audio) to finalRequirements
  const finalRequirements = getFinalRequirements(hasGrammarFocus, exerciseCount, selectedExercises, formData.englishLevel, !!selectedImage, !!selectedAudio);
  
  return `${coreInstructions}

${exerciseTemplates}

${finalRequirements}`;
};