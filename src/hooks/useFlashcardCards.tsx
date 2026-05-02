import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FlashcardCard, CreateFlashcardCard, UpdateFlashcardCard, normalizeVocabularySheet } from '@/types/flashcards';

// UUID validation helper
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const useFlashcardCards = (setId?: string) => {
  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchCards = async () => {
    // Validate UUID before fetching
    if (!setId || setId === 'new' || !isValidUUID(setId)) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flashcard_cards')
        .select('*')
        .eq('set_id', setId)
        .is('deleted_at', null)
        .order('card_position', { ascending: true });

      if (error) throw error;
      setCards((data || []) as FlashcardCard[]);
    } catch (error: any) {
      console.error('Error fetching flashcard cards:', error);
      toast({
        title: 'Error',
        description: 'Failed to load flashcard cards',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [setId]);

  const addCard = async (data: CreateFlashcardCard) => {
    try {
      // Get max position
      const maxPosition = cards.length > 0 
        ? Math.max(...cards.map(c => c.card_position)) 
        : -1;

      const { error } = await supabase
        .from('flashcard_cards')
        .insert({
          ...data,
          card_position: data.card_position ?? (maxPosition + 1),
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Card added successfully',
      });

      await fetchCards();
    } catch (error: any) {
      console.error('Error adding card:', error);
      toast({
        title: 'Error',
        description: 'Failed to add card',
        variant: 'destructive',
      });
    }
  };

  const updateCard = async (cardId: string, updates: UpdateFlashcardCard) => {
    try {
      const { error } = await supabase
        .from('flashcard_cards')
        .update(updates)
        .eq('id', cardId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Card updated',
      });

      await fetchCards();
    } catch (error: any) {
      console.error('Error updating card:', error);
      toast({
        title: 'Error',
        description: 'Failed to update card',
        variant: 'destructive',
      });
    }
  };

  const deleteCard = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from('flashcard_cards')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', cardId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Card deleted',
      });

      await fetchCards();
    } catch (error: any) {
      console.error('Error deleting card:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete card',
        variant: 'destructive',
      });
    }
  };

  const bulkAddFromVocabulary = async (
    setId: string,
    worksheetId: string,
    vocabularyData: any
  ) => {
    try {
      const normalized = normalizeVocabularySheet(vocabularyData);
      const maxPosition = cards.length > 0 
        ? Math.max(...cards.map(c => c.card_position)) 
        : -1;

      const cardsToInsert = normalized.map((item, index) => ({
        set_id: setId,
        source_worksheet_id: worksheetId,
        front_text: item.word,
        front_example: item.example || null,
        back_text: item.definition,
        source_type: 'vocabulary_sheet' as const,
        card_position: maxPosition + 1 + index,
        cefr_level: item.cefr_level || null,
      }));

      const { error } = await supabase
        .from('flashcard_cards')
        .insert(cardsToInsert);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Added ${cardsToInsert.length} cards from vocabulary sheet`,
      });

      await fetchCards();
    } catch (error: any) {
      console.error('Error importing from vocabulary:', error);
      toast({
        title: 'Error',
        description: 'Failed to import cards',
        variant: 'destructive',
      });
    }
  };

  const reorderCards = async (setId: string, cardIds: string[]) => {
    try {
      // Update positions one by one
      for (let i = 0; i < cardIds.length; i++) {
        await supabase
          .from('flashcard_cards')
          .update({ card_position: i })
          .eq('id', cardIds[i]);
      }

      await fetchCards();
    } catch (error: any) {
      console.error('Error reordering cards:', error);
      toast({
        title: 'Error',
        description: 'Failed to reorder cards',
        variant: 'destructive',
      });
    }
  };

  return {
    cards,
    loading,
    addCard,
    updateCard,
    deleteCard,
    bulkAddFromVocabulary,
    reorderCards,
    refetch: fetchCards,
  };
};
