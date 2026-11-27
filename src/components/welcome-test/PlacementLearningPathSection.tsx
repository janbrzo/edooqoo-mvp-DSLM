import { ArrowRight, Loader2, Map, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PlacementLearningPathState } from '@/lib/welcomeTest/placementReportApi';

interface Props {
  state: PlacementLearningPathState;
  studentName: string;
  generating: boolean;
  available: boolean;
  claimed: boolean;
  registered: boolean;
  error: string | null;
  onGenerate: () => void;
  onOpenAccount: () => void;
}

export function PlacementLearningPathSection(props: Props) {
  const busy = props.generating || props.state.status === 'running';
  const error = props.error ?? (props.state.status === 'failed' ? props.state.error : null);
  const canRetry = props.state.status !== 'failed' || props.state.retryable;
  const accountLabel = props.claimed
    ? 'Open learning path on my account'
    : props.registered
      ? `Add ${props.studentName} and open learning path`
      : 'Create free account to save and edit learning path';

  return (
    <section className="space-y-4 py-4" aria-labelledby="placement-learning-path-heading">
      <div className="space-y-1">
        <h2 id="placement-learning-path-heading" className="text-xl font-semibold flex items-center gap-2">
          <Map className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />Learning path
        </h2>
        <p className="text-sm text-muted-foreground">
          A multi-week macro roadmap built from {props.studentName}&apos;s placement gaps and goals.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {props.state.status === 'ready' ? (
        <div className="space-y-4">
          <ol className="space-y-3" aria-label="Learning path phases">
            {props.state.phases.map((phase) => (
              <li key={phase.id}>
                <Card className="rounded-lg min-w-0">
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-xs font-semibold text-primary-foreground">
                        {phase.sequenceNumber}
                      </span>
                      <h3 className="font-semibold break-words flex-1 min-w-0">{phase.title}</h3>
                      <Badge variant="secondary" className="shrink-0">
                        Weeks {phase.estimatedWeeksStart}–{phase.estimatedWeeksEnd}
                      </Badge>
                    </div>
                    <p className="text-sm break-words">{phase.description}</p>
                    {phase.focusAreas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {phase.focusAreas.map((area) => (
                          <Badge key={area} variant="outline" className="text-xs font-normal break-words">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {phase.rationale && (
                      <p className="text-sm text-muted-foreground break-words">{phase.rationale}</p>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
          <Button onClick={props.onOpenAccount} disabled={props.generating} className="w-full sm:w-auto h-auto min-h-10 whitespace-normal">
            {props.claimed ? <ArrowRight className="h-4 w-4 shrink-0" /> : <UserPlus className="h-4 w-4 shrink-0" />}
            {accountLabel}
          </Button>
        </div>
      ) : props.claimed ? null : (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={props.onGenerate} disabled={busy || !props.available || !canRetry} className="h-auto min-h-10 whitespace-normal">
            {busy ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Map className="h-4 w-4 shrink-0" />}
            {busy ? 'Building learning path...' : error && canRetry ? 'Try again' : 'Generate learning path from this test'}
          </Button>
          <Button variant="outline" onClick={props.onOpenAccount} disabled={props.generating} className="h-auto min-h-10 whitespace-normal">
            <UserPlus className="h-4 w-4 shrink-0" />
            {props.registered ? 'Build on my account instead' : 'Create account to build learning path'}
          </Button>
        </div>
      )}
      {!props.available && !props.claimed && (
        <p role="status" className="text-sm text-muted-foreground">
          The learning path will be available when the placement analysis is complete.
        </p>
      )}
      {busy && <p role="status" className="text-sm text-muted-foreground">Building learning path...</p>}
    </section>
  );
}