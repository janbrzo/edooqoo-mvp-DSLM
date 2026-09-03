import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { formatGoal } from '@/lib/students/formatGoal';
import type { NextUpStudent } from '@/hooks/useNextUpStudents';

interface NextUpCardProps {
  item: NextUpStudent;
}

/** `Today 18:00` / `Tomorrow 18:00` / `Tue 18:00` from a slot date + time. */
export function formatLesson(lesson: { date: string; time: string }): string {
  const hhmm = lesson.time.slice(0, 5);
  const day = parseISO(lesson.date);
  if (isToday(day)) return `Today ${hhmm}`;
  if (isTomorrow(day)) return `Tomorrow ${hhmm}`;
  return `${format(day, 'EEE')} ${hhmm}`;
}

/**
 * v6.9.109 — unit of work on the Today dashboard. The "Prepare next lesson"
 * button is the only `variant="default"` control on the page.
 */
export const NextUpCard: React.FC<NextUpCardProps> = ({ item }) => {
  const navigate = useNavigate();
  const goal = formatGoal(item.mainGoal);

  return (
    <Card className="border-border transition-colors hover:border-primary/40">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Link to={`/student/${item.id}`} className="truncate font-semibold text-foreground hover:underline">
            {item.name}
          </Link>
          {item.englishLevel && (
            <Badge variant="secondary" className="shrink-0">
              {item.englishLevel}
            </Badge>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {item.nextLesson ? formatLesson(item.nextLesson) : 'No lesson booked'}
        </p>

        <p className="line-clamp-2 text-sm text-foreground">
          {item.focusSignal ? (
            <>
              <span className="text-muted-foreground">Struggled with:</span> {item.focusSignal}
            </>
          ) : goal ? (
            <>
              <span className="text-muted-foreground">Goal:</span> {goal}
            </>
          ) : (
            <span className="text-muted-foreground">No signals yet — start with a worksheet</span>
          )}
        </p>

        <Button
          className="mt-auto w-full"
          onClick={() => navigate(`/student/${item.id}?tab=dslm`)}
          aria-label={`Prepare next lesson for ${item.name}`}
        >
          Prepare next lesson
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default NextUpCard;
