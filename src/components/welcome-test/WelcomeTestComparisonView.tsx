/**
 * WelcomeTestComparisonView — v6.2
 *
 * Side-by-side comparison of Welcome Test attempts for a single student.
 * Renders:
 * - A timeline of all attempts (#1, #2, ...) with status + completion date
 * - The current learning profile (latest completed attempt) — CEFR level,
 *   skill scores, traits, strongest/weakest skill
 * - The Gemini-generated `evolution_summary` (when ≥2 attempts have been
 *   completed) describing measurable deltas vs the previous attempt
 *
 * Limitations (intentional, see useWelcomeTestHistory): only the latest
 * profile snapshot is persisted today, so quantitative deltas live inside
 * `evolution_summary` (Gemini reads the previous profile in-memory before
 * the upsert). Older attempt rows show only quiz-level metrics.
 */
import React from 'react';
import { ArrowLeft, TrendingUp, Sparkles, Calendar, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWelcomeTestHistory, type WelcomeAttempt } from '@/hooks/useWelcomeTestHistory';

interface Props {
  studentId: string;
  teacherId: string;
  studentName?: string;
  onBack: () => void;
}

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }); }
  catch { return iso; }
};

const ScoreCell: React.FC<{ label: string; value: number | null | undefined }> = ({ label, value }) => (
  <div className="text-center p-2 bg-muted/40 rounded">
    <div className="text-base font-bold leading-none">{value !== null && value !== undefined ? `${Math.round(Number(value))}%` : '—'}</div>
    <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
  </div>
);

const TraitCell: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <div>
    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
    <Badge variant="outline" className="text-xs mt-0.5">{value || '—'}</Badge>
  </div>
);

const AttemptRow: React.FC<{ attempt: WelcomeAttempt; isLatest: boolean }> = ({ attempt, isLatest }) => {
  const profile = attempt.profile;
  return (
    <Card className={isLatest ? 'border-primary/40' : 'opacity-90'}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Attempt #{attempt.attempt_number}
            {isLatest && <Badge variant="default" className="text-[10px]">Latest</Badge>}
          </span>
          <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(attempt.completed_at || attempt.created_at)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">{attempt.status}</Badge>
          <span className="text-muted-foreground">
            {attempt.answered_count ?? 0}/{attempt.total_questions ?? 0} answered
          </span>
          {profile?.estimated_level && (
            <span className="ml-auto text-base font-bold">CEFR: {profile.estimated_level}</span>
          )}
        </div>

        {profile ? (
          <>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
              <ScoreCell label="Grammar" value={profile.grammar_score} />
              <ScoreCell label="Vocab" value={profile.vocabulary_score} />
              <ScoreCell label="Reading" value={profile.reading_score} />
              <ScoreCell label="Writing" value={profile.writing_score} />
              <ScoreCell label="Speaking" value={profile.speaking_score} />
              <ScoreCell label="Comm." value={profile.communication_score} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <TraitCell label="Motivation" value={profile.motivation_type} />
              <TraitCell label="Anxiety" value={profile.anxiety_level} />
              <TraitCell label="Errors" value={profile.error_attitude} />
              <TraitCell label="Ambiguity" value={profile.ambiguity_tolerance} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-muted-foreground">Strongest: </span>
                <span className="font-medium">{profile.strongest_skill || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Weakest: </span>
                <span className="font-medium">{profile.weakest_skill || '—'}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Detailed profile snapshot not retained for this attempt. Quantitative deltas vs this attempt are summarized in the AI evolution report below.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export const WelcomeTestComparisonView: React.FC<Props> = ({
  studentId, teacherId, studentName, onBack,
}) => {
  const { data: attempts, isLoading } = useWelcomeTestHistory({ studentId, teacherId });

  const latestProfile = attempts?.find(a => a.profile)?.profile;
  const evolutionText = (latestProfile as any)?.evolution_summary as string | null | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Welcome Test — Progress Comparison
          {studentName && <span className="text-muted-foreground font-normal">· {studentName}</span>}
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !attempts || attempts.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          No Welcome Test attempts found for this student.
        </CardContent></Card>
      ) : attempts.length === 1 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          Only one attempt completed so far. A comparison will be available after the second attempt is finished.
        </CardContent></Card>
      ) : (
        <>
          {evolutionText && (
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> AI Evolution Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line">{evolutionText}</p>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {[...attempts].reverse().map((a, idx) => (
              <AttemptRow key={a.test_id} attempt={a} isLatest={idx === 0} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};