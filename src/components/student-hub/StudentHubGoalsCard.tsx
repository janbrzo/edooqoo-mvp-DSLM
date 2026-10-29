import React, { useMemo } from 'react';
import { Target, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { buildHubGoalViews, goalStatusLabel, type HubGoal } from '@/lib/studentHub/hubGoals';

interface Props {
  goals: HubGoal[];
  now?: Date;
}

export const StudentHubGoalsCard: React.FC<Props> = ({ goals, now }) => {
  const views = useMemo(() => buildHubGoalViews(goals, now ?? new Date()), [goals, now]);
  if (views.length === 0) return null;
  const achieved = views.filter((v) => v.status === 'achieved').length;

  return (
    <section aria-labelledby="hub-goals-title">
      <div className="flex items-center justify-between mb-3">
        <h2 id="hub-goals-title" className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-4 w-4" /> My Goals
        </h2>
        <span className="text-xs text-muted-foreground">
          {achieved} of {views.length} achieved
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {views.map((g) => (
          <Card key={g.id} data-testid="hub-goal">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm flex items-center gap-1.5">
                  {g.status === 'achieved' && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  {g.title}
                </p>
                <Badge variant={g.status === 'overdue' ? 'destructive' : g.status === 'achieved' ? 'default' : 'secondary'} className="text-xs shrink-0">
                  {goalStatusLabel(g)}
                </Badge>
              </div>
              {g.description && <p className="text-xs text-muted-foreground line-clamp-2">{g.description}</p>}
              {g.progressPct !== null && (
                <div className="flex items-center gap-2">
                  <Progress value={g.progressPct} className="h-1.5" aria-label={`${g.title} progress`} />
                  <span className="text-xs text-muted-foreground tabular-nums">{g.progressPct}%</span>
                </div>
              )}
              {g.target_date && g.status !== 'achieved' && (
                <p className="text-xs text-muted-foreground">Target: {format(parseISO(g.target_date), 'd MMM yyyy')}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};
