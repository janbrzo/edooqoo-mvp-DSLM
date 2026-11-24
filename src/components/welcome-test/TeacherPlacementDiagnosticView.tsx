import { Bot, Brain, Lightbulb, Loader2, MessageCircle, Star, Target, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AnswerBehaviourLine, DeclaredVsMeasured, LearningPathBlock, LowCoverageBadge } from '@/components/dslm/ProfileSignalsV2';
import { TestDates } from '@/components/student-tests/TestDates';
import { AwarenessBlock, LevelAssessmentBlock, ProfileTraits } from '@/components/welcome-test/profile/ProfileTraits';
import { TeacherPlacementQuestionsCard } from '@/components/welcome-test/TeacherPlacementQuestionsCard';
import type { TeacherPlacementDiagnostic } from '@/lib/welcomeTest/placementReportApi';
import { ANALYSING_MESSAGE, computeKeyedScore, isKeyedQuestion } from '@/lib/welcomeTest/profileDisplay';
import { isSkillSkipped } from '@/lib/welcomeTest/skillAttempts';
import type { LearningProfileV2Columns } from '@/types/dslm/learningProfileV2';
import { TEST_STATUS_CONFIG, type TestStatus } from '@/types/studentTests';
import { sanitizeAiList, sanitizeAiText } from '@/utils/sanitizeAiSummary';

interface AiSummaryData {
  summary: string;
  recommendations: string[];
  writing_quality: string;
  key_observations: string[];
}

const SKILL_DISPLAY = [
  { label: 'Grammar', profileKey: 'grammar_score', useAiScore: false, skill: 'grammar' },
  { label: 'Vocabulary', profileKey: 'vocabulary_score', useAiScore: false, skill: 'vocabulary' },
  { label: 'Reading', profileKey: 'reading_score', useAiScore: false, skill: 'reading' },
  { label: 'Listening', profileKey: null, useAiScore: false, skill: 'listening' },
  { label: 'Writing', profileKey: 'writing_score', useAiScore: true, skill: 'writing' },
  { label: 'Speaking', profileKey: 'speaking_score', useAiScore: true, skill: 'speaking' },
] as const;

