
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

  // v6.9.51 — Bypass `supabase.functions.invoke` and call the edge function
  // directly so anonymous users (no Supabase session yet) still send a valid
  // Authorization header. Without this, the gateway returns 401 even though
  // the function is declared `verify_jwt = false` in supabase/config.toml.
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/format-worksheet-prompt`;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const invoke = async (): Promise<{ data: { prompt: string } | null; error: Error | null }> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? anonKey;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ formData: data }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return { data: null, error: new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`) };
      }
      const json = (await res.json()) as { prompt: string };
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

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
