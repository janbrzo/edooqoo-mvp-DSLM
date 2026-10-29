import { useCallback, useEffect, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { LearningCard } from '@/types/flashcards';
import type { SaveQuality } from '@/lib/flashcards/reviewState';
import { sideLabels } from '@/lib/flashcards/sideLabels';

interface FlashcardDisplayProps {
  card: LearningCard;
  onReview: (entryKey: string, quality: SaveQuality) => void | Promise<unknown>;
  nativeLanguage?: string | null;
  disabled?: boolean;
}

export function FlashcardDisplay({ card, onReview, nativeLanguage, disabled = false }: FlashcardDisplayProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Bidirectional: swap front/back if direction === 2
  const displayFront = card.direction === 2 ? card.back_text : card.front_text;
  const displayBack = card.direction === 2 ? card.front_text : card.back_text;
  const labels = sideLabels(card, nativeLanguage);
  const frontExample = card.direction === 2 ? undefined : card.front_example;

  const review = useCallback(
    (quality: SaveQuality) => {
      if (disabled) return;
      void onReview(card.entryKey, quality);
    },
    [card.entryKey, disabled, onReview],
  );

  // Keys 1 = Again, 2 = I know, once the answer is visible
  useEffect(() => {
    if (!isFlipped) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '1') review(0);
      else if (e.key === '2') review(2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFlipped, review]);

  const flipOnKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsFlipped(true);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <Card className="min-h-[300px] transition-all duration-300 hover:shadow-lg">
        <CardContent className="p-8 flex flex-col items-center justify-center min-h-[300px]">
          {!isFlipped ? (
            <div
              role="button"
              tabIndex={0}
              aria-label={`Card front: ${displayFront}. Press Enter or Space to reveal the answer`}
              onClick={() => setIsFlipped(true)}
              onKeyDown={flipOnKey}
              className="w-full cursor-pointer text-center space-y-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                <span>{labels.front}</span>
                {card.cefr_level && (
                  <span className="px-1.5 py-0.5 rounded text-xs border font-medium">{card.cefr_level}</span>
                )}
              </div>
              <div className="text-3xl font-bold">{displayFront}</div>
              {frontExample && (
                <div className="text-lg text-muted-foreground italic mt-4">"{frontExample}"</div>
              )}
              <div className="text-sm text-muted-foreground mt-8">Click or press Enter to reveal the answer</div>
            </div>
          ) : (
            <div className="text-center space-y-4 w-full" aria-live="polite">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                <span>{labels.back}</span>
                {card.cefr_level && (
                  <span className="px-1.5 py-0.5 rounded text-xs border font-medium">{card.cefr_level}</span>
                )}
              </div>
              <div className="text-3xl font-bold">{displayBack}</div>

              <div className="pt-8 space-y-3">
                <p className="text-sm text-muted-foreground">How well did you know this?</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={disabled}
                    onClick={() => review(0)}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" aria-hidden="true" />
                    Again <kbd className="ml-2 text-xs opacity-70">1</kbd>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-success/40 text-success hover:bg-success/10 hover:text-success"
                    disabled={disabled}
                    onClick={() => review(2)}
                  >
                    <Check className="w-4 h-4 mr-2" aria-hidden="true" />
                    I know this <kbd className="ml-2 text-xs opacity-70">2</kbd>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
