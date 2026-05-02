import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseFlashcardTranslationProps {
  targetLanguage: string;
  enabled: boolean;
}

export const useFlashcardTranslation = ({ targetLanguage, enabled }: UseFlashcardTranslationProps) => {
  const [translation, setTranslation] = useState('');
  const [cefrLevel, setCefrLevel] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const { toast } = useToast();

  const cacheRef = useRef<Map<string, { translation: string; cefr_level: string }>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const translateText = useCallback(
    async (englishText: string) => {
      if (!enabled || !(englishText || '').trim()) {
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

          const translatedText = data?.translation || '';
          const level = data?.cefr_level || 'A2';
          setTranslation(translatedText);
          setCefrLevel(level);
          cacheRef.current.set(cacheKey, { translation: translatedText, cefr_level: level });
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
