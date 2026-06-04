/**
 * DSLMTab — all 4 DSLM sections on one scrollable page ("wall" layout)
 * Sidebar buttons scroll to the relevant section. Sidebar is sticky.
 * Mobile: horizontal tabs that scroll to sections.
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { PathwayView } from './PathwayView';
import { SkillsView } from './SkillsView';
import { GoalsView } from './GoalsView';
import { ProfileView } from './ProfileView';
import { LazySection } from './LazySection';
import { StudentNavBadges } from './StudentNavBadges';
import { StudentPathwayBadges } from './StudentPathwayBadges';
import { useBehavioralStats } from '@/hooks/dslm/useBehavioralStats';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { Route, BarChart3, Target, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PacingModeSlider } from './PacingModeSlider';
import { usePacingProposals } from '@/hooks/usePacingProposals';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';

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

const VIEWS = [
  { id: 'pathway', label: 'Pathway', icon: Route },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'skills', label: 'Skills', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
] as const;

type ViewId = typeof VIEWS[number]['id'];

// v6.9.13 — sub-nav map. Clicking a child dispatches `dslm:openSubsection` (handled by CollapsibleSection).
const SUBSECTIONS: Record<ViewId, { id: string; label: string }[]> = {
  pathway: [
    { id: 'pathway-next-steps', label: 'Next Steps' },
    { id: 'pathway-roadmap', label: 'Learning Roadmap' },
    { id: 'pathway-notes', label: 'Next Lesson Ideas' },
  ],
  goals: [
    { id: 'goals-supporting', label: 'Supporting' },
    { id: 'goals-additional', label: 'Additional' },
    { id: 'goals-achieved', label: 'Achieved' },
    { id: 'goals-archived', label: 'Archived' },
    { id: 'goals-notes', label: 'Goal Notes' },
  ],
  skills: [
    { id: 'skills-heatmap', label: 'Heat Map' },
    { id: 'skills-micro', label: 'Micro Skills' },
    { id: 'skills-notes', label: 'Notes' },
  ],
  profile: [
    { id: 'profile-ai-summary', label: 'AI Summary' },
    { id: 'profile-psych', label: 'Psychological' },
    { id: 'profile-behavioral', label: 'Behavioral' },
    { id: 'profile-personal', label: 'Personal Notes' },
    { id: 'profile-all-notes', label: 'All Notes' },
  ],
};

// Sub-nav clicks dispatch `dslm:openSubsection` (handled inline at click site).

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
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<ViewId>('pathway');
  const [pendingAddGoal, setPendingAddGoal] = useState(false);
  const isScrollingRef = useRef(false);
  const { data: stats } = useBehavioralStats({ studentId, teacherId });
  const { proposals: pacingProposals } = usePacingProposals(studentId);
  const { goals: progressGoals } = useStudentProgress({ studentId, teacherId });

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

  const sectionRefs = {
    pathway: useRef<HTMLDivElement>(null),
    skills: useRef<HTMLDivElement>(null),
    goals: useRef<HTMLDivElement>(null),
    profile: useRef<HTMLDivElement>(null),
  };

  // Scroll to section on sidebar click
  const handleScrollTo = useCallback((viewId: ViewId) => {
    const el = sectionRefs[viewId].current;
    if (!el) return;
    isScrollingRef.current = true;
    setActiveSection(viewId);
    setSearchParams({ tab: 'dslm', view: viewId });
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Reset after scroll completes
    setTimeout(() => { isScrollingRef.current = false; }, 800);
  }, [setSearchParams]);

  // Track which section is in view via IntersectionObserver
  useEffect(() => {
    const refs = sectionRefs;
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-section') as ViewId;
            if (id) setActiveSection(id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    for (const key of Object.keys(refs) as ViewId[]) {
      const el = refs[key].current;
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  // On mount, scroll to URL view param
  useEffect(() => {
    const urlView = searchParams.get('view') as ViewId | null;
    // v6.9.32 — accept legacy `?section=` as alias for `?view=`.
    const legacy = searchParams.get('section');
    const effectiveView = (urlView || (legacy as ViewId | null)) as ViewId | null;
    if (urlView && VIEWS.some(v => v.id === urlView) && urlView !== 'pathway') {
      setTimeout(() => handleScrollTo(urlView), 100);
    } else if (effectiveView && VIEWS.some(v => v.id === effectiveView) && effectiveView !== 'pathway') {
      setTimeout(() => handleScrollTo(effectiveView), 100);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // v6.9.33 — Re-fire focus handlers EVERY time `focus` param changes
  // (including same-value re-navigation thanks to cache-buster `_=ts`).
  // After handling we strip both `focus` and `_` so the next click on the
  // same deep link still triggers a state transition.
  const focusParam = searchParams.get('focus');
  useEffect(() => {
    if (!focusParam) return;
    const t = setTimeout(() => {
      if (focusParam === 'add-goal-modal') {
        // v6.9.36 — state-driven (not event-driven) for URL focus. GoalsView
        // reads `pendingAddGoal` and opens the dialog as soon as it mounts,
        // even when it sits behind LazySection. Avoids the prior race where
        // the one-shot `dslm:addGoal` event fired before the listener mounted.
        handleScrollTo('goals');
        setPendingAddGoal(true);
      } else if (focusParam === 'pick-idea') {
        handleScrollTo('pathway');
        window.dispatchEvent(new CustomEvent('pathway:pickIdea'));
      }
      // Strip focus + cache-buster so a repeat click re-triggers.
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      next.delete('_');
      setSearchParams(next, { replace: true });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam, searchParams.get('_')]);

  // v6.9.29 — Roadmap "Add goal" buttons dispatch `dslm:addGoal`. Switch to
  // Goals section and signal GoalsView to open its add-goal modal.
  useEffect(() => {
    const handler = () => {
      handleScrollTo('goals');
      setPendingAddGoal(true);
    };
    window.addEventListener('dslm:addGoal', handler);
    return () => window.removeEventListener('dslm:addGoal', handler);
  }, [handleScrollTo]);

  const sectionHeader = (label: string, rightSlot?: React.ReactNode) => (
    <div className="flex items-end justify-between gap-3 border-b border-border pb-2 mb-4">
      <h2 className="text-lg font-semibold text-foreground">{label}</h2>
      {rightSlot && <div className="min-w-0">{rightSlot}</div>}
    </div>
  );

  const pathwayBadges = (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {pacingProposals.length > 0 && (
        <Badge variant="outline" className="gap-1 text-[10px] border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400 animate-pulse">
          <Bell className="h-3 w-3" />
          {pacingProposals.length} pacing proposal{pacingProposals.length > 1 ? 's' : ''}
        </Badge>
      )}
      {onPacingModeChange && (
        <PacingModeSlider
          value={pacingMode}
          onChange={onPacingModeChange}
          studentId={studentId}
          teacherId={teacherId}
        />
      )}
      <StudentPathwayBadges
        totalLessons={stats?.totalLessons ?? 0}
        mainGoal={mainGoal}
        mainGoalTargetDate={mainGoalTargetDate}
        nearestGoalDeadline={nearestGoalDeadline}
      />
    </div>
  );

  const sections = (
    <>
      <div ref={sectionRefs.pathway} data-section="pathway" className="scroll-mt-4">
        {sectionHeader('Pathway', pathwayBadges)}
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
      </div>

      <div ref={sectionRefs.goals} data-section="goals" className="scroll-mt-4 pt-8">
        {sectionHeader('Goals')}
        <LazySection>
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
            onConsumePendingAddGoal={() => setPendingAddGoal(false)}
          />
        </LazySection>
      </div>

      <div ref={sectionRefs.skills} data-section="skills" className="scroll-mt-4 pt-8">
        {sectionHeader('Skills')}
        <LazySection>
          <SkillsView
            studentId={studentId}
            teacherId={teacherId}
            englishLevel={englishLevel}
            totalWorksheetCount={totalWorksheetCount}
          />
        </LazySection>
      </div>

      <div ref={sectionRefs.profile} data-section="profile" className="scroll-mt-4 pt-8">
        {sectionHeader('Profile')}
        <LazySection>
          <ProfileView
            studentId={studentId}
            teacherId={teacherId}
            studentName={studentName}
          />
        </LazySection>
      </div>
    </>
  );

  const navBadges = (
    <StudentNavBadges
      englishLevel={englishLevel}
      daysSinceLastActivity={stats?.daysSinceLastActivity ?? null}
    />
  );

  if (isMobile) {
    return (
      <div className="space-y-2">
        {/* Sticky horizontal tabs + nav badges */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 pt-1 space-y-1.5">
          <div className="flex justify-end">{navBadges}</div>
          <div className="flex gap-1 overflow-x-auto">
            {VIEWS.map(view => {
              const Icon = view.icon;
              return (
                <button
                  key={view.id}
                  onClick={() => handleScrollTo(view.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    activeSection === view.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {view.label}
                </button>
              );
            })}
          </div>
        </div>
        {sections}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-6">
        {/* Sticky sidebar */}
        <div className="w-44 shrink-0">
          <div className="sticky top-20 space-y-3">
            <div className="px-1">{navBadges}</div>
            <nav className="space-y-1">
              {VIEWS.map(view => {
                const Icon = view.icon;
                const subs = SUBSECTIONS[view.id];
                return (
                  <div key={view.id}>
                    <button
                      onClick={() => handleScrollTo(view.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                        activeSection === view.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {view.label}
                    </button>
                    {subs.length > 0 && (
                      <div className={cn(
                        "ml-6 mt-1 mb-1 space-y-0.5 border-l pl-2",
                        activeSection === view.id ? "border-primary" : "border-border opacity-70"
                      )}>
                        {subs.map(s => (
                          <button
                            key={s.id}
                            onClick={() => {
                              handleScrollTo(view.id);
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent('dslm:openSubsection', { detail: { id: s.id } }));
                              }, 250);
                            }}
                            className="block w-full text-left px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>

        {/* All sections in one scrollable column */}
        <div className="flex-1 min-w-0">
          {sections}
        </div>
      </div>
    </div>
  );
};
