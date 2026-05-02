/**
 * BehavioralStatsCard — grid of behavioral statistics calculated from system data
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, XCircle, BookOpen, GraduationCap, BarChart3, Activity } from 'lucide-react';
import type { BehavioralStats } from '@/hooks/dslm/useBehavioralStats';

interface BehavioralStatsCardProps {
  stats: BehavioralStats;
  loading: boolean;
}

const StatItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
    <div className="min-w-0">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  </div>
);

export const BehavioralStatsCard: React.FC<BehavioralStatsCardProps> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <StatItem
        icon={CalendarDays}
        label="Lessons / week"
        value={stats.lessonsPerWeek !== null ? `${stats.lessonsPerWeek}×` : 'No data'}
      />
      <StatItem
        icon={XCircle}
        label="Cancellations (30d)"
        value={stats.cancellationRate !== null ? `${stats.cancellationsLast30d} (${stats.cancellationRate}%)` : 'No data'}
      />
      <StatItem
        icon={BookOpen}
        label="Homework"
        value={stats.homeworkTotal > 0 ? `${stats.homeworkCompleted}/${stats.homeworkTotal} (${stats.homeworkCompletionRate}%)` : 'No data'}
      />
      <StatItem
        icon={GraduationCap}
        label="Flashcard sets"
        value={String(stats.flashcardSetsCount)}
      />
      <StatItem
        icon={BarChart3}
        label="Flashcard reviews"
        value={String(stats.totalFlashcardReviews)}
      />
      <StatItem
        icon={Activity}
        label="Last active"
        value={stats.daysSinceLastActivity !== null ? `${stats.daysSinceLastActivity}d ago` : 'No data'}
      />
    </div>
  );
};
