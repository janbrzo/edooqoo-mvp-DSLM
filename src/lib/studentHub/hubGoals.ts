/**
 * Pillar 3.1: pure view model for learner-visible goals in the Student Hub.
 * Read-only: never infers mastery, only reflects what the teacher saved.
 */
export interface HubGoal {
  id: string;
  title: string;
  description: string | null;
  goal_type: string;
  target_date: string | null;
  is_achieved: boolean;
  achieved_at: string | null;
  manual_progress_pct: number | null;
  display_order: number;
}

export type HubGoalStatus = 'achieved' | 'overdue' | 'due_soon' | 'in_progress';

export interface HubGoalView extends HubGoal {
  status: HubGoalStatus;
  /** 0-100, or null when the teacher has not set a progress value. */
  progressPct: number | null;
  daysLeft: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const DUE_SOON_DAYS = 14;

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function clampProgress(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function toHubGoalView(goal: HubGoal, now: Date): HubGoalView {
  let daysLeft: number | null = null;
  if (goal.target_date) {
    const t = Date.parse(`${goal.target_date.slice(0, 10)}T00:00:00Z`);
    if (Number.isFinite(t)) daysLeft = Math.round((t - startOfUtcDay(now)) / DAY_MS);
  }
  let status: HubGoalStatus = 'in_progress';
  if (goal.is_achieved) status = 'achieved';
  else if (daysLeft !== null && daysLeft < 0) status = 'overdue';
  else if (daysLeft !== null && daysLeft <= DUE_SOON_DAYS) status = 'due_soon';
  const progressPct = goal.is_achieved ? 100 : clampProgress(goal.manual_progress_pct);
  return { ...goal, status, progressPct, daysLeft };
}

/** Active goals first (teacher order), achieved goals last. */
export function buildHubGoalViews(goals: HubGoal[], now: Date): HubGoalView[] {
  return goals
    .filter((g) => (g.title ?? '').trim() !== '')
    .map((g) => toHubGoalView(g, now))
    .sort((a, b) => {
      const aa = a.status === 'achieved' ? 1 : 0;
      const bb = b.status === 'achieved' ? 1 : 0;
      if (aa !== bb) return aa - bb;
      return a.display_order - b.display_order;
    });
}

export function goalStatusLabel(view: HubGoalView): string {
  switch (view.status) {
    case 'achieved':
      return 'Achieved';
    case 'overdue':
      return 'Past target date';
    case 'due_soon':
      return view.daysLeft === 0 ? 'Due today' : `${view.daysLeft} days left`;
    default:
      return 'In progress';
  }
}
