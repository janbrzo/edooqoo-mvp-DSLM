import { supabase } from '@/integrations/supabase/client';
import { updateWorksheetAPI } from './worksheetService/updateService';
import { devLog } from '@/utils/logger';

// URLs for the Edge Functions
const REGENERATE_EXERCISE_URL = 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/generateWorksheet';

interface RegenerateExerciseRequest {
  worksheetId: string;
  exerciseIndex: number;
  originalFormData: any;
  currentExercise: any;
  additionalGuidelines: string;
  userId: string;
}

class ExerciseRegenerationService {
  async regenerateExercise(
    worksheetId: string,
    exerciseIndex: number,
    originalFormData: any,
    currentExercise: any,
    additionalGuidelines: string,
    userId: string
  ) {
    try {
      devLog('📤 [REGENERATE] Sending regeneration request to Edge Function');
      devLog('📝 [REGENERATE] Worksheet ID:', worksheetId);
      devLog('📝 [REGENERATE] Exercise index:', exerciseIndex);
      devLog('📝 [REGENERATE] Exercise type:', currentExercise.type);
      devLog('📝 [REGENERATE] Exercise title:', currentExercise.title);
      devLog('📝 [REGENERATE] Additional guidelines:', additionalGuidelines || '(none)');
      devLog('📝 [REGENERATE] Has audio_transcript:', !!originalFormData.audio_transcript);
      devLog('📝 [REGENERATE] Has image description:', !!originalFormData.selected_image?.description);
      devLog('📝 [REGENERATE] User ID:', userId);

      // Create a specific prompt for single exercise regeneration
      const regenerationPrompt = this.createRegenerationPrompt(
        originalFormData,
        currentExercise,
        additionalGuidelines
      );

      devLog('🔄 Regeneration prompt (length:', regenerationPrompt.length, 'chars)');

      const requestBody = {
        prompt: regenerationPrompt,
        formData: {
          ...originalFormData,
          regenerationMode: true,
          targetExerciseType: currentExercise.type,
          exerciseIndex
        },
        userId,
        isRegeneration: true
      };
      
      devLog('📤 [REGENERATE] Request body:', {
        promptLength: regenerationPrompt.length,
        formDataKeys: Object.keys(requestBody.formData),
        targetExerciseType: currentExercise.type,
        exerciseIndex,
        isRegeneration: true
      });

      const response = await fetch(REGENERATE_EXERCISE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      devLog('📥 [REGENERATE] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('❌ [REGENERATE] Error response:', errorData);
        throw new Error(errorData?.error || `Failed to regenerate exercise: ${response.statusText}`);
      }

      const result = await response.json();
      devLog('📦 [REGENERATE] Response data:', {
        hasExercises: !!result.exercises,
        exercisesCount: result.exercises?.length || 0,
        firstExerciseType: result.exercises?.[0]?.type
      });
      
      // Extract the single exercise from the response
      if (result.exercises && result.exercises.length > 0) {
        const newExercise = result.exercises[0];
        
        // Ensure the exercise has the correct index-based title
        newExercise.title = `Exercise ${exerciseIndex + 1}: ${newExercise.type.charAt(0).toUpperCase() + newExercise.type.slice(1).replace(/-/g, ' ')}`;
        
        devLog('✅ [REGENERATE] Exercise regenerated successfully:', {
          type: newExercise.type,
          title: newExercise.title,
          hasInstructions: !!newExercise.instructions,
          hasContent: !!newExercise.content
        });
        return newExercise;
      } else {
        console.error('❌ [REGENERATE] No exercises in response:', result);
        throw new Error('No exercises returned from regeneration');
      }

    } catch (error) {
      console.error('❌ [REGENERATE] Error in exercise regeneration:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async updateWorksheetInDatabase(
    worksheetId: string,
    updatedWorksheet: any,
    userId: string
  ) {
    try {
      devLog('💾 Updating worksheet in database');
      await updateWorksheetAPI(worksheetId, updatedWorksheet, userId);
      devLog('✅ Worksheet updated successfully in database');
    } catch (error) {
      console.error('❌ Error updating worksheet in database:', error);
      throw error;
    }
  }

  private createRegenerationPrompt(
    originalFormData: any,
    currentExercise: any,
    additionalGuidelines: string
  ): string {
    const baseInfo = `
Lesson Topic: ${originalFormData.lessonTopic || 'Not specified'}
Lesson Goal: ${originalFormData.lessonGoal || 'Not specified'}
English Level: ${originalFormData.englishLevel || 'Not specified'}
Lesson Duration: ${originalFormData.lessonTime || '60min'}
`;

    // ✅ Add audio transcript if exercise is audio-related
    let mediaContext = '';
    const isAudioExercise = currentExercise.type?.includes('audio') || 
                           currentExercise.type === 'listening-comprehension' ||
                           currentExercise.type === 'true-false-audio';
    const isImageExercise = currentExercise.type?.includes('picture') || 
                           currentExercise.type === 'describe-picture' ||
                           currentExercise.type === 'answer-questions-picture';

    if (isAudioExercise && originalFormData.audio_transcript) {
      mediaContext += `
AUDIO TRANSCRIPT (use this as base for audio-related exercises):
${originalFormData.audio_transcript}
`;
    }

    if (isImageExercise && originalFormData.selected_image?.description) {
      mediaContext += `
IMAGE DESCRIPTION (use this as base for image-related exercises):
${originalFormData.selected_image.description}
`;
    }

    const exerciseInfo = `
REGENERATE SINGLE EXERCISE:
- Exercise Type: ${currentExercise.type}
- Current Exercise Title: ${currentExercise.title}
- Current Instructions: ${currentExercise.instructions}
`;

    const guidelines = additionalGuidelines 
      ? `\nADDITIONAL GUIDELINES:\n${additionalGuidelines}`
      : '';

    const regenerationInstructions = `
IMPORTANT: Generate ONLY ONE exercise of type "${currentExercise.type}". 
The exercise should be completely new and different from the current one, but maintain the same structure and quality standards.
${mediaContext ? 'Use the provided audio transcript or image description as the base content for this exercise.' : ''}
Return the response in the same JSON format as a full worksheet, but with only one exercise in the exercises array.
`;

    return baseInfo + mediaContext + exerciseInfo + guidelines + regenerationInstructions;
  }

  // Regenerate Warmup Section
  async regenerateWarmupSection(
    worksheetId: string,
    originalFormData: any,
    currentWarmupQuestions: string[],
    additionalGuidelines: string,
    userId: string
  ): Promise<string[]> {
    try {
      devLog('📤 Sending warmup regeneration request to Edge Function');

      const regenerationPrompt = this.createWarmupRegenerationPrompt(
        originalFormData,
        currentWarmupQuestions,
        additionalGuidelines
      );

      devLog('🔄 Warmup regeneration prompt:', regenerationPrompt);

      const response = await fetch(REGENERATE_EXERCISE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: regenerationPrompt,
          formData: {
            ...originalFormData,
            regenerationMode: true,
            targetSectionType: 'warmup'
          },
          userId,
          isRegeneration: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to regenerate warmup: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.warmup_questions && result.warmup_questions.length > 0) {
        devLog('✅ Warmup questions regenerated successfully');
        return result.warmup_questions;
      } else {
        throw new Error('No warmup questions returned from regeneration');
      }

    } catch (error) {
      console.error('❌ Error in warmup regeneration:', error);
      throw error;
    }
  }

  // Regenerate Grammar Section
  async regenerateGrammarSection(
    worksheetId: string,
    originalFormData: any,
    currentGrammarRules: any,
    additionalGuidelines: string,
    userId: string
  ): Promise<any> {
    try {
      devLog('📤 Sending grammar regeneration request to Edge Function');

      const regenerationPrompt = this.createGrammarRegenerationPrompt(
        originalFormData,
        currentGrammarRules,
        additionalGuidelines
      );

      devLog('🔄 Grammar regeneration prompt:', regenerationPrompt);

      const response = await fetch(REGENERATE_EXERCISE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: regenerationPrompt,
          formData: {
            ...originalFormData,
            regenerationMode: true,
            targetSectionType: 'grammar'
          },
          userId,
          isRegeneration: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to regenerate grammar: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.grammar_rules) {
        devLog('✅ Grammar rules regenerated successfully');
        return result.grammar_rules;
      } else {
        throw new Error('No grammar rules returned from regeneration');
      }

    } catch (error) {
      console.error('❌ Error in grammar regeneration:', error);
      throw error;
    }
  }

  private createWarmupRegenerationPrompt(
    originalFormData: any,
    currentWarmupQuestions: string[],
    additionalGuidelines: string
  ): string {
    const baseInfo = `
Lesson Topic: ${originalFormData.lessonTopic || 'Not specified'}
Lesson Goal: ${originalFormData.lessonGoal || 'Not specified'}
English Level: ${originalFormData.englishLevel || 'Not specified'}
Lesson Duration: ${originalFormData.lessonTime || '60min'}
Language Style: ${originalFormData.languageStyle || '3'}
`;

    const warmupInfo = `
REGENERATE WARMUP SECTION:
Current warmup questions (as JSON for reference):
${JSON.stringify(currentWarmupQuestions, null, 2)}
`;

    const guidelines = additionalGuidelines 
      ? `\nADDITIONAL GUIDELINES FROM TEACHER:\n${additionalGuidelines}\n`
      : '';

    const regenerationInstructions = `
CRITICAL INSTRUCTIONS FOR WARMUP REGENERATION:
1. Generate COMPLETELY NEW warmup questions that are different from the current ones shown above
2. Questions should be engaging, relevant to the lesson topic, goal, and appropriate for the English level
3. Create exactly 4 warmup questions
4. Return ONLY a JSON object with this structure: {"warmup_questions": ["question1", "question2", "question3", "question4"]}
5. DO NOT include any other fields or data in the response - ONLY warmup_questions

IMPORTANT: The entire response must be a valid JSON object containing only the warmup_questions field.
`;

    return baseInfo + warmupInfo + guidelines + regenerationInstructions;
  }

  private createGrammarRegenerationPrompt(
    originalFormData: any,
    currentGrammarRules: any,
    additionalGuidelines: string
  ): string {
    const baseInfo = `
Lesson Topic: ${originalFormData.lessonTopic || 'Not specified'}
Lesson Goal: ${originalFormData.lessonGoal || 'Not specified'}
English Level: ${originalFormData.englishLevel || 'Not specified'}
Lesson Duration: ${originalFormData.lessonTime || '60min'}
Grammar Focus: ${originalFormData.teachingPreferences || 'Not specified'}
Language Style: ${originalFormData.languageStyle || '3'}
`;

    const grammarInfo = `
REGENERATE GRAMMAR RULES SECTION:
Current grammar rules (complete structure as JSON for reference):
${JSON.stringify(currentGrammarRules, null, 2)}
`;

    const guidelines = additionalGuidelines 
      ? `\nADDITIONAL GUIDELINES FROM TEACHER:\n${additionalGuidelines}\n`
      : '';

    const regenerationInstructions = `
CRITICAL INSTRUCTIONS FOR GRAMMAR REGENERATION:
1. Generate COMPLETELY NEW grammar rules that are different from the current ones shown above
2. Grammar rules should be clear, well-structured with explanations and examples
3. Appropriate for the English level (${originalFormData.englishLevel || 'Not specified'})
4. Related to the lesson topic and goals
5. Return ONLY a JSON object with this exact structure:
{
  "grammar_rules": {
    "title": "Grammar focus title",
    "introduction": "Brief introduction text",
    "rules": [
      {
        "rule_title": "Rule name",
        "explanation": "Clear explanation",
        "examples": ["example 1", "example 2", "example 3"]
      }
    ]
  }
}

IMPORTANT: The entire response must be a valid JSON object containing only the grammar_rules field. Do not include exercises, warmup, or any other worksheet components.
`;

    return baseInfo + grammarInfo + guidelines + regenerationInstructions;
  }
}

export const exerciseRegenerationService = new ExerciseRegenerationService();