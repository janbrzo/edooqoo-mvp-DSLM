/**
 * WelcomeTestResults - Teacher dashboard view of Welcome Test results
 * Shows learning profile, AI summary, traits, scores, and recommendations
 */

import { useState, useEffect } from 'react';
import { 
  Sparkles, Brain, Target, BookOpen, MessageCircle, 
  TrendingUp, Star, AlertCircle, Clock, Smile, Frown, Meh,
  Bot, Lightbulb
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import type { LearningProfile } from '@/types/welcomeTest';

interface WelcomeTestResultsProps {
  testId: string;
  studentId: string;
  teacherId: string;
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
  score_percentage: number;
}

export function WelcomeTestResults({ testId, studentId, teacherId }: WelcomeTestResultsProps) {
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<AiSummaryData | null>(null);
  const [skillResults, setSkillResults] = useState<SkillResultData[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('student_learning_profiles')
          .select('*')
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .single();

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
        }

        // FIX 2.1: Fetch skill results from test_skill_results to merge into Skill Scores
        const { data: testData } = await supabase
          .from('student_tests')
          .select('id')
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .eq('test_type', 'welcome')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (testData) {
          const { data: results } = await supabase
            .from('test_skill_results')
            .select('element_type, correct_answers, total_questions, score_percentage')
            .eq('test_id', testData.id);
          setSkillResults((results as SkillResultData[]) || []);
        }
      } catch (err) {
        console.error('Error fetching learning profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [studentId, teacherId]);

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Loading learning profile...</div>;
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

  const anxietyIcon = profile.anxiety_level === 'low' ? <Smile className="h-4 w-4 text-green-500" /> :
    profile.anxiety_level === 'high' ? <Frown className="h-4 w-4 text-red-500" /> :
    <Meh className="h-4 w-4 text-amber-500" />;

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
            <p className="text-sm leading-relaxed">{aiSummary.summary}</p>
            
            {aiSummary.key_observations && aiSummary.key_observations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Key Observations</p>
                <ul className="space-y-1">
                  {aiSummary.key_observations.map((obs, i) => (
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
                  {aiSummary.recommendations.map((rec, i) => (
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
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <div className="text-2xl font-bold text-primary">{profile.estimated_level || '—'}</div>
              <div className="text-xs text-muted-foreground">Estimated Level</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <div className="text-2xl font-bold">{profile.self_assessed_level || '—'}</div>
              <div className="text-xs text-muted-foreground">Self-Assessed</div>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Badge variant={
                profile.level_confidence === 'accurate' ? 'default' :
                profile.level_confidence === 'overestimates' ? 'destructive' : 'secondary'
              }>
                {profile.level_confidence || 'Unknown'}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">Self-Awareness</div>
            </div>
          </div>
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
                  
                  // For MC-heavy skills: prefer test_skill_results; for open-ended: prefer AI score
                  let displayScore: number | null;
                  if (useAiScore) {
                    displayScore = aiScore ?? (result ? result.score_percentage : null);
                  } else {
                    displayScore = result ? result.score_percentage : (aiScore ?? null);
                  }
                  
                  mergedScores.push({ label, score: displayScore });
                  
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-24 text-sm">{label}</span>
                      <div className="flex-1">
                        <Progress value={displayScore || 0} className="h-2" />
                      </div>
                      <span className="w-12 text-right text-sm font-medium">
                        {displayScore !== null ? `${Math.round(displayScore)}%` : '—'}
                      </span>
                      {result && (
                        <span className="w-14 text-right text-xs text-muted-foreground">
                          ({result.correct_answers}/{result.total_questions})
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
                        <Badge variant="default">{strongest?.label || '—'}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Weakest:</span>
                        <Badge variant="destructive">{weakest?.label || '—'}</Badge>
                      </div>
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Learner Profile */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" />
              Motivation & Personality
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Motivation</span>
              <Badge variant="outline">{profile.motivation_type || '—'}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Anxiety Level</span>
              <div className="flex items-center gap-1">
                {anxietyIcon}
                <span>{profile.anxiety_level || '—'}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ambiguity Tolerance</span>
              <span>{profile.ambiguity_tolerance || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Error Attitude</span>
              <span>{profile.error_attitude || '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-primary" />
              Learning Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Input Channel</span>
              <Badge variant="outline">{profile.preferred_input_channel || '—'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Feedback</span>
              <span>{profile.feedback_preference || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weekly Time</span>
              <span>{profile.weekly_study_time || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-1">Preferred Activities</span>
              <div className="flex flex-wrap gap-1">
                {(profile.preferred_activities || []).map((a, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
