import { Lock, MessageCircle, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PUBLIC_PLACEMENT_CONFIDENCE_ROWS, type PublicPlacementResult } from '@/lib/welcomeTest/publicPlacementTest';
import {
  humanizeDivergenceText,
  interpretSelfAwareness,
  selfAssessmentAccuracyLabel,
  traitLabel,
  traitValueLabel,
} from '@/lib/welcomeTest/traitLabels';

export type PlacementAudience = 'teaser' | 'student' | 'teacher';

const skillLabels = { grammar: 'Grammar', vocabulary: 'Vocabulary', reading: 'Reading', listening: 'Listening' } as const;
const profileTraits = ['motivation_type', 'latent_goal', 'preferred_input_channel', 'homework_commitment', 'feedback_preference'] as const;

/** Plain-language meaning of a CEFR level for an adult learner. */
export const LEVEL_IN_PRACTICE: Record<string, string> = {
  A1: 'You can handle simple, familiar exchanges when the other person speaks slowly.',
  A2: 'You can manage routine tasks and short conversations about familiar topics.',
  B1: 'You can deal with most everyday and work situations and describe experiences and plans.',
  B2: 'You can take part in meetings and discussions with reasonable fluency and argue a point.',
  C1: 'You can express yourself fluently and flexibly in professional and social settings.',
  C2: 'You can understand virtually everything and express fine shades of meaning.',
};

function strongestAndWeakest(result: PublicPlacementResult) {
  const scored = (Object.keys(skillLabels) as Array<keyof typeof skillLabels>)
    .map((key) => ({ key, score: result.skills[key]?.score ?? null }))
    .filter((item): item is { key: keyof typeof skillLabels; score: number } => item.score !== null)
    .sort((a, b) => b.score - a.score);
  return { strongest: scored[0] ?? null, weakest: scored.length > 1 ? scored[scored.length - 1] : null };
}

