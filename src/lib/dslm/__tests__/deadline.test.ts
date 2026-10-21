import { describe, it, expect } from 'vitest';
import { resolveDeadline, overduePromptText, deadlineReminder, goalsForPrompt } from '../../../../supabase/functions/_shared/deadline';
import { fitPhasesToDeadline, rebaseFromWeek } from '../../../../supabase/functions/_shared/phaseFit';

const NOW = new Date('2026-10-21T15:00:00Z').getTime();
const plusDays = (d: number) => new Date(Date.UTC(2026, 9, 21 + d)).toISOString().slice(0, 10);

describe('resolveDeadline', () => {
  it('returns no deadline when nothing is set', () => {
    const r = resolveDeadline({ main_goal_target_date: null }, [], NOW);
    expect(r).toMatchObject({ weeksUntilDeadline: null, source: 'fallback_no_deadline', overdue: false });
  });
  it('rounds days to weeks with a minimum of 1', () => {
    expect(resolveDeadline({ main_goal_target_date: plusDays(70) }, [], NOW).weeksUntilDeadline).toBe(10);
    expect(resolveDeadline({ main_goal_target_date: plusDays(2) }, [], NOW).weeksUntilDeadline).toBe(1);
  });
  it('a deadline today is 1 week and not overdue', () => {
    const r = resolveDeadline({ main_goal_target_date: plusDays(0) }, [], NOW);
    expect(r.overdue).toBe(false);
    expect(r.weeksUntilDeadline).toBe(1);
  });
  it('an overdue main date is flagged, not turned into 1 week', () => {
    const r = resolveDeadline({ main_goal_target_date: plusDays(-10) }, [], NOW);
    expect(r.weeksUntilDeadline).toBeNull();
    expect(r.overdue).toBe(true);
    expect(r.overdueDeadlines[0]).toMatchObject({ kind: 'main_goal', daysOverdue: 10 });
    expect(r.source).toBe('fallback_no_deadline');
  });
  it('main date wins while ahead, else the earliest future goal', () => {
    const goals = [{ id: 'a', target_date: plusDays(40) }, { id: 'b', target_date: plusDays(20) }];
    expect(resolveDeadline({ main_goal_target_date: plusDays(90) }, goals, NOW)).toMatchObject({ source: 'student.main_goal_target_date', weeksUntilDeadline: 13 });
    expect(resolveDeadline({ main_goal_target_date: null }, goals, NOW)).toMatchObject({ source: 'goal.target_date', weeksUntilDeadline: 3 });
  });
  it('an overdue main date still lets a future goal plan, and stays flagged', () => {
    const r = resolveDeadline({ main_goal_target_date: plusDays(-3) }, [{ id: 'g', target_date: plusDays(28) }], NOW);
    expect(r.weeksUntilDeadline).toBe(4);
    expect(r.overdue).toBe(true);
  });
  it('overdue goals are flagged with their id and achieved or unparseable ones are ignored', () => {
    const r = resolveDeadline(null, [
      { id: 'late', title: 'Exam', target_date: plusDays(-5) },
      { id: 'done', target_date: plusDays(-5), is_achieved: true },
      { id: 'bad', target_date: 'not-a-date' },
    ], NOW);
    expect(r.overdueDeadlines.map((o) => o.goalId)).toEqual(['late']);
    expect(r.weeksUntilDeadline).toBeNull();
  });
  it('prompt text and reminder only exist when something is overdue', () => {
    expect(overduePromptText(resolveDeadline({ main_goal_target_date: plusDays(30) }, [], NOW))).toBe('');
    expect(deadlineReminder(resolveDeadline({ main_goal_target_date: plusDays(30) }, [], NOW))).toBeNull();
    const late = resolveDeadline({ main_goal_target_date: plusDays(-1) }, [], NOW);
    expect(overduePromptText(late)).toMatch(/DEADLINE PASSED/);
    expect(deadlineReminder(late)?.message).toMatch(/passed 1 day ago/);
    expect(overduePromptText(late) + deadlineReminder(late)!.message).not.toMatch(/—/);
  });
  it('goalsForPrompt hides an overdue date from the [DEADLINE] marker', () => {
    const out = goalsForPrompt([{ title: 'x', target_date: plusDays(-4), description: 'd' }, { title: 'y', target_date: plusDays(4) }], NOW);
    expect(out[0].target_date).toBeNull();
    expect(out[0].description).toMatch(/has passed/);
    expect(out[1].target_date).toBe(plusDays(4));
  });
});

const mk = (n: number, dur = 4) => Array.from({ length: n }, (_, i) => ({ title: `p${i}`, estimated_weeks_start: 1 + i * dur, estimated_weeks_end: (i + 1) * dur }));
const total = (ph: any[]) => ph.reduce((a, p) => a + (p.estimated_weeks_end - p.estimated_weeks_start + 1), 0);
const contiguous = (ph: any[], start: number) => ph.every((p, i) => p.estimated_weeks_start === (i === 0 ? start : ph[i - 1].estimated_weeks_end + 1));

describe('fitPhasesToDeadline', () => {
  it('leaves phases untouched without a budget', () => {
    const ph = mk(3);
    expect(fitPhasesToDeadline(ph, null)).toEqual({ phases: ph, adjusted: false });
    expect(fitPhasesToDeadline([], 10).adjusted).toBe(false);
  });
  it('scales overflowing phases down to exactly the budget, contiguous, min 2 weeks', () => {
    const r = fitPhasesToDeadline(mk(4, 5), 10);
    expect(r.adjusted).toBe(true);
    expect(total(r.phases)).toBe(10);
    expect(contiguous(r.phases, 1)).toBe(true);
    expect(r.phases.every((p) => p.estimated_weeks_end - p.estimated_weeks_start + 1 >= 2)).toBe(true);
  });
  it('gives leftover slack to the last phase when the AI plan is shorter', () => {
    const r = fitPhasesToDeadline(mk(3, 2), 12);
    expect(total(r.phases)).toBe(12);
    expect(r.phases[2].estimated_weeks_end).toBe(12);
    expect(r.adjusted).toBe(true);
  });
  it('an exact fit is not reported as adjusted', () => {
    expect(fitPhasesToDeadline(mk(3, 4), 12).adjusted).toBe(false);
  });
  it('respects the starting week', () => {
    const r = fitPhasesToDeadline(mk(2, 6), 8, 5);
    expect(r.phases[0].estimated_weeks_start).toBe(5);
    expect(total(r.phases)).toBe(8);
    expect(contiguous(r.phases, 5)).toBe(true);
  });
  it('a budget below the minimum degrades to 1-week phases within the budget', () => {
    const r = fitPhasesToDeadline(mk(5, 4), 3);
    expect(r.adjusted).toBe(true);
    expect(r.phases[r.phases.length - 1].estimated_weeks_end).toBeLessThanOrEqual(3);
  });
  it('is idempotent', () => {
    const once = fitPhasesToDeadline(mk(4, 5), 10).phases;
    expect(fitPhasesToDeadline(once, 10).phases).toEqual(once);
  });
  it('rebaseFromWeek lays durations out contiguously', () => {
    const r = rebaseFromWeek(mk(3), [2, 3, 1], 3);
    expect(r.map((p) => [p.estimated_weeks_start, p.estimated_weeks_end])).toEqual([[3, 4], [5, 7], [8, 8]]);
  });
});