function parseAiSummary(raw: unknown): AiSummaryData | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AiSummaryData>;
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : raw,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      writing_quality: typeof parsed.writing_quality === 'string' ? parsed.writing_quality : 'unknown',
      key_observations: Array.isArray(parsed.key_observations) ? parsed.key_observations : [],
    };
  } catch {
    return { summary: raw, recommendations: [], writing_quality: 'unknown', key_observations: [] };
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function TeacherPlacementDiagnosticView({ diagnostic, studentName }: {
  diagnostic: TeacherPlacementDiagnostic;
  studentName: string;
}) {
  const { test, learningProfile, skillResults, questions, goals } = diagnostic;
  const testStatus = (test?.status ?? 'completed') as TestStatus;
  const statusConfig = TEST_STATUS_CONFIG[testStatus] ?? TEST_STATUS_CONFIG.completed;
  const isAnalysing = testStatus === 'completed' && !learningProfile;

  const answeredCount = questions.length > 0
    ? questions.filter((q) => q.student_answer !== null && q.student_answer !== undefined && q.student_answer !== '').length
    : (test?.answered_count ?? 0);
  const totalCount = questions.length > 0 ? questions.length : (test?.total_questions ?? 0);
  const skillQuestions = questions.filter(isKeyedQuestion);
  const keyedScore = computeKeyedScore(skillQuestions);
  const correctSkillCount = skillQuestions.filter((q) => q.is_correct === true).length;
  const profileQuestionCount = Math.max(0, totalCount - skillQuestions.length);

  const aiSummary = learningProfile ? parseAiSummary(learningProfile.ai_summary) : null;
  const profileV2 = learningProfile as unknown as LearningProfileV2Columns | null;
  const interestTopics = learningProfile ? asStringArray(learningProfile.interest_topics) : [];
  const preferredActivities = learningProfile ? asStringArray(learningProfile.preferred_activities) : [];

  const skillRows = SKILL_DISPLAY.flatMap(({ label, profileKey, useAiScore, skill }) => {
    const res = skillResults.find((r) => r.element_type === skill);
    const aiScore = profileKey && learningProfile ? asNumber(learningProfile[profileKey]) : null;
    const qs = questions.filter((q) => (q.element_type || '') === skill);
    const fallback = !res && qs.length > 0
      ? {
          total: qs.length,
          attempted: qs.filter((q) => q.student_answer !== null && q.student_answer !== undefined && q.student_answer !== '').length,
          correct: qs.filter((q) => q.is_correct === true).length,
        }
      : null;
    const fallbackScore = fallback ? (fallback.attempted > 0 ? Math.round((fallback.correct / fallback.total) * 100) : 0) : null;
    const noAttempt = isSkillSkipped(questions, skill);
    let displayScore = useAiScore
      ? (aiScore ?? (res ? res.score_percentage : null))
      : (res ? res.score_percentage : (fallbackScore ?? aiScore));
    if (noAttempt) displayScore = null;
    if (!res && !fallback && displayScore === null && !noAttempt) return [];
    const isSkipped = noAttempt || (!res && fallback !== null && fallback.attempted === 0);
    return [{ label, displayScore, res, fallback, isSkipped, useAiScore }];
  });

  const scoredSkills = skillRows.filter((r) => !r.isSkipped && r.displayScore !== null);
  const strongest = scoredSkills.length > 0 ? scoredSkills.reduce((a, b) => ((a.displayScore ?? 0) >= (b.displayScore ?? 0) ? a : b)) : null;
  const weakest = scoredSkills.length > 1 ? scoredSkills.reduce((a, b) => ((a.displayScore ?? 0) <= (b.displayScore ?? 0) ? a : b)) : null;

  const confidenceRows = learningProfile
    ? [
        { label: 'Speaking', value: asNumber(learningProfile.confidence_speaking) },
        { label: 'Writing', value: asNumber(learningProfile.confidence_writing) },
        { label: 'Listening', value: asNumber(learningProfile.confidence_listening) },
        { label: 'Reading', value: asNumber(learningProfile.confidence_reading) },
        { label: 'Presenting', value: asNumber(learningProfile.confidence_presenting) },
        { label: 'Small Talk', value: asNumber(learningProfile.confidence_small_talk) },
      ]
    : [];

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl">Welcome Test - {studentName}</CardTitle>
              <TestDates createdAt={test?.completed_at} completedAt={test?.completed_at} reviewedAt={test?.reviewed_at} className="mt-1.5" />
            </div>
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>{statusConfig.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold">{answeredCount}/{totalCount}</p>
              <p className="text-xs text-muted-foreground">Answered</p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-3 text-center">
              <p className="text-2xl font-bold text-primary">{keyedScore.percent !== null ? `${keyedScore.percent}%` : '-'}</p>
              <p className="text-xs text-muted-foreground">Skill Score (keyed items)</p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold">{correctSkillCount}/{skillQuestions.length}</p>
              <p className="text-xs text-muted-foreground">Skill Questions Correct</p>
            </div>
            <div className="rounded-2xl bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold">{profileQuestionCount}</p>
              <p className="text-xs text-muted-foreground">Profile Questions</p>
            </div>
          </div>
          {keyedScore.percent !== null && <Progress value={keyedScore.percent} className="h-2.5" aria-label="Skill score" />}
        </CardContent>
      </Card>

      {isAnalysing && (
        <Card className="rounded-3xl border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-5">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium" role="status">{ANALYSING_MESSAGE}</p>
              <p className="text-xs text-muted-foreground">Full AI analysis and learner profile appear here automatically as soon as processing finishes.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {aiSummary && (
        <Card className="rounded-3xl border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Bot className="h-5 w-5 text-primary" aria-hidden="true" />AI Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6">{sanitizeAiText(aiSummary.summary)}</p>
            {aiSummary.key_observations.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Key Observations</p>
                <ul className="space-y-1.5">
                  {sanitizeAiList(aiSummary.key_observations).map((obs, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm leading-5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiSummary.recommendations.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Lightbulb className="h-3 w-3" aria-hidden="true" />Recommendations</p>
                <ul className="space-y-2">
                  {sanitizeAiList(aiSummary.recommendations).map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-xl bg-background/70 p-2.5 text-sm leading-5">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiSummary.writing_quality && aiSummary.writing_quality !== 'unknown' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Writing Quality:</span>
                <Badge variant={aiSummary.writing_quality === 'advanced' ? 'default' : 'secondary'}>{aiSummary.writing_quality}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {learningProfile && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />Level Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <LevelAssessmentBlock profile={learningProfile} testStatus={testStatus} isWelcomeTest />
          </CardContent>
        </Card>
      )}

      {skillRows.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Star className="h-5 w-5 text-primary" aria-hidden="true" />Skill Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {skillRows.map(({ label, displayScore, res, fallback, isSkipped, useAiScore }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm">{label}</span>
                <div className="min-w-0 flex-1"><Progress value={displayScore ?? 0} className="h-2" aria-label={`${label} score`} /></div>
                <span className="w-12 shrink-0 text-right text-sm font-medium">{isSkipped || displayScore === null ? '-' : `${Math.round(displayScore)}%`}</span>
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                  {isSkipped ? 'Skipped' : res ? `(${res.correct_answers}/${res.total_questions})` : fallback ? `(${fallback.correct}/${fallback.total})` : useAiScore && displayScore !== null ? '(AI)' : ''}
                </span>
              </div>
            ))}
            {(strongest || weakest) && (
              <div className="flex flex-wrap gap-3 pt-2 text-sm">
                {strongest && <div className="flex items-center gap-1.5"><span className="text-muted-foreground">Strongest:</span><Badge variant="default">{strongest.label}</Badge></div>}
                {weakest && <div className="flex items-center gap-1.5"><span className="text-muted-foreground">Weakest:</span><Badge variant="destructive">{weakest.label}</Badge></div>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {learningProfile && profileV2 && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Brain className="h-5 w-5 text-primary" aria-hidden="true" />Learner Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <LowCoverageBadge profile={profileV2} />
            <ProfileTraits profile={learningProfile} />
            <AwarenessBlock profile={learningProfile} />
            <DeclaredVsMeasured profile={profileV2} />
            <LearningPathBlock profile={profileV2} />
            <AnswerBehaviourLine profile={profileV2} />
            {preferredActivities.length > 0 && (
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">Preferred Activities</span>
                <div className="flex flex-wrap gap-1.5">
                  {preferredActivities.map((activity, i) => <Badge key={i} variant="secondary" className="text-xs">{activity}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {interestTopics.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Target className="h-5 w-5 text-primary" aria-hidden="true" />Interest Topics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {interestTopics.map((topic, i) => <Badge key={i} variant="outline" className="text-sm">{topic}</Badge>)}
          </CardContent>
        </Card>
      )}

      {confidenceRows.some((r) => r.value !== null) && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />Confidence Self-Assessment (1-5)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {confidenceRows.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-muted/30 p-2.5" aria-label={`${label}: ${value ?? 'not answered'} of 5`}>
                <span className="text-sm">{label}</span>
                <div className="flex gap-0.5" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-3 w-3 rounded-full ${value && n <= value ? 'bg-primary' : 'bg-muted'}`} />)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {goals.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Target className="h-5 w-5 text-primary" aria-hidden="true" />Suggested Learning Goals</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {goals.map((goal, idx) => (
              <div key={String(goal.id ?? idx)} className="rounded-2xl border bg-muted/20 p-3 space-y-1">
                <p className="text-sm font-medium">{String(goal.title ?? '')}</p>
                {typeof goal.description === 'string' && goal.description && (
                  <p className="text-xs leading-5 text-muted-foreground">{goal.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <TeacherPlacementQuestionsCard questions={questions} />
    </div>
  );
}