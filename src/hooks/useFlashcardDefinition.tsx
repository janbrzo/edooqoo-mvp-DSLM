import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseFlashcardDefinitionProps {
  enabled: boolean;
}

export const useFlashcardDefinition = ({ enabled }: UseFlashcardDefinitionProps) => {
  const [definition, setDefinition] = useState('');
  const [cefrLevel, setCefrLevel] = useState<string | null>(null);
  const [isLoadingDefinition, setIsLoadingDefinition] = useState(false);

  const cacheRef = useRef<Map<string, { definition: string; cefr_level: string }>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDefinition = useCallback(
    async (englishTerm: string) => {
      if (!enabled || !(englishTerm || '').trim()) {
        setDefinition('');
        setCefrLevel(null);
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        const cacheKey = `def_${englishTerm.toLowerCase().trim()}`;
        
        if (cacheRef.current.has(cacheKey)) {
          const cached = cacheRef.current.get(cacheKey)!;
          setDefinition(cached.definition);
          setCefrLevel(cached.cefr_level);
          return;
        }

        setIsLoadingDefinition(true);
        try {
          const { data, error } = await supabase.functions.invoke('translate-flashcard', {
            body: {
              text: englishTerm,
              target_language: 'English',
              mode: 'definition'
            },
          });

          if (error) throw error;

          const definitionText = data?.translation || '';
          const level = data?.cefr_level || 'A2';
          setDefinition(definitionText);
          setCefrLevel(level);
          cacheRef.current.set(cacheKey, { definition: definitionText, cefr_level: level });
        } catch (error: any) {
          console.error('Definition fetch error:', error);
          setDefinition('');
          setCefrLevel(null);
        } finally {
          setIsLoadingDefinition(false);
        }
      }, 800);
    },
    [enabled]
  );

  const clearDefinition = useCallback(() => {
    setDefinition('');
    setCefrLevel(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    definition,
    cefrLevel,
    isLoadingDefinition,
    fetchDefinition,
    clearDefinition,
  };
};
