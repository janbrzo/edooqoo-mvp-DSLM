/**
 * DSLMTab — Model Cockpit with three URL-controlled perspectives.
 * Legacy `view=goals` remains a permanent alias inside Roadmap & Goals.
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PathwayView } from './PathwayView';
import { SkillsView } from './SkillsView';
import { GoalsView } from './GoalsView';
import { ProfileView } from './ProfileView';
import { LazySection } from './LazySection';
import { StudentNavBadges } from './StudentNavBadges';
import { StudentPathwayBadges } from './StudentPathwayBadges';
import { useBehavioralStats } from '@/hooks/dslm/useBehavioralStats';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { Route, BarChart3, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PacingModeSlider } from './PacingModeSlider';
import { usePacingProposals } from '@/hooks/usePacingProposals';
import { ModelCockpitHeader } from './ModelCockpitHeader';
import { SuggestedLevelChangeBanner } from '@/components/student-tests/SuggestedLevelChangeBanner';
import { useStudentAttentionDots } from '@/hooks/useStudentAttentionDots';
import {
  buildWorkspaceParams,
  resolveModelPerspective,
  type ModelPerspective,
} from '@/lib/students/workspaceTabs';
import { AttentionDot } from '@/components/ui/AttentionDot';
import { Button } from '@/components/ui/button';

interface DSLMTabProps {
  studentId: string;
  teacherId: string;
  studentName: string;
  englishLevel: string;
  mainGoal: string;
  mainGoalTargetDate: string | null;
  totalWorksheetCount: number;
  studentNotes?: string[];
  /** v4.2: per-student toggle — when false, Roadmap is excluded from Next-Steps generation. */
  useRoadmap?: boolean;
  onUseRoadmapChange?: (next: boolean) => void;
  /** v4.4: pacing 0-100 (Scientific ↔ Pragmatic). */
  pacingMode?: number;
  onPacingModeChange?: (next: number) => void;
  onMainGoalChange?: (newGoal: string) => void;
  onMainGoalTargetDateChange?: (date: string | null) => void;
  onUseWorksheetSuggestion?: (
    topic: string, goal: string, additionalInfo?: string, grammarFocus?: string,
    exercises?: string[], exerciseFocusMap?: Record<string, string>,
    autoGenerate?: boolean,
    suggestionId?: string
  ) => void;
}

const PERSPECTIVES = [
  { id: 'roadmap', view: 'pathway', label: 'Roadmap & Goals', description: 'Direction and next steps', icon: Route },
  { id: 'skills', view: 'skills', label: 'Skills & Level', description: 'Current ability', icon: BarChart3 },
  { id: 'profile', view: 'profile', label: 'Learner DNA', description: 'Profile and learning patterns', icon: User },
] as const;

