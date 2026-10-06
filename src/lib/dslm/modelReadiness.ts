/**
 * modelReadiness: which stage the Learning plan tab is in, and what the
 * teacher should do next. Replaces the old lessons+worksheets "model health"
 * heuristic, which reported "Learning" for a student with no plan at all.
 *
 * Stages:
 *  - `setup` : no active lesson suggestion yet → 4-step checklist.
 *  - `review`: the plan exists and the system proposes changes that need
 *               the teacher's OK (level change, pacing, suggested goals).
 *  - `ready` : the plan exists and nothing waits for approval.
 *
 * No React, no Supabase, no globals: every rule here is unit-testable.
 */

export type ReadinessStage = 'setup' | 'review' | 'ready';
export type SetupStepKey = 'goal' | 'test' | 'roadmap' | 'suggestions';
export type WelcomeTestState = 'none' | 'sent' | 'completed';
export type ReadinessImprovement = 'set_main_goal' | 'send_test' | 'generate_roadmap' | 'add_goal';

export interface ReadinessInput {
  hasMainGoal: boolean;
  /** Active (not achieved, not archived) progress goals. */
  activeGoalsCount: number;
  welcomeTest: WelcomeTestState;
  phasesCount: number;
  activeSuggestionsCount: number;
  pendingReviewCount: number;
  /** When false the roadmap is paused, so it is never suggested as an improvement. */
  useRoadmap?: boolean;
}

export interface SetupStep {
  key: SetupStepKey;
  done: boolean;
  /** Welcome Test sent but not completed: the teacher can only wait or resend. */
  waiting: boolean;
}

export interface Readiness {
  stage: ReadinessStage;
  steps: SetupStep[];
  doneCount: number;
  /** First step the teacher can act on now; null when every step is done or waiting. */
  nextStepKey: SetupStepKey | null;
  /** One optional hint shown once the plan exists. */
  improvement: ReadinessImprovement | null;
}

export const SETUP_STEP_ORDER: readonly SetupStepKey[] = ['goal', 'test', 'roadmap', 'suggestions'] as const;

export function computeModelReadiness(input: ReadinessInput): Readiness {
  const activeGoals = Math.max(0, input.activeGoalsCount || 0);
  const phases = Math.max(0, input.phasesCount || 0);
  const suggestions = Math.max(0, input.activeSuggestionsCount || 0);
  const pending = Math.max(0, input.pendingReviewCount || 0);

  const doneByKey: Record<SetupStepKey, boolean> = {
    goal: input.hasMainGoal || activeGoals > 0,
    test: input.welcomeTest === 'completed',
    roadmap: phases > 0,
    suggestions: suggestions > 0,
  };

  const steps: SetupStep[] = SETUP_STEP_ORDER.map((key) => ({
    key,
    done: doneByKey[key],
    waiting: key === 'test' && input.welcomeTest === 'sent',
  }));

  const nextStepKey = steps.find((step) => !step.done && !step.waiting)?.key ?? null;
  const doneCount = steps.filter((step) => step.done).length;

  let stage: ReadinessStage = 'ready';
  if (suggestions === 0) stage = 'setup';
  else if (pending > 0) stage = 'review';

  let improvement: ReadinessImprovement | null = null;
  if (stage !== 'setup') {
    // The main goal is the plan's destination, so it comes first.
    if (!input.hasMainGoal) improvement = 'set_main_goal';
    else if (input.welcomeTest === 'none') improvement = 'send_test';
    else if (phases === 0 && input.useRoadmap !== false) improvement = 'generate_roadmap';
    else if (activeGoals === 0) improvement = 'add_goal';
  }

  return { stage, steps, doneCount, nextStepKey, improvement };
}

export interface WelcomeTestRow {
  status: string | null;
  created_at: string | null;
}

/**
 * Collapse every Welcome Test attempt into one state. Any completed or
 * reviewed attempt means the placement evidence exists (a pending retake does
 * not erase it); otherwise any attempt row means the test was issued.
 */
export function resolveWelcomeTestState(rows: readonly WelcomeTestRow[] | null | undefined): {
  state: WelcomeTestState;
  sentAt: string | null;
} {
  const list = rows ?? [];
  if (list.length === 0) return { state: 'none', sentAt: null };
  const latestCreated = [...list]
    .map((row) => row.created_at)
    .filter((value): value is string => !!value)
    .sort()
    .pop() ?? null;
  const completed = list.some((row) => row.status === 'completed' || row.status === 'reviewed');
  return { state: completed ? 'completed' : 'sent', sentAt: latestCreated };
}
