/**
 * InstructionScreen - Pre-test instructions with Start button
 */

import { Sparkles, AlertCircle, SkipForward, HelpCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface InstructionScreenProps {
  totalQuestions: number;
  onStart: () => void;
}

export function InstructionScreen({ totalQuestions, onStart }: InstructionScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-lg w-full space-y-5">
        <div className="text-center">
          <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Before You Begin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalQuestions} questions • ~30 min
          </p>
        </div>

        <Card>
          <CardContent className="py-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">This is NOT a graded exam</p>
                <p className="text-xs text-muted-foreground">
                  There are no right or wrong answers for most questions. Your teacher wants to understand how you learn best.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Don't guess on grammar/vocabulary questions</p>
                <p className="text-xs text-muted-foreground">
                  If you don't know the answer, tap "I don't know". It is the honest choice and helps your teacher find the right level, much more than a lucky guess.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <SkipForward className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">"Skip" is not the same as "I don't know"</p>
                <p className="text-xs text-muted-foreground">
                  "Skip" moves on and leaves the question unanswered, so your teacher learns nothing from it. You can always go back and answer later.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">You can pause anytime</p>
                <p className="text-xs text-muted-foreground">
                  Your progress is saved automatically. Close the browser and come back later; you'll continue where you left off.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <button
            onClick={onStart}
            className="w-36 h-36 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 flex flex-col items-center justify-center gap-1"
          >
            <Sparkles className="h-7 w-7" />
            <span>Start</span>
          </button>
        </div>
      </div>
    </div>
  );
}
