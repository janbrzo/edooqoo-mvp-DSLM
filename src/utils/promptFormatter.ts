
import { FormData } from "@/components/WorksheetForm";
import { devLog, devWarn } from '@/utils/logger';
import { supabase } from "@/integrations/supabase/client";

/**
 * v6.9.7 — IP protection.
 * Prompt formatting (language-style ladder, CEFR ladder, exercise specs) was
 * moved to the `format-worksheet-prompt` edge function. This wrapper preserves
 * the synchronous-looking call site contract but is now `async` — callers must
 * `await` it.
 *
 * Fallback chain:
 *   1. POST /functions/v1/format-worksheet-prompt
 *   2. On network/5xx: 1 retry after 250ms
 *   3. On final failure: throw — caller is expected to surface the error.
 */
export const formatPromptForAI = async (data: FormData): Promise<string> => {
  devLog('📝 Requesting prompt format from edge fn');

  const invoke = async () =>
    supabase.functions.invoke<{ prompt: string }>('format-worksheet-prompt', {
      body: { formData: data },
    });

  let { data: result, error } = await invoke();
  if (error || !result?.prompt) {
    devWarn('format-worksheet-prompt failed, retrying once', error);
    await new Promise((r) => setTimeout(r, 250));
    const retry = await invoke();
    result = retry.data;
    error = retry.error;
  }

  if (error || !result?.prompt) {
    throw new Error(`Prompt service unavailable: ${error?.message ?? 'no prompt returned'}`);
  }
  return result.prompt;
};

export const createFormDataForStorage = (prompt: FormData) => {
  devLog('🔧 [PROMPT-FORMATTER] createFormDataForStorage - input selectedExercises:', prompt.selectedExercises);
  devLog('🔧 [PROMPT-FORMATTER] createFormDataForStorage - input selectedExercises type:', typeof prompt.selectedExercises);
  devLog('🔧 [PROMPT-FORMATTER] createFormDataForStorage - full prompt object:', prompt);
  
  const formDataForStorage = {
    lessonTopic: prompt.lessonTopic,
    lessonGoal: prompt.lessonGoal,
    teachingPreferences: prompt.teachingPreferences || null,
    additionalInformation: prompt.additionalInformation || null,
    englishLevel: prompt.englishLevel || null,
    languageStyle: prompt.languageStyle || 3,
    lessonTime: prompt.lessonTime,
    selectedExercises: prompt.selectedExercises || [],
    exerciseFocusMap: prompt.exerciseFocusMap || null,
    selectedImage: prompt.selectedImage || null,
    selectedAudio: prompt.selectedAudio || null
  };
  
  devLog('🔧 [PROMPT-FORMATTER] createFormDataForStorage - output selectedExercises:', formDataForStorage.selectedExercises);
  devLog('🔧 [PROMPT-FORMATTER] createFormDataForStorage - output object:', formDataForStorage);
  
  return formDataForStorage;
};
