import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LearningCard, ReviewQuality } from '@/types/flashcards';

interface FlashcardDisplayProps {
  card: LearningCard;
  onReview: (cardId: string, quality: ReviewQuality) => void;
  nativeLanguage: string;
}

export function FlashcardDisplay({ card, onReview, nativeLanguage }: FlashcardDisplayProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Handle bidirectional: swap front/back if direction === 2
  const displayFront = card.direction === 2 ? card.back_text : card.front_text;
  const displayBack = card.direction === 2 ? card.front_text : card.back_text;
  const frontLabel = card.direction === 2 ? nativeLanguage : 'English';
  const backLabel = card.direction === 2 ? 'English' : nativeLanguage;
  const frontExample = card.direction === 2 ? undefined : card.front_example;

  const handleReview = (quality: ReviewQuality) => {
    onReview(card.card_id, quality);
    setIsFlipped(false);
  };

  return (
    <div className="w-full max-w-2xl">
      <Card
        className="cursor-pointer transition-all duration-300 hover:shadow-lg min-h-[300px]"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <CardContent className="p-8 flex flex-col items-center justify-center min-h-[300px]">
          {!isFlipped ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                <span>{frontLabel}</span>
                {card.cefr_level && (
                  <span className="px-1.5 py-0.5 rounded text-xs border font-medium">{card.cefr_level}</span>
                )}
              </div>
              <div className="text-3xl font-bold">{displayFront}</div>
              {frontExample && (
                <div className="text-lg text-muted-foreground italic mt-4">
                  "{frontExample}"
                </div>
              )}
              <div className="text-sm text-muted-foreground mt-8">
                Click to reveal answer
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4 w-full">
              <div className="text-sm text-muted-foreground mb-2">{backLabel}</div>
              <div className="text-3xl font-bold">{displayBack}</div>
              
              <div className="pt-8 space-y-3">
                <p className="text-sm text-muted-foreground">How well did you know this?</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-200 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReview(0);
                    }}
                  >
                    😰 Again
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-green-200 hover:bg-green-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReview(2);
                    }}
                  >
                    ✅ I Know This
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
