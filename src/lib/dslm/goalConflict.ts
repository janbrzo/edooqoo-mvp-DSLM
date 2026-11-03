/**
 * Reads the tutor/Welcome Test divergence flag that `process-welcome-test`
 * writes on `welcome_test_auto` suggestions. Read-only; the tutor goal always wins.
 */
import type { ProgressGoal } from '@/types/studentProgress';

export interface GoalDivergence {
  tutor: string;
  suggested: string;
}

export function divergentSuggestion(goals: readonly Pick<ProgressGoal, 'metadata'>[]): GoalDivergence | null {
  for (const g of goals) {
    const meta = (g.metadata ?? {}) as Record<string, unknown>;
    if (meta.conflict_status !== 'divergent') continue;
    const tutor = typeof meta.tutor_main_goal === 'string' ? meta.tutor_main_goal.trim() : '';
    const suggested = typeof meta.suggested_main_goal === 'string' ? meta.suggested_main_goal.trim() : '';
    if (tutor && suggested) return { tutor, suggested };
  }
  return null;
}
