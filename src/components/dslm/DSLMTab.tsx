/**
 * DSLMTab — the Learning plan tab (`?tab=model`), 2026-10.
 *
 * One status line, two segments (Plan / Insights), stage-driven content.
 * Spec: docs/ux/learning-model-spec.md.
 *
 * URL contract (unchanged for every historical link):
 *  - `view=pathway|goals` → Plan (`goals` scrolls to Goals)
 *  - `view=skills|profile|insights` → Insights
 *  - `focus=add-goal-modal` / `focus=pick-idea` and the `dslm:addGoal` event
 *    are handled here and forwarded to the Plan as one pending action.
 *  - `editSuggestion` always opens on the Plan.
 * The prop contract below is unchanged; `studentEmail` is an optional addition.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useLearningPlanData } from '@/hooks/dslm/useLearningPlanData';
import { useWelcomeTestActions } from '@/hooks/useWelcomeTestActions';
import { useDemoGuard } from '@/hooks/useDemoGuard';
import {
  buildWorkspaceParams,
  MODEL_SEGMENT_VIEWS,
  resolveModelSegment,
  type ModelSegment,
} from '@/lib/students/workspaceTabs';
import type { ReadinessImprovement } from '@/lib/dslm/modelReadiness';
import { ModelStatusLine } from './plan/ModelStatusLine';
import { PlanSegmentSwitch } from './plan/PlanSegmentSwitch';
import { LearningPlanView, type PlanAction, type WelcomeTestControls } from './plan/LearningPlanView';
import { InsightsView } from './plan/InsightsView';

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
  /** 2026-10 — Welcome Test email recipient (Learning plan setup step 2). */
  studentEmail?: string | null;
}

