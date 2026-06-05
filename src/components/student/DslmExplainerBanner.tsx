/**
 * DslmExplainerBanner — collapsible DSLM explainer shown above
 * the DSLM tab. Dismissed once per teacher via `localStorage`.
 *
 * v6.8.4 — Problem 5: rebrand DSLM tab to "1 MINUTE" with concept explanation.
 */
import React, { useState } from 'react';
import { Brain, X, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  teacherId: string;
}

const STORAGE_KEY_PREFIX = 'dslm_explainer_dismissed_';

export const DslmExplainerBanner: React.FC<Props> = ({ teacherId }) => {
  const storageKey = `${STORAGE_KEY_PREFIX}${teacherId}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try { localStorage.setItem(storageKey, 'true'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <Card className="border-primary/30 bg-primary/5 mb-4 relative">
      <CardContent className="py-3.5">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-8">
          <Brain className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold mb-1">What is DSLM?</p>
            <p className="text-muted-foreground">
              <strong>DSLM</strong> (Dynamic Student Learning Model) is the student
              context layer behind 1-Minute Prep. It organizes stored signals from
              profile data, goals, Welcome Test answers, nano-skill ratings, homework,
              notes, worksheet history, flashcard progress, pacing mode, and roadmap
              phases. Use it to choose, edit, and approve the next lesson direction
              before worksheet output.
            </p>
            <div className="flex items-center gap-3 mt-1">
              <Button variant="link" size="sm" className="px-0 h-auto text-xs" onClick={handleDismiss}>
                Got it
              </Button>
              <Button asChild variant="link" size="sm" className="px-0 h-auto text-xs">
                <a href="/features/dslm" target="_blank" rel="noopener noreferrer">
                  Learn more <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
