import { ArrowRight, FileText, Loader2, Sparkles, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PlacementLessonProposal, PlacementNextStepsState } from '@/lib/welcomeTest/placementReportApi';

interface Props {
  state: PlacementNextStepsState;
  generating: boolean;
  available: boolean;
  claimed: boolean;
  registered: boolean;
  error: string | null;
  onGenerate: () => void;
  onPrepare: (lesson: PlacementLessonProposal) => void;
  onSave: (lesson: PlacementLessonProposal) => void;
}

export function PlacementNextStepsSection(props: Props) {
  const busy = props.generating || props.state.status === 'running';
  const error = props.error ?? (props.state.status === 'failed' ? props.state.error : null);
  const canRetry = props.state.status !== 'failed' || props.state.retryable;
  return (
    <section className="space-y-4 py-4" aria-labelledby="placement-next-steps-heading">
      <h2 id="placement-next-steps-heading" className="text-xl font-semibold flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary shrink-0" />First lesson proposals
      </h2>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {props.state.status === 'ready' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {props.state.suggestions.map(lesson => (
            <Card key={lesson.id} className="rounded-lg min-w-0">
              <CardContent className="p-4 h-full flex flex-col gap-3">
                <Badge variant="secondary" className="self-start">{lesson.difficulty}</Badge>
                <h3 className="font-semibold break-words">{lesson.topic}</h3>
                {lesson.goal && <p className="text-sm break-words">{lesson.goal}</p>}
                {lesson.rationale && <p className="text-sm text-muted-foreground break-words">{lesson.rationale}</p>}
                <div className="mt-auto space-y-2 pt-2">
                  <Button variant="outline" className="w-full h-auto min-h-10 whitespace-normal" onClick={() => props.onPrepare(lesson)} disabled={props.generating}>
                    <FileText className="h-4 w-4 shrink-0" />Prepare worksheet
                  </Button>
                  <Button className="w-full h-auto min-h-10 whitespace-normal" onClick={() => props.onSave(lesson)} disabled={props.generating}>
                    {props.claimed ? <ArrowRight className="h-4 w-4 shrink-0" /> : <UserPlus className="h-4 w-4 shrink-0" />}
                    {props.claimed ? 'Prepare on my account' : props.registered ? 'Add student and prepare' : 'Create account and prepare'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : props.claimed ? null : (
        <Button onClick={props.onGenerate} disabled={busy || !props.available || !canRetry} className="h-auto min-h-10 whitespace-normal">
          {busy ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Sparkles className="h-4 w-4 shrink-0" />}
          {busy ? 'Preparing three lessons...' : error && canRetry ? 'Try again' : 'Generate 3 lesson proposals from this test'}
        </Button>
      )}
      {!props.available && !props.claimed && <p role="status" className="text-sm text-muted-foreground">Lesson proposals will be available when the placement analysis is complete.</p>}
      {busy && <p role="status" className="text-sm text-muted-foreground">Preparing lesson proposals...</p>}
    </section>
  );
}