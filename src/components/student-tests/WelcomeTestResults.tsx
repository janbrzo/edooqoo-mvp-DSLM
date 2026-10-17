/**
 * WelcomeTestResults - Teacher dashboard view of Welcome Test results
 * Shows learning profile, AI summary, traits, scores, and recommendations
 */

import { useState, useEffect } from 'react';
import { 
  Sparkles, Brain, Target, BookOpen, MessageCircle, 
  TrendingUp, Star, AlertCircle, Clock, Smile, Frown, Meh,
  Bot, Lightbulb, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import type { LearningProfile } from '@/types/welcomeTest';
import { sanitizeAiText, sanitizeAiList } from '@/utils/sanitizeAiSummary';
import { isSkillSkipped } from '@/lib/welcomeTest/skillAttempts';
import { AwarenessBlock, LevelAssessmentBlock, ProfileTraits } from '@/components/welcome-test/profile/ProfileTraits';
import { FeedbackHint, WtFeedbackProvider } from '@/components/welcome-test/profile/SignalFeedback';
import { readInterpretationVersion } from '@/lib/welcomeTest/profileDisplay';
import { AnswerBehaviourLine, DeclaredVsMeasured, LearningPathBlock, LowCoverageBadge } from '@/components/dslm/ProfileSignalsV2';
import type { LearningProfileV2Columns } from '@/types/dslm/learningProfileV2';

interface TestQuestionLike {
  element_type?: string | null;
  is_correct?: boolean | null;
  student_answer?: unknown;
}

interface WelcomeTestResultsProps {
  testId: string;
  studentId: string;
  teacherId: string;
  /** Optional: when provided, listening/other skills can fall back to a
   *  per-question computation if `test_skill_results` lacks an entry. */
  questions?: TestQuestionLike[];
  /** student_tests.status: 'completed' = analysis still running, 'reviewed' = done. */
  testStatus?: string | null;
  /** student_tests.completed_at, drives the "rate after 2-4 lessons" hint. */
  completedAt?: string | null;
}

interface AiSummaryData {
  summary: string;
  recommendations: string[];
  writing_quality: string;
  key_observations: string[];
}

interface SkillResultData {
  element_type: string;
  correct_answers: number;
  total_questions: number;
  score_percentage: number | null;
}

export function WelcomeTestResults({ testId, studentId, teacherId, questions, testStatus, completedAt }: WelcomeTestResultsProps) {
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<AiSummaryData | null>(null);
  const [skillResults, setSkillResults] = useState<SkillResultData[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // v6.9.47: prefer the profile bound to THIS testId so retakes never
        // show analysis from a previous attempt. Fallback to the latest profile
        // for the student when no test-specific row exists yet.
        let data: any = null;
        if (testId) {
          const { data: byTest } = await supabase
            .from('student_learning_profiles')
            .select('*')
            .eq('student_id', studentId)
            .eq('teacher_id', teacherId)
            .eq('welcome_test_id', testId)
            .maybeSingle();
          if (byTest) data = byTest;
        }
        if (!data) {
          const { data: latest } = await supabase
            .from('student_learning_profiles')
            .select('*')
            .eq('student_id', studentId)
            .eq('teacher_id', teacherId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          data = latest;
        }

        // While the analysis of this attempt is running, an older attempt's profile must not stand in for it.
        if (data && testStatus === 'completed' && testId && data.welcome_test_id !== testId) data = null;

        if (data) {
          setProfile(data as unknown as LearningProfile);
          if ((data as any).ai_summary) {
            try {
              const parsed = JSON.parse((data as any).ai_summary);
              setAiSummary(parsed);
            } catch {
              setAiSummary({ summary: (data as any).ai_summary, recommendations: [], writing_quality: 'unknown', key_observations: [] });
            }
          }
        } else {
          setProfile(null);
          setAiSummary(null);
        }

        // v6.9.47: skill results should match the rendered test, not the
        // student-wide newest welcome test (matters for retakes).
        if (testId) {
          const { data: results } = await supabase
            .from('test_skill_results')
            .select('element_type, correct_answers, total_questions, score_percentage')
            .eq('test_id', testId);
          setSkillResults((results as SkillResultData[]) || []);
        }
      } catch (err) {
        console.error('Error fetching learning profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [studentId, teacherId, testId, testStatus]);

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Loading learning profile...</div>;
  }

  if (!profile && testStatus === 'completed') {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-6 text-center">
          <Loader2 className="h-6 w-6 text-primary mx-auto mb-2 animate-spin" aria-hidden="true" />
          <p className="text-sm text-muted-foreground" role="status">Analysing results...</p>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
        <CardContent className="py-6 text-center">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Learning profile not yet generated. The student needs to complete the Welcome Test first,
            or the profile is still being processed.
          </p>
        </CardContent>
      </Card>
    );
  }

  const profileRecord = profile as unknown as Record<string, unknown>;
  const profileV2 = profile as unknown as LearningProfileV2Columns;

  return (
    <div className="space-y-6">
      {/* AI Summary */}
      {aiSummary && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5 text-primary" />
              AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">{sanitizeAiText(aiSummary.summary)}</p>
            
            {aiSummary.key_observations && aiSummary.key_observations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Key Observations</p>
                <ul className="space-y-1">
                  {sanitizeAiList(aiSummary.key_observations).map((obs, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      {obs}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiSummary.recommendations && aiSummary.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" /> Recommendations
                </p>
                <ul className="space-y-1">
                  {sanitizeAiList(aiSummary.recommendations).map((rec, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">💡</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {aiSummary.writing_quality && aiSummary.writing_quality !== 'unknown' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Writing Quality:</span>
                <Badge variant={aiSummary.writing_quality === 'advanced' ? 'default' : 'secondary'}>
                  {aiSummary.writing_quality}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Level Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            Level Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LevelAssessmentBlock profile={profileRecord} testStatus={testStatus} isWelcomeTest />
        </CardContent>
      </Card>

      {/* Skill Scores - Unified: MC skills use test_skill_results, open-ended use AI profile scores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Star className="h-5 w-5 text-primary" />
            Skill Scores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(() => {
            const SKILL_DISPLAY = [
              { label: 'Grammar', profileKey: 'grammar_score' as const, useAiScore: false, skill: 'grammar' },
              { label: 'Vocabulary', profileKey: 'vocabulary_score' as const, useAiScore: false, skill: 'vocabulary' },
              { label: 'Reading', profileKey: 'reading_score' as const, useAiScore: false, skill: 'reading' },
              { label: 'Listening', profileKey: null, useAiScore: false, skill: 'listening' },
              { label: 'Writing', profileKey: 'writing_score' as const, useAiScore: true, skill: 'writing' },
              { label: 'Speaking', profileKey: 'speaking_score' as const, useAiScore: true, skill: 'speaking' },
            ];

            // Calculate merged scores for strongest/weakest
            const mergedScores: { label: string; score: number | null }[] = [];

            return (
              <>
                {SKILL_DISPLAY.map(({ label, profileKey, useAiScore, skill }) => {
                  const result = skillResults.find(r => r.element_type === skill);
                  const aiScore = profileKey ? (profile as any)[profileKey] : null;
                  // Fallback: compute from raw questions when test_skill_results
                  // lacks an entry (common for listening when aggregation skipped).
                  let fallbackComputed: { score: number; correct: number; total: number; attempted: number } | null = null;
                  if (!result && questions && questions.length > 0) {
                    const qs = questions.filter(q => (q.element_type || '') === skill);
                    const total = qs.length;
                    const attempted = qs.filter(q => q.student_answer !== null && q.student_answer !== undefined && q.student_answer !== '').length;
                    const correct = qs.filter(q => q.is_correct === true).length;
                    if (total > 0) {
                      fallbackComputed = {
                        total,
                        attempted,
                        correct,
                        score: attempted > 0 ? Math.round((correct / total) * 100) : 0,
                      };
                    }
                  }

                  // For MC-heavy skills: prefer test_skill_results; for open-ended: prefer AI score
                  let displayScore: number | null;
                  if (useAiScore) {
                    displayScore = aiScore ?? (result ? result.score_percentage : null);
                  } else {
                    displayScore = result
                      ? result.score_percentage
                      : (fallbackComputed ? fallbackComputed.score : (aiScore ?? null));
                  }

                  // No attempted question: no score ('-' and 'Skipped'), also when the stored
                  // result is an old 0% or a NULL, and never strongest/weakest.
                  const noAttempt = isSkillSkipped(questions, skill);
                  if (noAttempt) displayScore = null;

                  // Hide row entirely when there is zero signal anywhere.
                  if (!result && !fallbackComputed && displayScore === null && !noAttempt) return null;
                  const isSkipped = noAttempt || (!result && fallbackComputed && fallbackComputed.attempted === 0);
                  
                  if (!isSkipped) mergedScores.push({ label, score: displayScore });
                  
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-24 text-sm">{label}</span>
                      <div className="flex-1">
                        <Progress value={displayScore || 0} className="h-2" />
                      </div>
                      <span className="w-12 text-right text-sm font-medium">
                        {isSkipped ? '-' : (displayScore !== null ? `${Math.round(displayScore)}%` : '-')}
                      </span>
                      {result && !isSkipped && (
                        <span className="w-14 text-right text-xs text-muted-foreground">
                          ({result.correct_answers}/{result.total_questions})
                        </span>
                      )}
                      {isSkipped && result && (
                        <span className="w-14 text-right text-xs text-muted-foreground">Skipped</span>
                      )}
                      {!result && fallbackComputed && (
                        <span className="w-14 text-right text-xs text-muted-foreground">
                          {isSkipped ? 'Skipped' : `(${fallbackComputed.correct}/${fallbackComputed.total})`}
                        </span>
                      )}
                      {useAiScore && !result && displayScore !== null && (
                        <span className="w-14 text-right text-xs text-muted-foreground">(AI)</span>
                      )}
                    </div>
                  );
                })}
                {(() => {
                  const validScores = mergedScores.filter(s => s.score !== null);
                  const strongest = validScores.length > 0 ? validScores.reduce((a, b) => (a.score! >= b.score! ? a : b)) : null;
                  const weakest = validScores.length > 0 ? validScores.reduce((a, b) => (a.score! <= b.score! ? a : b)) : null;
                  return (
                    <div className="flex gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Strongest:</span>
                        <Badge variant="default">{strongest?.label || '-'}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Weakest:</span>
                        <Badge variant="destructive">{weakest?.label || '-'}</Badge>
                      </div>
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Learner Profile: every trait with its basis, confidence and the teacher's verdict */}
      <WtFeedbackProvider
        studentId={studentId}
        teacherId={teacherId}
        testId={profile.welcome_test_id ?? testId}
        interpretationVersion={readInterpretationVersion(profile.raw_answers)}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" />
              Learner Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <FeedbackHint completedAt={completedAt} />
            <LowCoverageBadge profile={profileV2} />
            <ProfileTraits profile={profileRecord} />
            <AwarenessBlock profile={profileRecord} />
            <DeclaredVsMeasured profile={profileV2} />
            <LearningPathBlock profile={profileV2} />
            <AnswerBehaviourLine profile={profileV2} />
            {(profile.preferred_activities || []).length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Preferred Activities</span>
                <div className="flex flex-wrap gap-1">
                  {(profile.preferred_activities || []).map((a, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </WtFeedbackProvider>

      {/* Interest Topics */}
      {profile.interest_topics && profile.interest_topics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              Interest Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.interest_topics.map((topic, i) => (
                <Badge key={i} variant="outline" className="text-sm">{topic}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Self-Efficacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-primary" />
            Confidence Self-Assessment (1-5)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Speaking', value: profile.confidence_speaking },
              { label: 'Writing', value: profile.confidence_writing },
              { label: 'Listening', value: profile.confidence_listening },
              { label: 'Reading', value: profile.confidence_reading },
              { label: 'Presenting', value: profile.confidence_presenting },
              { label: 'Small Talk', value: profile.confidence_small_talk },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <span className="text-sm">{label}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div
                      key={n}
                      className={`w-3 h-3 rounded-full ${
                        value && n <= value ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
