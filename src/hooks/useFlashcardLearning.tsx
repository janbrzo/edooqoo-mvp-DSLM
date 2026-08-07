import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LearningCard, ReviewQuality, LearningSessionStats } from '@/types/flashcards';
import { devLog } from '@/utils/logger';

// SM-2 Algorithm Implementation
function calculateSM2(
  quality: ReviewQuality,
  repetition: number,
  easinessFactor: number,
  intervalDays: number
): { newRepetition: number; newEF: number; newInterval: number } {
  let newEF = easinessFactor;
  let newRepetition = repetition;
  let newInterval = intervalDays;

  if (quality < 2) {
    // Failed - reset
    newRepetition = 0;
    newInterval = 1;
  } else {
    // Success
    if (repetition === 0) {
      newInterval = 1;
    } else if (repetition === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(intervalDays * easinessFactor);
    }
    newRepetition = repetition + 1;
  }

  // Update easiness factor
  newEF = easinessFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
  newEF = Math.max(1.3, newEF); // Minimum EF is 1.3

  return { newRepetition, newEF, newInterval };
}

export const useFlashcardLearning = (setId: string, learnerEmail: string) => {
  const [cards, setCards] = useState<LearningCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  // PROBLEM 4 FIX: Track response time for flashcards
  const [cardShownAt, setCardShownAt] = useState<number>(Date.now());
  const [pausedTimeMs, setPausedTimeMs] = useState(0);
  const [isTabActive, setIsTabActive] = useState(true);
  const [sessionStats, setSessionStats] = useState<LearningSessionStats>({
    totalCards: 0,
    newCards: 0,
    reviewedCards: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    averageEasiness: 2.5,
  });
  const { toast } = useToast();

  // PROBLEM 4 FIX: Pause timer when tab is inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setPausedTimeMs(prev => prev + (Date.now() - cardShownAt));
        setIsTabActive(false);
      } else {
        setCardShownAt(Date.now());
        setIsTabActive(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [cardShownAt]);

  const loadSession = useCallback(async (includeAll = false, mistakesOnly = false) => {
    if (!setId || !learnerEmail) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_flashcard_cards_for_learning', {
        p_set_id: setId,
        p_learner_identifier: learnerEmail,
      });

      if (error) throw error;

      let learningCards: LearningCard[] = (data || []).map((card: any) => ({
        ...card,
        isNew: card.total_reviews === 0,
        isDueForReview: new Date(card.next_review_date) <= new Date(),
      }));

      // Filter logic
      if (mistakesOnly) {
        // Only cards with more incorrect than correct answers
        learningCards = learningCards.filter(card => 
          card.incorrect_count > card.correct_count || card.easiness_factor < 2.0
        );
      } else if (!includeAll) {
        // Default: new or due for review
        learningCards = learningCards.filter(card => card.isNew || card.isDueForReview);
      }
      // else: includeAll = true means load all cards

      // Fetch set direction flag via SECURITY DEFINER RPC (works for anon share links too)
      const { data: isBidirectional } = await supabase.rpc('get_flashcard_set_is_bidirectional', {
        p_set_id: setId,
      });

      // Duplicate cards for bidirectional (direction 1 and 2)
      if (isBidirectional) {
        const reversedCards = learningCards.map(card => ({
          ...card,
          direction: 2 as const, // Mark as reversed
        }));
        learningCards = [...learningCards, ...reversedCards];
      }

      // Shuffle cards randomly (Problem 8)
      const shuffledCards = learningCards.sort(() => Math.random() - 0.5);

      setCards(shuffledCards);
      setCurrentIndex(0);
      setSessionStats({
        totalCards: shuffledCards.length,
        newCards: shuffledCards.filter(c => c.isNew).length,
        reviewedCards: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        averageEasiness: 2.5,
      });
    } catch (error: any) {
      console.error('Error loading learning session:', error);
      toast({
        title: 'Error',
        description: 'Failed to load learning session',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [setId, learnerEmail]);

  const submitReview = async (cardId: string, quality: ReviewQuality) => {
    const card = cards.find(c => c.card_id === cardId);
    if (!card) return;

    // PROBLEM 4 FIX: Calculate response time (excludes paused time)
    const activeTime = isTabActive ? (Date.now() - cardShownAt) : 0;
    const responseTimeMs = pausedTimeMs + activeTime;
    devLog('[Flashcard] Response time:', responseTimeMs, 'ms');

    try {
      const { newRepetition, newEF, newInterval } = calculateSM2(
        quality,
        card.repetition,
        card.easiness_factor,
        card.interval_days
      );

      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

      // v6.9.87 — learners no longer write to flashcard_progress directly.
      // The SECURITY DEFINER RPC scopes the row to the learner's own identifier.
      const { error } = await supabase.rpc('save_flashcard_progress', {
        p_card_id: cardId,
        p_set_id: setId,
        p_learner_identifier: learnerEmail,
        p_direction: card.direction,
        p_easiness_factor: newEF,
        p_repetition: newRepetition,
        p_interval_days: newInterval,
        p_next_review_date: nextReviewDate.toISOString(),
        p_total_reviews: card.total_reviews + 1,
        p_correct_count: quality >= 2 ? card.correct_count + 1 : card.correct_count,
        p_incorrect_count: quality < 2 ? card.incorrect_count + 1 : card.incorrect_count,
        p_last_response_time_ms: responseTimeMs,
        p_last_quality_rating: quality, // 0=Again, 2=I Know This
      } as any);

      if (error) throw error;

      // Update session stats
      setSessionStats(prev => ({
        ...prev,
        reviewedCards: prev.reviewedCards + 1,
        correctAnswers: quality >= 2 ? prev.correctAnswers + 1 : prev.correctAnswers,
        incorrectAnswers: quality < 2 ? prev.incorrectAnswers + 1 : prev.incorrectAnswers,
        averageEasiness: ((prev.averageEasiness * prev.reviewedCards) + newEF) / (prev.reviewedCards + 1),
      }));

      // Move to next card and reset timer
      setCurrentIndex(prev => prev + 1);
      // PROBLEM 4 FIX: Reset timer for next card
      setCardShownAt(Date.now());
      setPausedTimeMs(0);
      setIsTabActive(true);
    } catch (error: any) {
      console.error('Error submitting review:', error);
      toast({
        title: 'Error',
        description: 'Failed to save your progress',
        variant: 'destructive',
      });
    }
  };

  const getCurrentCard = () => {
    if (currentIndex >= cards.length) return null;
    return cards[currentIndex];
  };

  const isSessionComplete = () => currentIndex >= cards.length;

  const restartSession = (mode: 'all' | 'mistakes' = 'all') => {
    if (mode === 'all') {
      loadSession(true, false); // includeAll=true, mistakesOnly=false
    } else {
      loadSession(false, true); // includeAll=false, mistakesOnly=true
    }
  };

  return {
    cards,
    currentCard: getCurrentCard(),
    currentIndex,
    loading,
    sessionStats,
    isSessionComplete: isSessionComplete(),
    loadSession,
    submitReview,
    restartSession,
  };
};
