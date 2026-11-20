import type { ReactNode } from 'react';
import { format } from 'date-fns';
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle,
  Eye,
  Lightbulb,
  MessageCircle,
  MessageSquarePlus,
  Star,
  StickyNote,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { LEVEL_IN_PRACTICE } from '@/components/welcome-test/PlacementReportBody';
import { buildPlacementAccountPreview, readPlacementSelfAssessedLevel } from '@/lib/welcomeTest/placementAccountPreview';
import type { PlacementPreviewTrait } from '@/lib/welcomeTest/placementAccountPreview';
import {
  PUBLIC_PLACEMENT_CONFIDENCE_ROWS,
  type PublicPlacementResult,
} from '@/lib/welcomeTest/publicPlacementTest';
import {
  interpretSelfAwareness,
  selfAssessmentAccuracyLabel,
  traitValueLabel,
} from '@/lib/welcomeTest/traitLabels';

function SampleBadge() {
  return (
    <Badge variant="outline" className="shrink-0 border-dashed border-primary/60 text-[10px] uppercase tracking-wide text-primary">
      Sample view
    </Badge>
  );
}

function PreviewCard({ title, icon, children, className = '' }: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`rounded-2xl bg-card/95 ${className}`}>
      <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base leading-6 sm:text-lg">{icon}{title}</CardTitle>
          <SampleBadge />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">{children}</CardContent>
    </Card>
  );
}

function formatPreviewDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '-';
  return format(new Date(timestamp), 'dd MMM yyyy');
}

