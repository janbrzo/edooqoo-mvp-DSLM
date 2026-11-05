import { describe, it, expect } from 'vitest';
import { computeGoalVelocity, classifyDeadlineKind } from '../deadlineVelocity';

const now = new Date('2026-11-05T00:00:00Z');
const goal = (over: Partial<Parameters<typeof computeGoalVelocity>[0]> = {}) => computeGoalVelocity({
  title: 'Small talk fluency', createdAt: '2026-09-06T00:00:00Z', targetDate: '2026-11-20T00:00:00Z',
  progressPct: 50, now, ...over,
});

describe('deadlineVelocity', () => {
  it('flags 50% progress at 80% of time as lagging with an extension for a soft goal', () => {
    const r = goal();
    expect(r.timeElapsedPct).toBe(80);
    expect(r.status).toBe('lagging');
    expect(r.recommendation).toBe('extend');
    expect(r.suggestedTargetDate! > '2026-11-20').toBe(true);
  });

  it('never proposes moving a hard deadline (exam)', () => {
    const r = goal({ title: 'Pass IELTS exam' });
    expect(r.deadlineKind).toBe('hard');
    expect(r.status).toBe('lagging');
    expect(r.recommendation).toBe('narrow_scope');
    expect(r.suggestedTargetDate).toBeNull();
  });

  it('is on track at ratio >= 0.85', () => {
    expect(goal({ progressPct: 70 }).status).toBe('on_track');
  });

  it('is tension between 0.60 and 0.85', () => {
    expect(goal({ progressPct: 60 }).status).toBe('tension');
  });

  it('does not judge pace in the first 20% of the window', () => {
    expect(goal({ createdAt: '2026-11-01T00:00:00Z', progressPct: 0 }).status).toBe('on_track');
  });

  it('suggests a future date for an overdue soft goal', () => {
    const r = goal({ targetDate: '2026-10-01T00:00:00Z' });
    expect(r.status).toBe('overdue');
    expect(r.suggestedTargetDate! > '2026-11-05').toBe(true);
  });

  it('ignores achieved goals and goals without a date', () => {
    expect(goal({ isAchieved: true }).status).toBe('achieved');
    expect(goal({ targetDate: null }).status).toBe('no_deadline');
  });

  it('classifies deadline kinds', () => {
    expect(classifyDeadlineKind('Job interview at Siemens')).toBe('hard');
    expect(classifyDeadlineKind('Use past tenses confidently')).toBe('soft');
  });
});
