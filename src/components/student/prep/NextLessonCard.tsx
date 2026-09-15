/**
 * NextLessonCard — the answer to "what do I teach next?" (v6.9.111, M4 step 2).
 *
 * Purely presentational: it receives an already-selected `PrepSuggestion`
 * (see `src/lib/students/prepPlan.ts`) plus a pre-built rationale sentence and
 * renders the single primary action of the whole Student Workspace:
 * "Generate worksheet".
 *
 * It knows nothing about sessionStorage, auto-generate intents or the Worksheet
 * Generation Engine — the page owns those and passes callbacks down.
 */

import React from 'react';
import { CalendarClock, MoreHorizontal, Sparkles, Wand2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PrepSuggestion } from '@/lib/students/prepPlan';

export interface NextLessonCardProps {
  studentName: string;
  nextLessonLabel: string | null;
  isLessonLoading: boolean;
  suggestion: PrepSuggestion;
  rationale: string;
  focusAreas: readonly string[];
  isSuggestionsLoading: boolean;
  onGenerate: () => void;
  onChangeTopic: () => void;
  onOpenModel: () => void;
}

export const NextLessonCard: React.FC<NextLessonCardProps> = ({
  studentName,
  nextLessonLabel,
  isLessonLoading,
  suggestion,
  rationale,
  focusAreas,
  isSuggestionsLoading,
  onGenerate,
  onChangeTopic,
  onOpenModel,
}) => {
  return (
    <Card data-testid="prep-next-lesson">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Next lesson
          </span>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            {isLessonLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <span>{nextLessonLabel || 'No lesson booked'}</span>
            )}
          </span>
        </div>

        <div className="mt-3 min-w-0">
          {isSuggestionsLoading ? (
            <>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold leading-snug sm:text-xl">
                {suggestion.topic}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{rationale}</p>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={onGenerate} disabled={isSuggestionsLoading}>
            <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Generate worksheet
          </Button>
          <Button variant="outline" onClick={onChangeTopic} disabled={isSuggestionsLoading}>
            Change topic
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenModel}>
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                See all suggestions
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {focusAreas.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Focus
            </span>
            {focusAreas.map((area) => (
              <Badge key={area} variant="secondary" className="font-normal">
                {area}
              </Badge>
            ))}
          </div>
        )}

        <span className="sr-only">{`Prep plan for ${studentName}`}</span>
      </CardContent>
    </Card>
  );
};

export default NextLessonCard;