export function PlacementReportBody({ result, audience }: { result: PublicPlacementResult; audience: PlacementAudience }) {
  const availableTraits = profileTraits.filter((key) => result.traits[key]);
  const { strongest, weakest } = strongestAndWeakest(result);
  const isTeacher = audience === 'teacher';

  const keyedTotal = result.keyedQuestionCount ?? Object.values(result.skills).reduce((sum, skill) => sum + (skill?.total ?? 0), 0);
  const keyedCorrect = result.keyedCorrectCount ?? Object.values(result.skills).reduce((sum, skill) => sum + (skill?.correct ?? 0), 0);
  const keyedAnswered = result.keyedAnsweredCount ?? Object.values(result.skills).reduce((sum, skill) => sum + (skill?.answered ?? 0), 0);
  const profileCount = result.profileQuestionCount ?? Math.max(0, result.totalQuestions - keyedTotal);
  const skillScore = keyedAnswered > 0 && keyedTotal > 0 ? Math.round((keyedCorrect / keyedTotal) * 100) : null;
  const confidence = result.confidenceMatrix ?? {};
  const hasConfidence = Object.keys(confidence).length > 0;
  const interests = result.interestTopics ?? [];

  return (
    <div className="space-y-5">
      {isTeacher && (
        <>
          <Card className="rounded-3xl">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-muted/40 p-3 text-center">
                  <p className="text-2xl font-bold">{result.answeredCount}/{result.totalQuestions}</p>
                  <p className="text-xs text-muted-foreground">Answered</p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{skillScore === null ? '-' : `${skillScore}%`}</p>
                  <p className="text-xs text-muted-foreground">Skill Score (keyed items)</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-3 text-center">
                  <p className="text-2xl font-bold">{keyedCorrect}/{keyedTotal}</p>
                  <p className="text-xs text-muted-foreground">Skill Questions Correct</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-3 text-center">
                  <p className="text-2xl font-bold">{profileCount}</p>
                  <p className="text-xs text-muted-foreground">Profile Questions</p>
                </div>
              </div>
              <Progress value={(result.answeredCount / result.totalQuestions) * 100} className="h-2" aria-label="Answered questions" />
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader><CardTitle className="text-lg">Level Assessment</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-muted/40 p-3 text-center">
                <p className="text-2xl font-bold text-primary">{result.level ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Estimated Level</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3 text-center">
                <p className="text-base font-semibold">{result.selfAssessedLevel ? traitValueLabel('self_assessed_level', result.selfAssessedLevel) : '-'}</p>
                <p className="text-xs text-muted-foreground">Self-Assessed</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3 text-center">
                <Badge variant="outline">{result.levelConfidence ? selfAssessmentAccuracyLabel(result.levelConfidence) : 'No signal'}</Badge>
                <p className="mt-1 text-xs text-muted-foreground">Self-assessment accuracy</p>
              </div>
              <p className="sm:col-span-3 text-xs leading-5 text-muted-foreground">
                Self-awareness signal: {result.selfAwarenessScore === null ? 'no signal' : `${result.selfAwarenessScore}%`}. {interpretSelfAwareness(result.selfAwarenessScore)}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {!isTeacher && <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-3xl sm:col-span-2">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{isTeacher ? 'Estimated CEFR' : 'Your estimated level'}</p>
            <p className="mt-1 text-2xl font-bold text-primary">{result.level ?? 'Not enough evidence'}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {result.level
                ? isTeacher
                  ? `Self-assessment: ${selfAssessmentAccuracyLabel(result.levelConfidence)}`
                  : LEVEL_IN_PRACTICE[result.level]
                : 'Answer more grammar, vocabulary, reading or listening items for a level estimate.'}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{isTeacher ? 'Self-awareness signal' : 'Strongest area'}</p>
            <p className="mt-1 text-2xl font-bold text-primary">
              {isTeacher
                ? (result.selfAwarenessScore === null ? 'No signal' : `${result.selfAwarenessScore}%`)
                : (strongest ? skillLabels[strongest.key] : 'Not scored')}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isTeacher
                ? interpretSelfAwareness(result.selfAwarenessScore)
                : weakest ? `Best next focus: ${skillLabels[weakest.key].toLowerCase()}.` : 'Keep practising across all skills.'}
            </p>
          </CardContent>
        </Card>
      </div>}

      <Card className="rounded-3xl">
        <CardHeader><CardTitle className="text-lg">{isTeacher ? 'Skill Scores' : 'Your skills'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(Object.keys(skillLabels) as Array<keyof typeof skillLabels>).map((skill) => {
            const data = result.skills[skill];
            return (
              <div key={skill}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{skillLabels[skill]}</span>
                  <span className="text-xs text-muted-foreground">
                    {!data || data.score === null ? 'Not scored' : isTeacher ? `${data.score}% (${data.correct}/${data.answered})` : `${data.score}%`}
                  </span>
                </div>
                <Progress value={data?.score ?? 0} className="h-2" aria-label={`${skillLabels[skill]} score`} />
              </div>
            );
          })}
          {isTeacher && (
            <>
              {[{ label: 'Writing', count: result.openResponseCount, noun: 'written answer' }, { label: 'Speaking', count: result.recordingCount, noun: 'recording' }].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.count > 0 ? `${row.count} ${row.noun}${row.count === 1 ? '' : 's'}, scored after adding the student` : 'Skipped'}
                  </span>
                </div>
              ))}
              {(strongest || weakest) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {strongest && <Badge variant="secondary">Strongest: {skillLabels[strongest.key]}</Badge>}
                  {weakest && <Badge variant="outline">Weakest: {skillLabels[weakest.key]}</Badge>}
                </div>
              )}
            </>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            {isTeacher
              ? `Based on ${result.answeredCount}/${result.totalQuestions} answered items. ${result.openResponseCount} written answers and ${result.recordingCount} recordings stayed on the student's device and are not scored here.`
              : 'Writing and speaking are best reviewed together with your teacher.'}
          </p>
        </CardContent>
      </Card>

      {audience !== 'teaser' && interests.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Target className="h-4 w-4 text-primary" />{isTeacher ? 'Interest Topics' : 'Your interests'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {interests.map((topic) => <Badge key={topic} variant="outline" className="text-sm">{topic}</Badge>)}
          </CardContent>
        </Card>
      )}

      {isTeacher && hasConfidence && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><MessageCircle className="h-4 w-4 text-primary" />Confidence Self-Assessment (1-5)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {PUBLIC_PLACEMENT_CONFIDENCE_ROWS.map((row) => {
              const value = confidence[row.key];
              return (
                <div key={row.key} className="flex items-center justify-between rounded-2xl bg-muted/40 p-3" aria-label={`${row.label}: ${value ?? 'not answered'} of 5`}>
                  <span className="text-sm">{row.label}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-3 w-3 rounded-full ${value && n <= value ? 'bg-primary' : 'bg-muted'}`} />
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {audience !== 'teaser' && availableTraits.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader><CardTitle className="text-lg">{isTeacher ? 'Learning profile' : 'How you learn best'}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {availableTraits.map((key) => (
              <div key={key} className="rounded-2xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{traitLabel(key)}</p>
                <p className="mt-1 text-sm font-medium">{traitValueLabel(key, result.traits[key])}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isTeacher && result.divergences.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader><CardTitle className="text-lg">Declared needs vs what the scenarios revealed</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {result.divergences.slice(0, 6).map((divergence, index) => (
              <div key={`${divergence.pair}-${index}`} className="rounded-2xl border border-border p-3 text-sm leading-6">
                <span className="font-medium">Declared: </span>{humanizeDivergenceText(divergence.declared)}.<br />
                <span className="font-medium">Scenario signal: </span>{humanizeDivergenceText(divergence.observed)}.
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {audience === 'teaser' && (
        <div className="rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm leading-6 text-muted-foreground">
            The full analysis (learning profile, self-awareness and where your declared needs differ from what the scenarios revealed) goes to your teacher in a private report. Send it below.
          </p>
        </div>
      )}
    </div>
  );
}
