import React from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

interface DashboardHeaderProps {
  firstName: string | null;
  studentsCount: number;
  lessonsThisWeek: number;
  onAddStudent: () => void;
}

export function getGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * v6.9.109 — Today dashboard header: greeting + one-line context + the only
 * secondary action on the page (Add student).
 */
export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  firstName,
  studentsCount,
  lessonsThisWeek,
  onAddStudent,
}) => {
  const greeting = getGreeting(new Date().getHours());
  const lessons = lessonsThisWeek === 0 ? 'no lessons booked this week' : `${plural(lessonsThisWeek, 'lesson')} this week`;

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {greeting}, {firstName?.trim() || 'Teacher'}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {plural(studentsCount, 'student')} · {lessons}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onAddStudent}>
        <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
        Add student
      </Button>
    </header>
  );
};

export default DashboardHeader;
