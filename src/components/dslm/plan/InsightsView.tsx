/**
 * InsightsView: "What Edooqoo knows about the student": the former
 * Skills & Level and Learner DNA perspectives in one readable page.
 *
 * Order: plain-language summary → skill bars (weakest first) → how the
 * student learns (ProfileView: AI summary, profile, patterns, notes,
 * diagnostic log). The detailed skill explorer (radar, filters, micro/nano
 * skills) opens unchanged in a side panel.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SkillsOverviewPanel } from '@/components/dslm/SkillsOverviewPanel';
import { ProfileView } from '@/components/dslm/ProfileView';
import { useSkillMetrics } from '@/hooks/useSkillMetrics';
import { useStudentProfile } from '@/hooks/dslm/useStudentProfile';
import { useBehavioralStats } from '@/hooks/dslm/useBehavioralStats';
import { useDemoGuard } from '@/hooks/useDemoGuard';
import { buildInsightsSummary, type RankedCategory } from '@/lib/dslm/insightsSummary';
import type { WelcomeTestState } from '@/lib/dslm/modelReadiness';
import type { ModelAnchor } from '@/lib/students/workspaceTabs';
import { PlanSection } from './PlanSection';
import type { WelcomeTestControls } from './LearningPlanView';

interface InsightsViewProps {
  studentId: string;
  teacherId: string;
  studentName: string;
  englishLevel: string;
  anchor: ModelAnchor;
  welcomeTestState: WelcomeTestState;
  welcomeTest: WelcomeTestControls;
}

const TrendIcon: React.FC<{ trend: RankedCategory['trend'] }> = ({ trend }) => {
  if (trend === 'improving') {
    return <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="improving" />;
  }
  if (trend === 'declining') return <ArrowDownRight className="h-4 w-4 text-destructive" aria-label="declining" />;
  return <ArrowRight className="h-4 w-4 text-muted-foreground" aria-label="stable" />;
};

export const InsightsView: React.FC<InsightsViewProps> = ({
  studentId,
  teacherId,
  studentName,
  englishLevel,
  anchor,
  welcomeTestState,
  welcomeTest,
}) => {
  const { guardAction } = useDemoGuard();
  const { categories, isLoading: skillsLoading } = useSkillMetrics(studentId, teacherId, null);
  const { data: profile } = useStudentProfile({ studentId, teacherId });
  const { data: stats } = useBehavioralStats({ studentId, teacherId });
  const [exploreOpen, setExploreOpen] = useState(false);

  const skillsRef = useRef<HTMLElement>(null);
  const profileRef = useRef<HTMLElement>(null);
  const firstName = studentName.split(' ')[0] || studentName;

  const summary = useMemo(
    () =>
      buildInsightsSummary({
        englishLevel,
        hasPlacementProfile: !!profile,
        estimatedLevel: profile?.estimated_level ?? null,
        categories,
        daysSinceLastActivity: stats?.daysSinceLastActivity ?? null,
        homeworkTotal: stats?.homeworkTotal ?? 0,
        homeworkCompleted: stats?.homeworkCompleted ?? 0,
      }),
    [englishLevel, profile, categories, stats],
  );

  // `view=skills` / `view=profile` deep links land on the matching section.
  useEffect(() => {
    if (anchor !== 'skills' && anchor !== 'profile') return;
    const frame = requestAnimationFrame(() => {
      (anchor === 'skills' ? skillsRef.current : profileRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor]);

  return (
    <div className="space-y-8" data-testid="learning-plan-insights">
      <PlanSection id="insights-summary" title="Summary">
        <div className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
          {summary.lines.map((line) => (
            <p key={line} className="text-foreground">{line}</p>
          ))}
          {!summary.hasEvidence && (
            <div className="space-y-2 pt-2">
              <p className="text-muted-foreground">
                Edooqoo has no skill evidence for {firstName} yet. It appears after the Welcome Test, homework or flashcard reviews.
              </p>
              {welcomeTestState === 'none' && (
                <Button
                  size="sm"
                  variant="outline"
                  data-spotlight="send-welcome-test"
                  onClick={() => guardAction('Sending the Welcome Test', () => { void welcomeTest.send(); })}
                  disabled={welcomeTest.busy}
                >
                  {welcomeTest.busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                  Send Welcome Test
                </Button>
              )}
              {welcomeTestState === 'sent' && (
                <p className="text-muted-foreground">The Welcome Test is waiting for {firstName}.</p>
              )}
            </div>
          )}
        </div>
      </PlanSection>

      <PlanSection
        ref={skillsRef}
        id="insights-skills"
        title="Skills"
        action={
          summary.ranked.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setExploreOpen(true)}>
              <BarChart3 className="mr-1.5 h-4 w-4" aria-hidden="true" /> Explore all skills
            </Button>
          ) : null
        }
      >
        {skillsLoading ? (
          <p className="text-sm text-muted-foreground">Loading skills…</p>
        ) : summary.ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Skill bars appear after the first homework, test answer or flashcard review.
          </p>
        ) : (
          <ul className="space-y-2 rounded-lg border border-border bg-card p-4" aria-label="Skills, weakest first">
            {summary.ranked.map((category) => (
              <li key={category.category} className="grid grid-cols-[minmax(0,7rem)_1fr_auto_auto] items-center gap-3 text-sm">
                <span className="truncate text-foreground">{category.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${category.pct}%` }} />
                </span>
                <span className="w-10 text-right tabular-nums text-muted-foreground">{category.pct}%</span>
                <TrendIcon trend={category.trend} />
              </li>
            ))}
          </ul>
        )}
      </PlanSection>

      <PlanSection ref={profileRef} id="insights-profile" title={`How ${firstName} learns`}>
        <ProfileView studentId={studentId} teacherId={teacherId} studentName={studentName} />
      </PlanSection>

      <Sheet open={exploreOpen} onOpenChange={setExploreOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader className="pr-8">
            <SheetTitle>All skills</SheetTitle>
            <SheetDescription>Mastery by category, micro skill and nano skill, with period and CEFR filters.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{exploreOpen ? <SkillsOverviewPanel studentId={studentId} teacherId={teacherId} /> : null}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