export const DSLMTab: React.FC<DSLMTabProps> = ({
  studentId,
  teacherId,
  studentName,
  englishLevel,
  mainGoal,
  mainGoalTargetDate,
  totalWorksheetCount,
  studentNotes,
  useRoadmap = true,
  onUseRoadmapChange,
  pacingMode = 50,
  onPacingModeChange,
  onMainGoalChange,
  onMainGoalTargetDateChange,
  onUseWorksheetSuggestion,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingAddGoal, setPendingAddGoal] = useState(false);
  // v6.9.37 — stable consume callback to avoid effect re-fires in GoalsView.
  const handleConsumePendingAddGoal = useCallback(() => setPendingAddGoal(false), []);
  const goalsRef = useRef<HTMLDivElement>(null);
  const { data: stats } = useBehavioralStats({ studentId, teacherId });
  const { proposals: pacingProposals } = usePacingProposals(studentId);
  const { goals: progressGoals } = useStudentProgress({ studentId, teacherId });
  const attention = useStudentAttentionDots(studentId, teacherId, englishLevel);

  // v5.2: nearest non-main active goal deadline (separate from main_goal_target_date)
  const nearestGoalDeadline = React.useMemo(() => {
    const active = (progressGoals || []).filter((g: any) =>
      g.target_date &&
      !g.is_achieved &&
      !g.archived_at &&
      !g.deleted_at &&
      g.target_date !== mainGoalTargetDate
    );
    if (!active.length) return null;
    const sorted = [...active].sort(
      (a: any, b: any) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
    );
    const top = sorted[0] as any;
    return { date: top.target_date as string, title: top.title as string, goalType: top.goal_type as string };
  }, [progressGoals, mainGoalTargetDate]);

  const requestedView = searchParams.get('view') || searchParams.get('section');
  const activePerspective = resolveModelPerspective(requestedView);

  const selectPerspective = useCallback((perspective: ModelPerspective) => {
    const item = PERSPECTIVES.find(candidate => candidate.id === perspective);
    if (!item) return;
    if (perspective === 'roadmap') attention.dismiss('pathway');
    setSearchParams((prev) => buildWorkspaceParams(prev, { tab: 'model', view: item.view }));
  }, [attention, setSearchParams]);

  const openGoals = useCallback((openModal: boolean) => {
    setSearchParams((prev) => buildWorkspaceParams(prev, { tab: 'model', view: 'goals' }));
    if (openModal) setPendingAddGoal(true);
    requestAnimationFrame(() => {
      goalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [setSearchParams]);

  // Preserve `view=goals` as a deep link into the combined Roadmap perspective.
  useEffect(() => {
    if (searchParams.get('view') !== 'goals') return;
    const frame = requestAnimationFrame(() => {
      goalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [searchParams]);

  // v6.9.33 — Re-fire focus handlers EVERY time `focus` param changes
  // (including same-value re-navigation thanks to cache-buster `_=ts`).
  // After handling we strip both `focus` and `_` so the next click on the
  // same deep link still triggers a state transition.
  const focusParam = searchParams.get('focus');
  // v6.9.38 — guard against multiple rerenders cancelling the action via cleanup.
  const focusHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusParam) return;
    const cacheKey = `${focusParam}:${searchParams.get('_') || ''}`;
    if (focusHandledRef.current === cacheKey) return;
    focusHandledRef.current = cacheKey;
    const raf = requestAnimationFrame(() => {
      if (focusParam === 'add-goal-modal') {
        openGoals(true);
        // v6.9.41 P2 — also dispatch event after the scroll/eager-mount so a late
        // GoalsView mount still receives the open-modal signal even if the prop
        // path was consumed before mount.
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('dslm:addGoal', { detail: { studentId, source: 'focus-param' } }));
        }, 200);
      } else if (focusParam === 'pick-idea') {
        selectPerspective('roadmap');
        window.dispatchEvent(new CustomEvent('pathway:pickIdea'));
      }
      // v6.9.111 M7.6 — consume `focus`/`_` on the live params so the canonical
      // `tab=model&view=…` written by handleScrollTo is not overwritten.
      // v6.9.112 M8 — no-op when nothing to consume (avoids redundant navigations).
      setSearchParams(
        (prev) => {
          if (!prev.has('focus') && !prev.has('_')) return prev;
          const next = new URLSearchParams(prev);
          next.delete('focus');
          next.delete('_');
          return next;
        },
        { replace: true },
      );
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam, searchParams.get('_')]);

  // v6.9.29 — Roadmap "Add goal" buttons dispatch `dslm:addGoal`. Switch to
  // Goals section and signal GoalsView to open its add-goal modal.
  useEffect(() => {
    const handler = () => {
      openGoals(true);
    };
    window.addEventListener('dslm:addGoal', handler);
    return () => window.removeEventListener('dslm:addGoal', handler);
  }, [openGoals]);

  const sectionHeader = (label: string, rightSlot?: React.ReactNode) => (
    <div className="flex items-end justify-between gap-3 border-b border-border pb-2 mb-4">
      <h2 className="text-lg font-semibold text-foreground">{label}</h2>
      {rightSlot && <div className="min-w-0">{rightSlot}</div>}
    </div>
  );

  // Model Cockpit v1.0 (step 1) — pacing + goal badges moved from the Pathway
  // header into one status strip shown above every Learning model section.
  const cockpit = (
    <ModelCockpitHeader
      englishLevel={englishLevel}
      totalLessons={stats?.totalLessons ?? 0}
      totalWorksheets={totalWorksheetCount}
      pacingProposalsCount={pacingProposals.length}
      pacingSlot={onPacingModeChange ? (
        <PacingModeSlider
          value={pacingMode}
          onChange={onPacingModeChange}
          studentId={studentId}
          teacherId={teacherId}
        />
      ) : null}
      goalSlot={
        <StudentPathwayBadges
          totalLessons={stats?.totalLessons ?? 0}
          mainGoal={mainGoal}
          mainGoalTargetDate={mainGoalTargetDate}
          nearestGoalDeadline={nearestGoalDeadline}
        />
      }
    />
  );

  const perspectiveContent = (() => {
    if (activePerspective === 'skills') {
      return (
        <LazySection eager>
          <SkillsView
            studentId={studentId}
            teacherId={teacherId}
            englishLevel={englishLevel}
            totalWorksheetCount={totalWorksheetCount}
          />
        </LazySection>
      );
    }

    if (activePerspective === 'profile') {
      return (
        <LazySection eager>
          <ProfileView
            studentId={studentId}
            teacherId={teacherId}
            studentName={studentName}
          />
        </LazySection>
      );
    }

    return (
      <div className="space-y-8">
        <section aria-labelledby="model-roadmap-heading">
          {sectionHeader('Roadmap & Next Steps')}
          <h2 id="model-roadmap-heading" className="sr-only">Roadmap and next steps</h2>
        {/* v6.9.49 — surface Welcome Test level-change suggestion on DSLM tab. */}
        <div className="mb-3">
          <SuggestedLevelChangeBanner studentId={studentId} currentLevel={englishLevel} />
        </div>
        <PathwayView
          studentId={studentId}
          teacherId={teacherId}
          studentName={studentName}
          englishLevel={englishLevel}
          mainGoal={mainGoal}
          studentNotes={studentNotes}
          useRoadmap={useRoadmap}
          onUseRoadmapChange={onUseRoadmapChange}
          pacingMode={pacingMode}
          onPacingModeChange={onPacingModeChange}
          onUseWorksheetSuggestion={onUseWorksheetSuggestion}
        />
        </section>

        <section ref={goalsRef} className="scroll-mt-24" aria-labelledby="model-goals-heading">
          {sectionHeader('Goals & Objectives')}
          <h2 id="model-goals-heading" className="sr-only">Goals and objectives</h2>
        {/* v6.9.37 — eager-mount when arriving via focus=add-goal-modal so the
            modal opens immediately instead of waiting for IntersectionObserver. */}
        <LazySection eager>
          <GoalsView
            studentId={studentId}
            teacherId={teacherId}
            studentName={studentName}
            englishLevel={englishLevel}
            mainGoal={mainGoal}
            mainGoalTargetDate={mainGoalTargetDate}
            onMainGoalChange={onMainGoalChange}
            onMainGoalTargetDateChange={onMainGoalTargetDateChange}
            pendingAddGoal={pendingAddGoal}
            onConsumePendingAddGoal={handleConsumePendingAddGoal}
          />
        </LazySection>
        </section>
      </div>
    );
  })();

  const navBadges = (
    <StudentNavBadges
      englishLevel={englishLevel}
      daysSinceLastActivity={stats?.daysSinceLastActivity ?? null}
    />
  );

  return (
    <div className="space-y-3">
      {cockpit}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 py-2 backdrop-blur-sm">
        <div className="mb-2 flex justify-end">{navBadges}</div>
        <nav aria-label="Learning model perspectives" className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
          {PERSPECTIVES.map((perspective) => {
            const Icon = perspective.icon;
            const active = activePerspective === perspective.id;
            return (
              <Button
                key={perspective.id}
                type="button"
                variant="ghost"
                onClick={() => selectPerspective(perspective.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'h-auto min-w-0 justify-start gap-2 px-2 py-2 text-left sm:px-3',
                  active && 'bg-background text-foreground shadow-sm hover:bg-background',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold sm:text-sm">{perspective.label}</span>
                  <span className="hidden truncate text-[11px] font-normal text-muted-foreground md:block">
                    {perspective.description}
                  </span>
                </span>
                {perspective.id === 'roadmap' && (
                  <AttentionDot show={attention.pathway || attention.goalsAny} />
                )}
              </Button>
            );
          })}
        </nav>
      </div>

      <div className="min-w-0 pt-1">
        {perspectiveContent}
      </div>
    </div>
  );
};
