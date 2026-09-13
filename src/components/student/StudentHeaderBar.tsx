/**
 * StudentHeaderBar — identity row of the Student Workspace (v6.9.111, M3.2).
 *
 * Purely presentational: no queries, no navigation logic beyond a real
 * `<Link>` back to the dashboard (middle-click and Cmd/Ctrl+click preserved).
 * All data arrives pre-formatted from `studentSnapshot.ts`.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatGoal } from '@/lib/students/formatGoal';

export interface StudentHeaderBarProps {
  name: string;
  englishLevel: string | null;
  mainGoal: string | null;
  nextLessonLabel: string | null;
  isNextLessonLoading: boolean;
  /** Single `StudentSettingsMenu` instance — the only settings entry point. */
  menu: React.ReactNode;
}

export const StudentHeaderBar: React.FC<StudentHeaderBarProps> = ({
  name,
  englishLevel,
  mainGoal,
  nextLessonLabel,
  isNextLessonLoading,
  menu,
}) => {
  const goalLabel = formatGoal(mainGoal);

  return (
    <header className="border-b border-border bg-background">
      <div className="flex items-start gap-3 py-3 lg:items-center">
        <Link
          to="/dashboard"
          aria-label="Back to dashboard"
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="min-w-0 truncate text-lg font-semibold lg:text-xl">{name}</h1>
            {englishLevel && (
              <Badge variant="secondary" className="flex-shrink-0">
                {englishLevel}
              </Badge>
            )}
          </div>

          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {goalLabel && (
              <span className="min-w-0 truncate lg:max-w-[320px]" title={goalLabel}>
                {goalLabel}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              {isNextLessonLoading ? (
                <Skeleton className="h-3.5 w-24" />
              ) : (
                <span>{nextLessonLabel ?? 'No lesson booked'}</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex-shrink-0">{menu}</div>
      </div>
    </header>
  );
};

export default StudentHeaderBar;
