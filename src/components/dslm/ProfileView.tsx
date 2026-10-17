/**
 * ProfileView, "Who they are", psychological, behavioral, and notes.
 * Compact: AI Summary open, Psychological Profile open, Behavioral Stats collapsed
 * (key activity stat already in nav badge), Notes collapsed.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useStudentProfile } from '@/hooks/dslm/useStudentProfile';
import { useBehavioralStats } from '@/hooks/dslm/useBehavioralStats';
import { useStudentKnowledge } from '@/hooks/useStudentKnowledge';
import { BehavioralStatsCard } from './BehavioralStatsCard';
import { StudentKnowledgeSection } from '@/components/student-knowledge/StudentKnowledgeSection';
import { EventLogPanel } from '@/components/dslm/EventLogPanel';
import { StudentKnowledgeEntryCard } from '@/components/student-knowledge/StudentKnowledgeEntryCard';
import { CollapsibleSection } from './CollapsibleSection';
import { Brain, Activity as ActivityIcon, User, StickyNote, Bug, Sparkles } from 'lucide-react';
import type { LearningProfileV2Columns } from '@/types/dslm/learningProfileV2';
import { isFallbackSummary } from '@/lib/dslm/learningProfileView';
import { AnswerBehaviourLine, DeclaredVsMeasured, LearningPathBlock, LowCoverageBadge } from './ProfileSignalsV2';
import { AwarenessBlock, LevelAssessmentBlock, ProfileTraits } from '@/components/welcome-test/profile/ProfileTraits';
import { FeedbackHint, WtFeedbackProvider } from '@/components/welcome-test/profile/SignalFeedback';
import { readInterpretationVersion } from '@/lib/welcomeTest/profileDisplay';

interface ProfileViewProps {
  studentId: string;
  teacherId: string;
  studentName: string;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  studentId,
  teacherId,
  studentName,
}) => {
  const { data: profile, isLoading: profileLoading } = useStudentProfile({ studentId, teacherId });
  const { data: behavioralStats, isLoading: statsLoading } = useBehavioralStats({ studentId, teacherId });
  const knowledge = useStudentKnowledge({ studentId, teacherId });

  const personalNotes = knowledge.entries.filter(e => e.category === 'Personal');

  // Parse AI summary
  const aiSummary = (() => {
    if (!profile?.ai_summary) return null;
    try {
      const parsed = JSON.parse(profile.ai_summary);
      return parsed;
    } catch {
      return { summary: profile.ai_summary };
    }
  })();

  // v2 columns (iteration 5) are not in the generated types yet; select('*') returns them once migrated.
  const profileV2 = profile ? (profile as typeof profile & LearningProfileV2Columns) : null;
  const summaryIsFallback = isFallbackSummary(profile?.ai_summary);

  const confidenceScores = profile ? [
    { label: 'Speaking', value: profile.confidence_speaking },
    { label: 'Writing', value: profile.confidence_writing },
    { label: 'Listening', value: profile.confidence_listening },
    { label: 'Reading', value: profile.confidence_reading },
    { label: 'Presenting', value: profile.confidence_presenting },
    { label: 'Small Talk', value: profile.confidence_small_talk },
  ] : [];

  return (
    <div className="space-y-3">
      {/* AI Summary: open by default if exists */}
      {aiSummary && (
        <CollapsibleSection id="profile-ai-summary" title="AI Summary" icon={Sparkles} badge="PLACEMENT TEST" defaultOpen>
          <div className="space-y-2 text-sm">
            {summaryIsFallback && (
              <Badge
                variant="outline"
                className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-400"
                title="The AI step failed, so this summary was built from the test answers by rules."
              >
                Deterministic fallback
              </Badge>
            )}
            <p>{aiSummary.summary || aiSummary}</p>
            {aiSummary.key_observations?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mt-2">Key Observations:</p>
                <ul className="text-xs list-disc pl-4 space-y-0.5">
                  {aiSummary.key_observations.map((obs: string, i: number) => (
                    <li key={i}>{obs}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiSummary.recommendations?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mt-2">Recommendations:</p>
                <ul className="text-xs list-disc pl-4 space-y-0.5">
                  {aiSummary.recommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Psychological Profile: open by default */}
      <CollapsibleSection id="profile-psych" title="Psychological Profile" icon={Brain} badge="PLACEMENT TEST" defaultOpen>
        {profileLoading ? (
          <div className="h-16 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : !profile ? (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground">No Welcome Test data available.</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Send a Welcome Test to unlock the psychological profile.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profileV2 && <LowCoverageBadge profile={profileV2} />}
            <WtFeedbackProvider
              studentId={studentId}
              teacherId={teacherId}
              testId={profile.welcome_test_id ?? null}
              interpretationVersion={readInterpretationVersion(profile.raw_answers)}
            >
              <FeedbackHint completedAt={profile.updated_at ?? profile.created_at} />
              <LevelAssessmentBlock profile={profile as unknown as Record<string, unknown>} />
              <ProfileTraits profile={profile as unknown as Record<string, unknown>} />
              <AwarenessBlock profile={profile as unknown as Record<string, unknown>} />
              {profileV2 && (
                <>
                  <DeclaredVsMeasured profile={profileV2} />
                  <LearningPathBlock profile={profileV2} />
                </>
              )}
            </WtFeedbackProvider>

            {profile.preferred_activities && profile.preferred_activities.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Preferred Activities</p>
                <div className="flex flex-wrap gap-1">
                  {profile.preferred_activities.map((act: string) => (
                    <Badge key={act} variant="secondary" className="text-[11px]">{act}</Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.interest_topics && profile.interest_topics.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Interest Topics</p>
                <div className="flex flex-wrap gap-1">
                  {profile.interest_topics.map((topic: string) => (
                    <Badge key={topic} variant="secondary" className="text-[11px]">{topic}</Badge>
                  ))}
                </div>
              </div>
            )}

            {confidenceScores.some(c => c.value !== null) && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Self-Efficacy</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {confidenceScores.map(({ label, value }) => (
                    <div key={label} className="text-center p-1.5 bg-muted/50 rounded">
                      <div className="text-base font-bold leading-none">{value ?? '-'}</div>
                      <div className="text-[9px] text-muted-foreground mt-1 leading-tight">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profileV2 && <AnswerBehaviourLine profile={profileV2} />}
          </div>
        )}
      </CollapsibleSection>

      {/* Learning patterns: open: how the student actually behaves week to week */}
      <CollapsibleSection id="profile-behavioral" title="Learning Patterns" icon={ActivityIcon} badge="CALCULATED" defaultOpen>
        <BehavioralStatsCard
          stats={behavioralStats || {
            lessonsPerWeek: null, totalLessons: 0, cancellationRate: null,
            cancellationsLast30d: 0, homeworkTotal: 0, homeworkCompleted: 0,
            homeworkCompletionRate: null, flashcardSetsCount: 0,
            totalFlashcardReviews: 0, daysSinceLastActivity: null,
          }}
          loading={statsLoading}
        />
      </CollapsibleSection>

      {/* Single notes stream (category filter lives inside StudentKnowledgeSection) */}
      <CollapsibleSection
        id="profile-all-notes"
        title="Notes"
        icon={StickyNote}
        count={knowledge.totalCount}
        badge={personalNotes.length > 0 ? `${personalNotes.length} personal` : undefined}
      >
        <StudentKnowledgeSection
          studentId={studentId}
          teacherId={teacherId}
          studentName={studentName}
        />
      </CollapsibleSection>

      {/* Advanced diagnostics: collapsed, for troubleshooting only */}
      <CollapsibleSection id="profile-debug" title="Advanced: diagnostic log" icon={Bug} description="Raw learning events the model received. Useful only when something looks wrong.">
        <EventLogPanel studentId={studentId} teacherId={teacherId} />
      </CollapsibleSection>
    </div>
  );
};
