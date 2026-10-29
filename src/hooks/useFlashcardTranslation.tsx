import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { canTranslate, readTranslationResult, TRANSLATION_UNAVAILABLE_MESSAGE } from '@/lib/flashcards/translationResult';

interface UseFlashcardTranslationProps {
  targetLanguage: string;
  enabled: boolean;
}

export const useFlashcardTranslation = ({ targetLanguage, enabled }: UseFlashcardTranslationProps) => {
  const [translation, setTranslation] = useState('');
  const [cefrLevel, setCefrLevel] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const { toast } = useToast();

  const cacheRef = useRef<Map<string, { translation: string; cefr_level: string | null }>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const translateText = useCallback(
    async (englishText: string) => {
      if (!enabled || !canTranslate(englishText)) {
        setTranslation('');
        setCefrLevel(null);
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        const cacheKey = `${englishText}_${targetLanguage}`;
        
        if (cacheRef.current.has(cacheKey)) {
          const cached = cacheRef.current.get(cacheKey)!;
          setTranslation(cached.translation);
          setCefrLevel(cached.cefr_level);
          return;
        }

        setIsTranslating(true);
        try {
          const { data, error } = await supabase.functions.invoke('translate-flashcard', {
            body: {
              text: englishText,
              target_language: targetLanguage,
            },
          });

          if (error) throw error;

          const result = readTranslationResult(data);
          if (!result) {
            // Refusal or junk from the model: never fill the card back.
            setTranslation('');
            setCefrLevel(null);
            toast({ title: 'No translation suggested', description: TRANSLATION_UNAVAILABLE_MESSAGE });
            return;
          }
          setTranslation(result.translation);
          setCefrLevel(result.cefrLevel);
          cacheRef.current.set(cacheKey, { translation: result.translation, cefr_level: result.cefrLevel });
        } catch (error: any) {
          console.error('Translation error:', error);
          setTranslation('');
          setCefrLevel(null);
        } finally {
          setIsTranslating(false);
        }
      }, 800);
    },
    [targetLanguage, enabled, toast]
  );

  const clearTranslation = useCallback(() => {
    setTranslation('');
    setCefrLevel(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    translation,
    cefrLevel,
    isTranslating,
    translateText,
    clearTranslation,
  };
};
