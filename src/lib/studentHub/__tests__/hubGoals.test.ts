import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildHubGoalViews, clampProgress, goalStatusLabel, toHubGoalView, type HubGoal } from '../hubGoals';

const NOW = new Date('2026-10-29T18:00:00Z');
const goal = (o: Partial<HubGoal> = {}): HubGoal => ({
  id: 'g1', title: 'Lead Q4 board meeting in English', description: null, goal_type: 'custom',
  target_date: null, is_achieved: false, achieved_at: null, manual_progress_pct: null, display_order: 0, ...o,
});

describe('hubGoals', () => {
  it('achieved goal reads 100% regardless of saved progress', () => {
    const v = toHubGoalView(goal({ is_achieved: true, manual_progress_pct: 40 }), NOW);
    expect(v.status).toBe('achieved');
    expect(v.progressPct).toBe(100);
  });
  it('past target date is overdue', () => {
    expect(toHubGoalView(goal({ target_date: '2026-10-28' }), NOW).status).toBe('overdue');
  });
  it('within 14 days is due soon, 15 days is in progress', () => {
    const soon = toHubGoalView(goal({ target_date: '2026-11-12' }), NOW);
    expect(soon.status).toBe('due_soon');
    expect(goalStatusLabel(soon)).toBe('14 days left');
    expect(toHubGoalView(goal({ target_date: '2026-11-13' }), NOW).status).toBe('in_progress');
    expect(goalStatusLabel(toHubGoalView(goal({ target_date: '2026-10-29' }), NOW))).toBe('Due today');
  });
  it('never invents progress when the teacher set none', () => {
    expect(toHubGoalView(goal(), NOW).progressPct).toBeNull();
    expect(clampProgress(140)).toBe(100);
    expect(clampProgress(-5)).toBe(0);
  });
  it('orders active goals by teacher order, achieved last, drops empty titles', () => {
    const out = buildHubGoalViews([
      goal({ id: 'a', is_achieved: true, display_order: 0 }),
      goal({ id: 'b', display_order: 2 }),
      goal({ id: 'c', display_order: 1 }),
      goal({ id: 'd', title: '  ' }),
    ], NOW);
    expect(out.map((g) => g.id)).toEqual(['c', 'b', 'a']);
  });
  it('edge function hides deleted, archived and unaccepted auto-suggested goals', () => {
    const src = readFileSync('supabase/functions/get-student-hub-data/index.ts', 'utf8');
    expect(src).toContain(".from('student_progress_goals')");
    expect(src).toContain(".is('deleted_at', null)");
    expect(src).toContain(".is('archived_at', null)");
    expect(src).toContain("g.source === 'welcome_test_auto' && !g.accepted_at");
    expect(src).toContain(".eq('teacher_id', teacherId)");
  });
});
