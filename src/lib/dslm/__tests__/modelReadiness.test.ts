import { describe, it, expect } from 'vitest';
import { computeModelReadiness, resolveWelcomeTestState, type ReadinessInput } from '../modelReadiness';

const base: ReadinessInput = {
  hasMainGoal: false,
  activeGoalsCount: 0,
  welcomeTest: 'none',
  phasesCount: 0,
  activeSuggestionsCount: 0,
  pendingReviewCount: 0,
};

describe('computeModelReadiness', () => {
  it('starts in setup with the goal step next', () => {
    const r = computeModelReadiness(base);
    expect(r.stage).toBe('setup');
    expect(r.doneCount).toBe(0);
    expect(r.nextStepKey).toBe('goal');
    expect(r.improvement).toBeNull();
  });

  it('treats the main goal as a done goal step', () => {
    const r = computeModelReadiness({ ...base, hasMainGoal: true });
    expect(r.steps[0]).toEqual({ key: 'goal', done: true, waiting: false });
    expect(r.nextStepKey).toBe('test');
  });

  it('skips a sent-but-pending Welcome Test when choosing the next step', () => {
    const r = computeModelReadiness({ ...base, hasMainGoal: true, welcomeTest: 'sent' });
    expect(r.steps[1]).toEqual({ key: 'test', done: false, waiting: true });
    expect(r.nextStepKey).toBe('roadmap');
  });

  it('stays in setup until a suggestion exists, whatever else is done', () => {
    const r = computeModelReadiness({ ...base, hasMainGoal: true, welcomeTest: 'completed', phasesCount: 3 });
    expect(r.stage).toBe('setup');
    expect(r.doneCount).toBe(3);
    expect(r.nextStepKey).toBe('suggestions');
  });

  it('is ready once a suggestion exists and nothing waits for approval', () => {
    const r = computeModelReadiness({
      ...base, hasMainGoal: true, activeGoalsCount: 2, welcomeTest: 'completed', phasesCount: 3, activeSuggestionsCount: 4,
    });
    expect(r.stage).toBe('ready');
    expect(r.doneCount).toBe(4);
    expect(r.nextStepKey).toBeNull();
    expect(r.improvement).toBeNull();
  });

  it('switches to review when the system proposes changes', () => {
    const r = computeModelReadiness({ ...base, hasMainGoal: true, activeSuggestionsCount: 1, pendingReviewCount: 2 });
    expect(r.stage).toBe('review');
  });

  it('suggests one improvement in priority order: test, roadmap, goal', () => {
    const ready = { ...base, hasMainGoal: true, activeSuggestionsCount: 3 };
    expect(computeModelReadiness(ready).improvement).toBe('send_test');
    expect(computeModelReadiness({ ...ready, welcomeTest: 'sent' }).improvement).toBe('generate_roadmap');
    expect(computeModelReadiness({ ...ready, welcomeTest: 'completed', phasesCount: 2 }).improvement).toBe('add_goal');
    expect(
      computeModelReadiness({ ...ready, welcomeTest: 'completed', phasesCount: 2, activeGoalsCount: 1 }).improvement,
    ).toBeNull();
  });

  it('never suggests a roadmap while the roadmap is paused', () => {
    const r = computeModelReadiness({
      ...base, hasMainGoal: true, activeGoalsCount: 1, welcomeTest: 'completed', activeSuggestionsCount: 2, useRoadmap: false,
    });
    expect(r.improvement).toBeNull();
  });

  it('clamps negative counts', () => {
    const r = computeModelReadiness({ ...base, activeSuggestionsCount: -3, pendingReviewCount: -1 });
    expect(r.stage).toBe('setup');
  });
});

describe('resolveWelcomeTestState', () => {
  it('reports none without attempts', () => {
    expect(resolveWelcomeTestState([])).toEqual({ state: 'none', sentAt: null });
    expect(resolveWelcomeTestState(null)).toEqual({ state: 'none', sentAt: null });
  });

  it('reports sent for pending attempts with the latest date', () => {
    expect(
      resolveWelcomeTestState([
        { status: 'pending', created_at: '2026-10-01T10:00:00Z' },
        { status: 'in_progress', created_at: '2026-10-03T10:00:00Z' },
      ]),
    ).toEqual({ state: 'sent', sentAt: '2026-10-03T10:00:00Z' });
  });

  it('keeps completed evidence when a retake is pending', () => {
    expect(
      resolveWelcomeTestState([
        { status: 'pending', created_at: '2026-10-04T10:00:00Z' },
        { status: 'reviewed', created_at: '2026-09-01T10:00:00Z' },
      ]).state,
    ).toBe('completed');
  });
});