function SummaryStat({ value, label, highlighted = false }: {
  value: string | number;
  label: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 text-center sm:p-4 ${highlighted ? 'bg-primary/10' : 'bg-muted/30'}`}>
      <p className={`text-xl font-bold sm:text-2xl ${highlighted ? 'text-primary' : ''}`}>{value}</p>
      <p className="mt-1 text-xs leading-4 text-muted-foreground">{label}</p>
    </div>
  );
}

const KEYED_SKILLS = [
  { key: 'grammar', label: 'Grammar' },
  { key: 'vocabulary', label: 'Vocabulary' },
  { key: 'reading', label: 'Reading' },
  { key: 'listening', label: 'Listening' },
] as const;

function strongestAndWeakest(result: PublicPlacementResult) {
  const scored = KEYED_SKILLS
    .flatMap(({ key, label }) => {
      const score = result.skills[key]?.score ?? null;
      return score === null ? [] : [{ label, score }];
    })
    .sort((a, b) => b.score - a.score);
  return {
    strongest: scored[0]?.label ?? null,
    weakest: scored.length > 1 ? scored[scored.length - 1].label : null,
  };
}

function SampleFeedbackControls({ trait }: { trait: PlacementPreviewTrait }) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Sample teacher feedback for ${trait.label}`}>
      {['Agree', 'Partly', 'Disagree'].map((verdict) => (
        <Button
          key={verdict}
          type="button"
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[11px]"
          disabled
          title="Available in your teacher account"
        >
          {verdict}
        </Button>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 px-1.5 text-[11px] text-muted-foreground"
        disabled
        title="Available in your teacher account"
      >
        <MessageSquarePlus className="mr-1 h-3 w-3" aria-hidden="true" />
        Add note
      </Button>
    </div>
  );
}

/**
 * Illustrative mock-up of the teacher account test view for a teacher without an account.
 * Public summary values stay attached to this report. Account-only analysis, trait
 * feedback, answers and notes are fixed examples and never trigger reads or writes.
 */
export function SampleTeacherAccountPreview({ result, name, showSignup, onSignup }: {
  result: PublicPlacementResult;
  name: string;
  showSignup: boolean;
  onSignup: () => void;
}) {
  const preview = buildPlacementAccountPreview(result);
  const keyedTotal = result.keyedQuestionCount
    ?? Object.values(result.skills).reduce((sum, skill) => sum + (skill?.total ?? 0), 0);
  const keyedCorrect = result.keyedCorrectCount
    ?? Object.values(result.skills).reduce((sum, skill) => sum + (skill?.correct ?? 0), 0);
  const keyedAnswered = result.keyedAnsweredCount
    ?? Object.values(result.skills).reduce((sum, skill) => sum + (skill?.answered ?? 0), 0);
  const profileCount = result.profileQuestionCount ?? Math.max(0, result.totalQuestions - keyedTotal);
  const skillScore = keyedAnswered > 0 && keyedTotal > 0
    ? Math.round((keyedCorrect / keyedTotal) * 100)
    : null;
  const previewDate = formatPreviewDate(result.completedAt);
  const { strongest, weakest } = strongestAndWeakest(result);
  const confidence = result.confidenceMatrix ?? {};
  const interests = result.interestTopics ?? [];
  const selfAssessedLevel = readPlacementSelfAssessedLevel(result);

  return (
    <section aria-label="Sample teacher account view" className="space-y-4 rounded-3xl border-2 border-dashed border-primary/50 bg-primary/5 p-3 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Eye className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <h2 className="text-xs font-semibold uppercase tracking-wide text-primary">Preview: inside your Edooqoo teacher account</h2>
        <SampleBadge />
      </div>

      <div role="note" className="rounded-2xl border border-primary/30 bg-background/80 p-3 text-sm leading-6">
        <p><span className="font-semibold">This is a sample account view, not {name}'s full result.</span></p>
        <p className="mt-1 text-muted-foreground">
          Summary metrics, level, skills, interests and confidence come from the report above. AI analysis, trait feedback,
          question answers and teacher notes are fixed examples. The real AI analysis for {name} is generated only after you add {name} to Edooqoo.
        </p>
      </div>

      <PreviewCard title={`Welcome Test - ${name}`} icon={<Target className="h-5 w-5 text-primary" aria-hidden="true" />}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary">Reviewed</Badge>
            <SampleBadge />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Example timeline: Created: {previewDate} · Completed: {previewDate} · Reviewed: {previewDate}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
            <SummaryStat value={`${result.answeredCount}/${result.totalQuestions}`} label="Answered" />
            <SummaryStat value={skillScore === null ? '-' : `${skillScore}%`} label="Skill Score (keyed items)" highlighted />
            <SummaryStat value={`${keyedCorrect}/${keyedTotal}`} label="Skill Questions Correct" />
            <SummaryStat value={profileCount} label="Profile Questions" />
          </div>
          <Progress value={skillScore ?? 0} className="h-3" aria-label="Skill score from the report summary" />
          <p className="text-xs text-muted-foreground">Summary values come from {name}'s report above. The account layout and reviewed timeline are illustrative.</p>
        </div>
      </PreviewCard>

      <PreviewCard title="AI Analysis" icon={<Bot className="h-5 w-5 text-primary" aria-hidden="true" />} className="border-primary/30 bg-primary/5">
        <div className="space-y-4">
          <p className="text-sm leading-6">{preview.aiSummary.summary}</p>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Key Observations</p>
            <ul className="space-y-1.5">
              {preview.aiSummary.keyObservations.map((observation) => (
                <li key={observation} className="flex items-start gap-2 text-sm leading-5">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <span>{observation}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Lightbulb className="h-3 w-3" aria-hidden="true" />Recommendations
            </p>
            <ul className="space-y-2">
              {preview.aiSummary.recommendations.map((recommendation) => (
                <li key={recommendation} className="flex items-start gap-2 rounded-xl bg-background/70 p-2.5 text-sm leading-5">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Writing Quality:</span>
            <Badge variant="secondary">{preview.aiSummary.writingQuality}</Badge>
          </div>
        </div>
      </PreviewCard>

      {preview.level && (
        <Card className="rounded-2xl border-primary/40 bg-primary/5">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">Suggested level change: Current level → {preview.level}</p>
                    <SampleBadge />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">In your account, you can keep the current level or apply the test estimate.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" disabled title="Available in your teacher account">Keep current</Button>
                <Button size="sm" disabled title="Available in your teacher account">Apply {preview.level}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <PreviewCard title="Level Assessment" icon={<TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />}>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-primary/5 p-4 text-center">
              <p className="text-2xl font-bold text-primary">{result.level ?? '-'}</p>
              <p className="mt-1 text-xs text-muted-foreground">Estimated Level</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-4 text-center">
              <p className="text-base font-semibold sm:text-xl">{selfAssessedLevel ? traitValueLabel('self_assessed_level', selfAssessedLevel) : '-'}</p>
              <p className="mt-1 text-xs text-muted-foreground">Self-Assessed</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-4 text-center">
              <Badge variant={result.levelConfidence === 'accurate' ? 'default' : 'secondary'}>
                {result.levelConfidence ? selfAssessmentAccuracyLabel(result.levelConfidence) : 'No signal'}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">Self-assessment accuracy</p>
            </div>
          </div>
          {result.level && <p className="text-sm leading-6 text-muted-foreground">{LEVEL_IN_PRACTICE[result.level]}</p>}

          <div className="rounded-xl border border-border p-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Self-awareness</p>
            <p className="text-sm"><span className="text-muted-foreground">Admits not knowing: </span><span className="font-medium">{result.selfAwarenessScore === null ? '-' : `${result.selfAwarenessScore}%`}</span></p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{interpretSelfAwareness(result.selfAwarenessScore)}</p>
          </div>

          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-medium"><MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />Confidence Self-Assessment (1-5)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {PUBLIC_PLACEMENT_CONFIDENCE_ROWS.map((row) => {
                const value = confidence[row.key];
                return (
                  <div key={row.key} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 p-2.5" aria-label={`${row.label}: ${value ?? 'not answered'} of 5`}>
                    <span className="min-w-0 text-sm">{row.label}</span>
                    <div className="flex shrink-0 gap-0.5" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={`h-3 w-3 rounded-full ${value && n <= value ? 'bg-primary' : 'bg-muted'}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </PreviewCard>

      <PreviewCard title="Skill Scores" icon={<Star className="h-5 w-5 text-primary" aria-hidden="true" />}>
        <div className="space-y-4">
          {KEYED_SKILLS.map(({ key, label }) => {
            const skill = result.skills[key];
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>{label}</span>
                  <span className="text-right text-xs text-muted-foreground">
                    {!skill || skill.score === null ? 'Not scored' : `${skill.score}% (${skill.correct}/${skill.answered})`}
                  </span>
                </div>
                <Progress value={skill?.score ?? 0} className="h-2" aria-label={`${label} score from the report summary`} />
              </div>
            );
          })}
          {[
            { label: 'Writing', count: result.openResponseCount, noun: 'written answer' },
            { label: 'Speaking', count: result.recordingCount, noun: 'recording' },
          ].map((row) => (
            <div key={row.label} className="space-y-1.5">
              <div className="flex flex-col gap-1 text-sm min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between min-[420px]:gap-3">
                <span>{row.label}</span>
                <span className="text-xs text-muted-foreground min-[420px]:text-right">
                  {row.count > 0 ? `${row.count} ${row.noun}${row.count === 1 ? '' : 's'}, scored in the full account` : 'Skipped'}
                </span>
              </div>
              <Progress value={0} className="h-2" aria-label={`${row.label} is not scored in the public summary`} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1 text-sm">
            <Badge variant="default">Strongest: {strongest ?? '-'}</Badge>
            <Badge variant="outline">Weakest: {weakest ?? '-'}</Badge>
          </div>
        </div>
      </PreviewCard>

      <PreviewCard title="Learner Profile" icon={<Brain className="h-5 w-5 text-primary" aria-hidden="true" />}>
        <div className="space-y-5 text-sm">
          <p className="rounded-xl bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
            Example profile signals and disabled teacher-feedback controls. They do not describe {name} and nothing is saved from this preview.
          </p>
          {preview.traitsData.map((group) => (
            <section key={group.id} aria-label={`Sample ${group.title}`}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{group.title}</p>
                <SampleBadge />
              </div>
              <div className="divide-y rounded-lg border">
                {group.traits.map((trait) => (
                  <div key={trait.key} className="space-y-2 px-3 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{trait.label}</p>
                        <p className="mt-0.5 text-sm font-medium">{trait.value}</p>
                      </div>
                      {trait.confidence && <Badge variant="outline" className="text-[10px]">{trait.confidence.chip}</Badge>}
                    </div>
                    {trait.basedOn && (
                      <p className="text-[11px] leading-4 text-muted-foreground">
                        {trait.confidence ? `${trait.confidence.note}: ` : 'Based on: '}{trait.basedOn}
                      </p>
                    )}
                    <SampleFeedbackControls trait={trait} />
                  </div>
                ))}
              </div>
            </section>
          ))}
          {interests.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Target className="h-3.5 w-3.5 text-primary" aria-hidden="true" />Interest Topics</p>
              <div className="flex flex-wrap gap-2">
                {interests.map((topic) => <Badge key={topic} variant="outline" className="text-sm">{topic}</Badge>)}
              </div>
            </div>
          )}
        </div>
      </PreviewCard>

      <PreviewCard title="Questions" icon={<MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />}>
        <p className="mb-4 text-xs leading-5 text-muted-foreground">Three fixed examples from the question bank. These are not {name}'s answers.</p>
        <div className="space-y-4">
          {preview.sampleQuestions.map((question, index) => (
            <article key={question.id} className="rounded-lg border bg-muted/30 p-3 sm:p-4" aria-label={`Sample question ${index + 1}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">{question.questionType.replace(/_/g, ' ')}</Badge>
                    {question.elementType && <Badge variant="secondary" className="text-xs">{question.elementType}</Badge>}
                    {question.isCorrect === true && <CheckCircle className="h-4 w-4 text-primary" aria-label="Correct sample answer" />}
                    <SampleBadge />
                  </div>
                  <p className="text-sm leading-6">{question.questionText}</p>
                  {question.description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{question.description}</p>}
                  <div className="mt-3 flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:gap-2">
                    <span className="shrink-0 text-muted-foreground">Sample student's answer:</span>
                    <span className={question.isCorrect === true ? 'font-medium text-primary' : ''}>{question.studentAnswer}</span>
                  </div>
                  {question.isCorrect === false && question.correctAnswer && (
                    <div className="mt-1 flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:gap-2">
                      <span className="shrink-0 text-muted-foreground">Correct answer:</span>
                      <span className="font-medium text-primary">{question.correctAnswer}</span>
                    </div>
                  )}
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <StickyNote className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                      <span className="text-[11px] font-medium text-muted-foreground">Teacher note</span>
                    </div>
                    <Textarea
                      value={question.teacherNote}
                      placeholder={question.teacherNotePlaceholder}
                      className="min-h-[56px] resize-none text-xs"
                      aria-label={`Sample teacher note for question ${index + 1}`}
                      disabled
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </PreviewCard>

      <PreviewCard title="From result to first lesson" icon={<Target className="h-5 w-5 text-primary" aria-hidden="true" />}>
        <div className="space-y-4">
          {preview.goals.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Starter goals Edooqoo creates for {name}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {preview.goals.map((goal) => <li key={goal} className="rounded-xl border border-border bg-background/70 p-3 text-sm leading-5">{goal}</li>)}
              </ul>
            </div>
          )}
          {preview.firstLesson && (
            <div className="rounded-xl border border-border bg-background/70 p-3 text-sm leading-6">
              <span className="font-medium">Suggested first lesson{preview.level ? ` (${preview.level})` : ''}: </span>
              {preview.firstLesson}, generated in about a minute.
            </div>
          )}
          <p className="text-xs leading-5 text-muted-foreground">These goals and the first-lesson direction use {name}'s summary. The full account analysis above is illustrative.</p>
          {showSignup && (
            <Button className="h-auto min-h-10 w-full max-w-full whitespace-normal rounded-full sm:w-auto" onClick={onSignup}>
              Create free account and see {name}'s real analysis<ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </PreviewCard>

      <p className="text-xs leading-5 text-muted-foreground">Also in your account: {name}'s profile, lesson pacing suggestions, homework and flashcards that update the learning model.</p>
    </section>
  );
}
