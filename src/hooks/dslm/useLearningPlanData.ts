/**
 * useLearningPlanData — the single owner of plan data on the Learning plan tab.
 *
 * Composes the existing DSLM hooks once (instead of every sub-view mounting
 * its own copies) and derives the queue order, the setup stage and the
 * "Needs your OK" count. Legacy components opened inside side sheets keep
 * their own hooks and stay in sync through the existing window events.
 */
import { useEffect, useMemo, useState } from 'react';
import { useFutureTimeline } from '@/hooks/useFutureTimeline';
import { useCurriculumPhases } from '@/hooks/dslm/useCurriculumPhases';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { usePacingProposals } from '@/hooks/usePacingProposals';
import { useStudentAttentionDots } from '@/hooks/useStudentAttentionDots';
import { useWelcomeTestState } from '@/hooks/dslm/useWelcomeTestState';
import { findCurrentPhase, orderUpNext, sortPhases } from '@/lib/dslm/learningPlan';
import { computeModelReadiness } from '@/lib/dslm/modelReadiness';
import { isActiveGoal, isSuggestedGoal } from '@/lib/dslm/goals';

interface UseLearningPlanDataProps {
  studentId: string;
  teacherId: string;
  englishLevel: string;
  mainGoal: string;
  useRoadmap: boolean;
}


export function useLearningPlanData({
  studentId,
  teacherId,
  englishLevel,
  mainGoal,
  useRoadmap,
}: UseLearningPlanDataProps) {
  const timeline = useFutureTimeline({ studentId, teacherId });
  const curriculum = useCurriculumPhases({ studentId, teacherId });
  const progress = useStudentProgress({ studentId, teacherId });
  const pacing = usePacingProposals(studentId);
  const attention = useStudentAttentionDots(studentId, teacherId, englishLevel);
  const welcomeTest = useWelcomeTestState(studentId, teacherId);

  // Hooks flip `loading` on every refetch; the plan only shows its skeleton
  // until the first complete load, never again (no flicker on broadcasts).
  const loadingNow = timeline.loading || curriculum.loading || progress.loading || welcomeTest.isLoading;
  const [hasLoaded, setHasLoaded] = useState(false);
  useEffect(() => {
    if (!loadingNow) setHasLoaded(true);
  }, [loadingNow]);

  const phases = useMemo(() => sortPhases(curriculum.phases), [curriculum.phases]);
  const currentPhase = useMemo(() => findCurrentPhase(phases), [phases]);

  const upNext = useMemo(
    () => orderUpNext({ phases, phaseSteps: timeline.phaseSteps, nextSteps: timeline.nextSteps }),
    [phases, timeline.phaseSteps, timeline.nextSteps],
  );

  const activeGoals = useMemo(() => progress.goals.filter(isActiveGoal), [progress.goals]);
  const suggestedGoals = useMemo(() => progress.goals.filter(isSuggestedGoal), [progress.goals]);

  const pendingReviewCount = suggestedGoals.length + pacing.proposals.length + (attention.level ? 1 : 0);

  const readiness = useMemo(
    () =>
      computeModelReadiness({
        hasMainGoal: !!mainGoal?.trim(),
        activeGoalsCount: activeGoals.length,
        welcomeTest: welcomeTest.state,
        phasesCount: phases.length,
        activeSuggestionsCount: upNext.length,
        pendingReviewCount,
        useRoadmap,
      }),
    [mainGoal, activeGoals.length, welcomeTest.state, phases.length, upNext.length, pendingReviewCount, useRoadmap],
  );

  return {
    isReady: hasLoaded,
    timeline,
    curriculum,
    phases,
    currentPhase,
    upNext,
    progress,
    activeGoals,
    suggestedGoals,
    pacing,
    attention,
    welcomeTest,
    pendingReviewCount,
    readiness,
  };
}

export type LearningPlanData = ReturnType<typeof useLearningPlanData>;
