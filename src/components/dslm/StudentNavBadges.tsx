/**
 * StudentNavBadges — compact inline badges (level + activity) for the top nav area on DSLM tab.
 * Rendered as a sticky strip just below the global StickyNav so it stays visible while scrolling DSLM.
 */
import React from 'react';
import { GraduationCap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentNavBadgesProps {
  englishLevel: string;
  daysSinceLastActivity: number | null;
}

const LEVEL_PROGRESSION: Record<string, string> = {
  A1: 'A2', A2: 'B1', B1: 'B2', B2: 'C1', C1: 'C2', C2: 'C2',
};

const getActivityLabel = (days: number | null): string => {
  if (days === null) return 'no activity';
  if (days === 0) return 'active today';
  if (days === 1) return 'active 1 day ago';
  if (days < 30) return `active ${days} days ago`;
  if (days < 60) return 'active 1 month ago';
  return `active ${Math.floor(days / 30)} months ago`;
};

const getActivityColorClass = (days: number | null): string => {
  if (days === null || days > 30) return 'bg-red-500/10 text-red-700 dark:text-red-400';
  if (days <= 7) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
};

export const StudentNavBadges: React.FC<StudentNavBadgesProps> = ({ englishLevel, daysSinceLastActivity }) => {
  const nextLevel = LEVEL_PROGRESSION[englishLevel] || englishLevel;
  const levelLabel = englishLevel === nextLevel ? englishLevel : `${englishLevel} → ${nextLevel}`;
  const activityClass = getActivityColorClass(daysSinceLastActivity);

  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary whitespace-nowrap">
        <GraduationCap className="h-3 w-3" />
        {levelLabel}
      </span>
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap', activityClass)}>
        <Activity className="h-3 w-3" />
        {getActivityLabel(daysSinceLastActivity)}
      </span>
    </div>
  );
};