export const DSLMTab: React.FC<DSLMTabProps> = ({
  studentId,
  teacherId,
  studentName,
  englishLevel,
  mainGoal,
  mainGoalTargetDate,
  useRoadmap = true,
  onUseRoadmapChange,
  pacingMode = 50,
  onPacingModeChange,
  onMainGoalChange,
  onMainGoalTargetDateChange,
  onUseWorksheetSuggestion,
  studentEmail = null,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { guardAction } = useDemoGuard();
  const [pendingAction, setPendingAction] = useState<PlanAction | null>(null);
  const consumePendingAction = useCallback(() => setPendingAction(null), []);

  const plan = useLearningPlanData({ studentId, teacherId, englishLevel, mainGoal, useRoadmap });
  const welcomeActions = useWelcomeTestActions({ studentId, teacherId, studentName, studentEmail });

  const requestedView = searchParams.get('view') || searchParams.get('section');
  const { segment, anchor } = resolveModelSegment(requestedView);

  const goToSegment = useCallback(
    (next: ModelSegment, view?: string) => {
      setSearchParams((prev) => buildWorkspaceParams(prev, { tab: 'model', view: view ?? MODEL_SEGMENT_VIEWS[next] }));
    },
    [setSearchParams],
  );

  /** Ask the Plan to do something; switches to the Plan first when needed. */
  const requestPlanAction = useCallback(
    (action: PlanAction) => {
      if (segment !== 'plan') goToSegment('plan', action === 'add_goal' ? 'goals' : MODEL_SEGMENT_VIEWS.plan);
      setPendingAction(action);
    },
    [goToSegment, segment],
  );

  // A suggestion editor belongs to the Plan. Normalize links that carry the
  // editor id alongside another view before it opens.
  const editSuggestionParam = searchParams.get('editSuggestion');
  useEffect(() => {
    if (!editSuggestionParam || segment === 'plan') return;
    setSearchParams((prev) => buildWorkspaceParams(prev, {
      tab: 'model',
      view: MODEL_SEGMENT_VIEWS.plan,
      editSuggestion: editSuggestionParam,
    }), { replace: true });
  }, [segment, editSuggestionParam, setSearchParams]);

  // v6.9.33 — re-fire focus handlers every time `focus` changes (including a
  // same-value re-navigation thanks to the `_` cache buster), then strip both
  // params so the next click on the same deep link still triggers.
  const focusParam = searchParams.get('focus');
  const cacheBuster = searchParams.get('_');
  const focusHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusParam) return;
    const cacheKey = `${focusParam}:${cacheBuster || ''}`;
    if (focusHandledRef.current === cacheKey) return;
    focusHandledRef.current = cacheKey;
    const raf = requestAnimationFrame(() => {
      if (focusParam === 'add-goal-modal') requestPlanAction('add_goal');
      else if (focusParam === 'pick-idea') requestPlanAction('pick_idea');
      // Other focus ids (send-welcome-test, learning-roadmap, next-lesson-ideas)
      // are spotlight targets handled by SpotlightOverlay.
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
    // requestPlanAction is intentionally not a dependency: the handler must
    // run once per focus/_ pair, not again when the segment changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam, cacheBuster, setSearchParams]);

  // v6.9.29 — "Add goal" buttons anywhere (MacroTimeline warnings, onboarding)
  // dispatch `dslm:addGoal`; the Plan owns the single Add-goal dialog.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.studentId && detail.studentId !== studentId) return;
      requestPlanAction('add_goal');
    };
    window.addEventListener('dslm:addGoal', handler);
    return () => window.removeEventListener('dslm:addGoal', handler);
  }, [studentId, requestPlanAction]);

  const welcomeTest: WelcomeTestControls = {
    busy: welcomeActions.busy,
    send: async () => {
      const ok = await welcomeActions.send();
      plan.welcomeTest.refetch();
      return ok;
    },
    copyLink: async () => {
      const ensured = await welcomeActions.ensure();
      plan.welcomeTest.refetch();
      if (!ensured?.shareUrl) return;
      try {
        await navigator.clipboard.writeText(ensured.shareUrl);
        toast.success('Welcome Test link copied.');
      } catch {
        toast.message('Welcome Test link', { description: ensured.shareUrl });
      }
    },
  };

  const handleImprovement = (improvement: ReadinessImprovement) => {
    if (improvement === 'send_test') {
      guardAction('Sending the Welcome Test', () => { void welcomeTest.send(); });
    } else if (improvement === 'generate_roadmap') {
      requestPlanAction('generate_roadmap');
    } else {
      requestPlanAction('add_goal');
    }
  };

  const openTestResults = () => {
    setSearchParams((prev) => buildWorkspaceParams(prev, { tab: 'timeline', filter: 'tests' }));
  };

  const { readiness, currentPhase, phases } = plan;

  return (
    <div className="space-y-4" data-testid="learning-plan-tab">
      <ModelStatusLine
        stage={plan.isReady ? readiness.stage : 'loading'}
        studentName={studentName}
        doneCount={readiness.doneCount}
        totalSteps={readiness.steps.length}
        pendingReviewCount={plan.pendingReviewCount}
        queuedCount={plan.upNext.length}
        phaseProgress={currentPhase ? `Phase ${currentPhase.sequence_number} of ${phases.length}` : null}
        roadmapPaused={!useRoadmap && phases.length > 0}
        improvement={readiness.improvement}
        improvementBusy={welcomeActions.busy}
        onImprovement={handleImprovement}
      />

      <PlanSegmentSwitch value={segment} onChange={(next) => goToSegment(next)} />

      <div className="min-w-0 pt-2">
        {segment === 'insights' ? (
          <InsightsView
            studentId={studentId}
            teacherId={teacherId}
            studentName={studentName}
            englishLevel={englishLevel}
            anchor={anchor}
            welcomeTestState={plan.welcomeTest.state}
            welcomeTest={welcomeTest}
          />
        ) : (
          <LearningPlanView
            plan={plan}
            studentId={studentId}
            teacherId={teacherId}
            studentName={studentName}
            englishLevel={englishLevel}
            mainGoal={mainGoal}
            mainGoalTargetDate={mainGoalTargetDate}
            useRoadmap={useRoadmap}
            onUseRoadmapChange={onUseRoadmapChange}
            pacingMode={pacingMode}
            onPacingModeChange={onPacingModeChange}
            onMainGoalChange={onMainGoalChange}
            onMainGoalTargetDateChange={onMainGoalTargetDateChange}
            onUseWorksheetSuggestion={onUseWorksheetSuggestion}
            anchor={anchor}
            pendingAction={pendingAction}
            onConsumePendingAction={consumePendingAction}
            welcomeTest={welcomeTest}
            onOpenTestResults={openTestResults}
          />
        )}
      </div>
    </div>
  );
};
