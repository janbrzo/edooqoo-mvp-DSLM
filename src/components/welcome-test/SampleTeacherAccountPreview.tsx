import { ArrowRight, Brain, Eye, Lightbulb, Target, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildPlacementAccountPreview } from '@/lib/welcomeTest/placementAccountPreview';
import type { PublicPlacementResult } from '@/lib/welcomeTest/publicPlacementTest';

function SampleBadge() {
  return <Badge variant="outline" className="border-dashed border-primary/60 text-primary text-[10px] uppercase tracking-wide">Sample view</Badge>;
}

/**
 * Illustrative mock-up of the teacher account test view for a teacher without an account.
 * Every block is labelled as a sample: AI analysis is only generated after the student is added.
 */
export function SampleTeacherAccountPreview({ result, name, showSignup, onSignup }: {
  result: PublicPlacementResult; name: string; showSignup: boolean; onSignup: () => void;
}) {
  const preview = buildPlacementAccountPreview(result);
  return (
    <section aria-label="Sample teacher account view" className="rounded-3xl border-2 border-dashed border-primary/50 bg-primary/5 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Eye className="h-5 w-5 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Preview: inside your Edooqoo teacher account</p>
        <SampleBadge />
      </div>
      <div role="note" className="rounded-2xl border border-primary/30 bg-background/80 p-3 text-sm leading-6">
        <span className="font-semibold">This is a sample, not {name}'s result.</span> It shows how the full analysis looks in your account.
        The real AI analysis for {name} is generated only after you add {name} to Edooqoo. {name}'s actual result is the report above.
      </div>

      <Card className="rounded-3xl opacity-95">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg"><Brain className="h-4 w-4 text-primary" />AI Analysis</CardTitle>
            <SampleBadge />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          <p className="text-muted-foreground italic">Example summary: "The learner handles familiar topics with confidence but loses accuracy under time pressure. Self-assessment matches the measured level, a good basis for goal-setting."</p>
          <div>
            <p className="font-medium mb-1">Key Observations (example)</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Patterns across grammar items, for example recurring tense or article errors.</li>
              <li>Range and register in the open writing answer.</li>
              <li>Gaps between declared goals and what the scenarios revealed.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Recommendations (example)</p>
            {['Start with short, work-related speaking tasks to build fluency.', 'Recycle target vocabulary through flashcards between lessons.'].map((text) => (
              <div key={text} className="flex items-start gap-2 rounded-2xl bg-muted/40 p-2.5 text-muted-foreground">
                <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-1" />{text}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2"><span className="text-muted-foreground">Writing Quality:</span><Badge variant="secondary">example</Badge></div>
        </CardContent>
      </Card>

      {preview.level && (
        <div className="rounded-2xl border border-border bg-background/70 p-3 flex flex-wrap items-center gap-3 text-sm">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span>Suggested level change: <span className="font-semibold">current → {preview.level}</span></span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" disabled className="rounded-full">Keep</Button>
            <Button size="sm" disabled className="rounded-full">Apply</Button>
          </div>
          <SampleBadge />
        </div>
      )}

      {preview.goals.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Starter goals Edooqoo creates for {name}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {preview.goals.map((goal) => <li key={goal} className="rounded-2xl bg-background/70 border border-border p-3 text-sm">{goal}</li>)}
          </ul>
        </div>
      )}
      {preview.firstLesson && (
        <div className="rounded-2xl bg-background/70 border border-border p-3 text-sm leading-6">
          <span className="font-medium">Suggested first lesson{preview.level ? ` (${preview.level})` : ''}: </span>{preview.firstLesson}, generated in about a minute.
        </div>
      )}
      <p className="text-xs leading-5 text-muted-foreground">Sample view for illustration. Also in your account: {name}'s profile, lesson pacing suggestions, homework and flashcards that update the learning model.</p>
      {showSignup && (
        <Button className="rounded-full max-w-full h-auto min-h-10 whitespace-normal" onClick={onSignup}>Create free account and see {name}'s real analysis<ArrowRight className="h-4 w-4" /></Button>
      )}
    </section>
  );
}
