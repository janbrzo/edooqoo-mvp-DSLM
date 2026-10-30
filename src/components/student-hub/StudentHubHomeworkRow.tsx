import { format, parseISO, isValid } from 'date-fns';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { homeworkLifecycle, type HubHomework } from '@/lib/studentHub/homeworkLifecycle';

interface Props {
  homework: HubHomework;
  now: number;
  onFeedback: (id: string) => void;
}

function dateLabel(value: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, 'MMM d, yyyy') : null;
}

export function StudentHubHomeworkRow({ homework: hw, now, onFeedback }: Props) {
  const lifecycle = homeworkLifecycle(hw, now);
  const label = { open: 'To Do', submitted: 'In Review', reviewed: 'Reviewed', closed: 'Closed by teacher' }[lifecycle.state];
  const due = dateLabel(hw.deadline);
  const assigned = dateLabel(hw.created_at);

  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <p className="font-medium text-sm break-words">{hw.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={lifecycle.state === 'reviewed' ? 'default' : 'secondary'}>{label}</Badge>
            {lifecycle.overdue && <Badge variant="destructive">Overdue</Badge>}
            {lifecycle.state === 'open' && <span className="text-xs text-muted-foreground">{hw.completed_exercises_count}/{hw.exercises_count} done</span>}
            {due && <span className={`text-xs ${lifecycle.overdue ? 'text-destructive' : 'text-muted-foreground'}`}>Due: {due}</span>}
          </div>
          {hw.source_worksheet_title && <p className="text-xs text-muted-foreground break-words">From: {hw.source_worksheet_title}</p>}
          {assigned && <p className="text-xs text-muted-foreground">Assigned: {assigned}</p>}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {lifecycle.canReadFeedback && <Button variant="default" size="sm" onClick={() => onFeedback(hw.id)}><MessageSquare /> View Feedback</Button>}
          <Button asChild variant="outline" size="sm">
            <a href={`/homework/${hw.share_token}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> {lifecycle.state === 'open' ? 'Continue' : 'Open'}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}