import type { LearningCard } from '@/types/flashcards';

export function sideLabels(card: Pick<LearningCard, 'direction' | 'back_type'>, nativeLanguage?: string | null) {
  // Definition sets have an English definition on the back, not the learner's language.
  const meaning = card.back_type === 'definition' ? 'Definition' : nativeLanguage || 'Translation';
  return card.direction === 2
    ? { front: meaning, back: 'English' }
    : { front: 'English', back: meaning };
}
