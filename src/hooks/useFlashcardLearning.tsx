import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { LearningCard, LearningQueueMode, LearningSessionStats } from '@/types/flashcards';
import { devError, devLog } from '@/utils/logger';
import { buildSessionQueue, earliestNextReview, expandEntries } from '@/lib/flashcards/queue';
import { fetchLearningCards, saveFlashcardReview } from '@/lib/flashcards/learningRpc';
import {
  clampResponseTimeMs,
  normalizeLearnerEmail,
  stateFromSaveResult,
  type SaveQuality,
} from '@/lib/flashcards/reviewState';

const emptyStats: LearningSessionStats = {
  totalCards: 0,
  newCards: 0,
  reviewedCards: 0,
  scheduledReviews: 0,
  practiceReviews: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  averageEasiness: 2.5,
};

/**
 * Token-scoped flashcard study session. All persistence goes through
 * get_flashcard_learning_cards_by_token / save_flashcard_review_by_token; the server owns the
 * schedule and decides whether an answer is scheduled or practice.
 */
export const useFlashcardLearning = (shareToken: string, learnerEmail: string) => {
  const email = normalizeLearnerEmail(learnerEmail);
  const [cards, setCards] = useState<LearningCard[]>([]);
  const [allEntries, setAllEntries] = useState<LearningCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionMode, setSessionMode] = useState<LearningQueueMode>('due');
  const [sessionStats, setSessionStats] = useState<LearningSessionStats>(emptyStats);
  const { toast } = useToast();

  // Response-time tracking (refs so the visibility handler never sees stale values)
  const cardShownAtRef = useRef<number>(Date.now());
  const pausedMsRef = useRef(0);
  const tabActiveRef = useRef(true);
  const inFlightRef = useRef(false);

  const resetTimer = useCallback(() => {
    cardShownAtRef.current = Date.now();
    pausedMsRef.current = 0;
    tabActiveRef.current = typeof document === 'undefined' ? true : !document.hidden;
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (tabActiveRef.current) pausedMsRef.current += Date.now() - cardShownAtRef.current;
        tabActiveRef.current = false;
      } else {
        cardShownAtRef.current = Date.now();
        tabActiveRef.current = true;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const loadSession = useCallback(
    async (mode: LearningQueueMode = 'due') => {
      if (!shareToken || !email) return;
      setLoading(true);
      setLoadError(false);
      try {
        const rows = await fetchLearningCards(shareToken, email);
        const now = new Date();
        const queue = buildSessionQueue(rows, { mode, now });
        setAllEntries(expandEntries(rows, now));
        setCards(queue);
        setCurrentIndex(0);
        setSessionMode(mode);
        setSessionStats({
          ...emptyStats,
          totalCards: queue.length,
          newCards: queue.filter((c) => c.isNew).length,
        });
        // The timer starts when the first card is shown, not when the e-mail was typed.
        resetTimer();
        setLoaded(true);
      } catch (error) {
        devError('[Flashcard] Error loading learning session:', error);
        setLoadError(true);
        toast({
          title: 'Error',
          description: 'Failed to load learning session',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shareToken, email, resetTimer],
  );

  const submitReview = useCallback(
    async (entryKey: string, quality: SaveQuality): Promise<boolean> => {
      if (inFlightRef.current) return false;
      const index = cards.findIndex((c) => c.entryKey === entryKey);
      if (index < 0 || !shareToken || !email) return false;
      const entry = cards[index];

      inFlightRef.current = true;
      setIsSaving(true);
      const activeTime = tabActiveRef.current ? Date.now() - cardShownAtRef.current : 0;
      const responseTimeMs = clampResponseTimeMs(pausedMsRef.current + activeTime);
      devLog('[Flashcard] Response time:', responseTimeMs, 'ms');

      try {
        const result = await saveFlashcardReview({
          shareToken,
          email,
          cardId: entry.card_id,
          direction: entry.direction,
          quality,
          responseTimeMs,
        });
        const state = stateFromSaveResult(result);
        const patch = (list: LearningCard[]) =>
          list.map((c) => (c.entryKey === entryKey ? { ...c, ...state, isDue: false } : c));
        setCards(patch);
        setAllEntries(patch);

        setSessionStats((prev) => ({
          ...prev,
          reviewedCards: prev.reviewedCards + 1,
          scheduledReviews: prev.scheduledReviews + (result.counted ? 1 : 0),
          practiceReviews: prev.practiceReviews + (result.counted ? 0 : 1),
          correctAnswers: quality >= 2 ? prev.correctAnswers + 1 : prev.correctAnswers,
          incorrectAnswers: quality < 2 ? prev.incorrectAnswers + 1 : prev.incorrectAnswers,
          averageEasiness:
            (prev.averageEasiness * prev.reviewedCards + result.easiness_factor) / (prev.reviewedCards + 1),
        }));

        setCurrentIndex((prev) => Math.max(prev, index + 1));
        resetTimer();
        return true;
      } catch (error) {
        // Do not advance: the learner can retry the same card.
        devError('[Flashcard] Error submitting review:', error);
        toast({
          title: 'Error',
          description: 'Failed to save your progress. Please try again.',
          variant: 'destructive',
        });
        return false;
      } finally {
        inFlightRef.current = false;
        setIsSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, shareToken, email, resetTimer],
  );

  const restartSession = (mode: 'all' | 'mistakes' = 'all') => {
    void loadSession(mode);
  };

  return {
    cards,
    currentCard: currentIndex < cards.length ? cards[currentIndex] : null,
    currentIndex,
    loading,
    loaded,
    loadError,
    isSaving,
    sessionMode,
    sessionStats,
    isEmptySet: loaded && allEntries.length === 0,
    nextDueAt: loaded ? earliestNextReview(allEntries, new Date()) : null,
    isSessionComplete: loaded && !loading && currentIndex >= cards.length,
    loadSession,
    submitReview,
    restartSession,
  };
};
