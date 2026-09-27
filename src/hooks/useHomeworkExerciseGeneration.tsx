import { useState } from 'react';
import { toast } from 'sonner';
import { devLog } from '@/utils/logger';

interface GeneratedExercise {
  id: string;
  type: string;
  title: string;
  instructions: string;
  content: any;
  selected: boolean;
}

// Normalize text fields that might be wrapped in {text: "..."} objects
function normalizeExerciseField(field: any): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field.text) return field.text;
  if (typeof field === 'object' && field.content) return field.content;
  return JSON.stringify(field); // fallback
}

export const useHomeworkExerciseGeneration = () => {
  const [generatedExercises, setGeneratedExercises] = useState<GeneratedExercise[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string>('');

  const generateSimilarExercises = async (
    worksheetFormData: any,
    userId: string,
    options?: { targetTypes?: string[]; countPerType?: number; additionalInstructions?: string }
  ) => {
    setIsGenerating(true);
    
    try {
      devLog('🎯 Generating similar exercises for homework', options);
      
      if (options?.targetTypes && options.targetTypes.length > 0) {
        const count = options.countPerType && options.countPerType > 0 ? options.countPerType : 1;
        
        devLog(`📝 BATCH MODE: Will generate ${options.targetTypes.length} type(s), ${count} exercise(s) each`);
        devLog(`   Types: ${options.targetTypes.join(', ')}`);

        const prompt = createGenerationPrompt(
          worksheetFormData, 
          undefined,
          count, 
          options.additionalInstructions
        );
        setLastPrompt(prompt);
        
        const response = await fetch('https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/generateWorksheet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt,
            formData: {
              ...worksheetFormData,
              regenerationMode: true,
              targetExerciseTypes: options.targetTypes,
              exerciseCountPerType: count
            },
            userId,
            isRegeneration: true,
            isBatchGeneration: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || 'Failed to generate exercises');
        }

        const data = await response.json();
        devLog('✅ Batch generation successful:', data);

        if (data.fullPrompt) {
          devLog('📝 Received full prompt from edge function (length:', data.fullPrompt.length, 'characters)');
          setLastPrompt(data.fullPrompt);
        } else {
          devLog('⚠️ No fullPrompt in response, using simplified prompt');
        }

        if (data.exercises && Array.isArray(data.exercises)) {
          const exercisesWithState = data.exercises.map((exercise: any, index: number) => ({
            ...exercise,
            id: `generated-${Date.now()}-${index}`,
            selected: true,
            title: normalizeExerciseField(exercise.title),
            instructions: normalizeExerciseField(exercise.instructions),
            content: normalizeExerciseField(exercise.content),
          }));
          
          setGeneratedExercises((prev) => [...prev, ...exercisesWithState]);
          toast.success(`Generated ${exercisesWithState.length} exercise(s) successfully!`);
        } else {
          throw new Error('No exercises returned from batch generation');
        }
      } else {
        devLog('📝 Generating generic exercise(s)');

        const prompt = createGenerationPrompt(worksheetFormData, undefined, undefined, options?.additionalInstructions);
        setLastPrompt(prompt);
        
        const response = await fetch('https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/generateWorksheet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: prompt,
            formData: {
              ...worksheetFormData,
              regenerationMode: true
            },
            userId,
            isRegeneration: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || 'Failed to generate exercises');
        }

        const data = await response.json();
        devLog('✅ Generic generation successful');

        if (data.exercises && Array.isArray(data.exercises)) {
          const exercisesWithState = data.exercises.map((exercise: any, index: number) => ({
            ...exercise,
            id: `generated-${Date.now()}-${index}`,
            selected: true,
            title: normalizeExerciseField(exercise.title),
            instructions: normalizeExerciseField(exercise.instructions),
            content: normalizeExerciseField(exercise.content),
          }));
          
          setGeneratedExercises((prev) => [...prev, ...exercisesWithState]);
          toast.success(`Generated ${exercisesWithState.length} exercise(s)!`);
        }
      }
    } catch (error) {
      console.error('❌ Error generating exercises:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate exercises');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleExerciseSelection = (exerciseId: string) => {
    setGeneratedExercises(prev => 
      prev.map(ex => 
        ex.id === exerciseId 
          ? { ...ex, selected: !ex.selected }
          : ex
      )
    );
  };

  const clearGeneratedExercises = () => {
    setGeneratedExercises([]);
  };

  const getSelectedGeneratedExercises = () => {
    return generatedExercises.filter(ex => ex.selected);
  };

  return {
    generatedExercises,
    isGenerating,
    generateSimilarExercises,
    toggleExerciseSelection,
    clearGeneratedExercises,
    getSelectedGeneratedExercises,
    lastPrompt: lastPrompt
  };
};

function createGenerationPrompt(
  worksheetFormData: any, 
  targetExerciseType?: string, 
  count?: number,
  additionalInstructions?: string
): string {
  const { 
    lessonTopic, 
    lessonGoal, 
    englishLevel, 
    lessonTime,
    grammarFocus,
    vocabularyFocus,
    languageStyle
  } = worksheetFormData;
  
  const baseInfo = `
Lesson Topic: ${lessonTopic || 'Not specified'}
Lesson Goal: ${lessonGoal || 'Not specified'}
English Level: ${englishLevel || 'Not specified'}
Lesson Duration: ${lessonTime || '60min'}
Grammar Focus: ${grammarFocus || 'Not specified'}
Vocabulary: ${vocabularyFocus || 'Not specified'}
Language Style: ${languageStyle || 'Formal'}
`;

  const countText = count === 1 ? 'ONE' : count ? `${count}` : '2-3';
  const exercisesWord = count === 1 ? 'exercise' : 'exercises';
  
  const instructions = targetExerciseType 
    ? `Generate ${countText} high-quality ${exercisesWord} of type "${targetExerciseType}".

Requirements:
- Must be similar in style and difficulty to other exercises in this lesson
- Use DIFFERENT content and examples than the original worksheet
- Maintain the same English level (${englishLevel})
- If the exercise type uses vocabulary, incorporate words from: ${vocabularyFocus || 'lesson context'}
- If the exercise type practices grammar, focus on: ${grammarFocus || 'lesson grammar'}
- Make it engaging, practical, and appropriate for: ${lessonGoal || 'general learning'}
`
    : `Generate ${countText} ${exercisesWord} similar to those in the original worksheet, with the same types but different content.

Requirements:
- Match the lesson's English level and topic
- Use different content than the original worksheet
- If grammar focus is specified, incorporate: ${grammarFocus}
- If vocabulary is specified, use relevant words from: ${vocabularyFocus}
- Keep exercises engaging and contextually relevant`;

  const instructionsSection = additionalInstructions 
    ? `\n\nTeacher's Additional Instructions:\n${additionalInstructions}`
    : '';

  return `${baseInfo}\n\n${instructions}${instructionsSection}\n\nEnsure all exercises are fresh, contextually relevant, and pedagogically sound.`;
}
