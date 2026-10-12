import { describe, it, expect } from 'vitest';
import {
  describeAnswerBehaviour,
  describeLearningPath,
  isFallbackSummary,
  isLowSignalCoverage,
  overrideLabel,
  resolveLearningPath,
  resolveSignalCoverage,
  toDivergenceRows,
  UNREALISTIC_GOAL_WARNING,
} from '../learningProfileView';

const v1 = { score: 62, path: 'accelerated', component_scores: { deadline_response: 80, timeline: 90, anxiety: 40, study_time: 70 }, overrides_applied: ['urgent_lazy_override'] };
const v2 = {
  version: 2, score: 88, path: 'target', coverage: 0.55,
  component_scores: { a_one: 10, b_two: null, c_three: 95, d_four: 60, e_five: 70 },
  overrides_applied: ['urgent_critical_override', 'brand_new_rule'],
  capacity: 'low', capacity_cap: 50, capacity_warning: 'unrealistic_goal',
};

describe('resolveLearningPath', () => {
  it('returns null for old profiles without any learning path', () => {
    expect(resolveLearningPath(null)).toBeNull();
    expect(resolveLearningPath({ raw_answers: { wt_q1: 'x' } })).toBeNull();
    expect(resolveLearningPath({ learning_path: null, raw_answers: null })).toBeNull();
  });

  it('prefers the column and falls back to raw_answers.learning_path', () => {
    expect(resolveLearningPath({ learning_path: v2 as never, raw_answers: { learning_path: v1 } })?.score).toBe(88);
    expect(resolveLearningPath({ learning_path: null, raw_answers: { learning_path: v1 } })?.score).toBe(62);
  });
});

describe('describeLearningPath', () => {
  it('treats a missing version as v1 and has no coverage', () => {
    const view = describeLearningPath(resolveLearningPath({ raw_answers: { learning_path: v1 } }))!;
    expect(view.version).toBe(1);
    expect(view.pathLabel).toBe('Accelerated');
    expect(view.coveragePercent).toBeNull();
    expect(view.capacityWarning).toBeNull();
    expect(view.overrides).toEqual(['Urgent deadline raised the path despite low persistence']);
  });

  it('shows v2 coverage, the top 3 components, override labels and the capacity warning', () => {
    const view = describeLearningPath(v2 as never)!;
    expect(view.version).toBe(2);
    expect(view.score).toBe(88);
    expect(view.coveragePercent).toBe(55);
    expect(view.topComponents.map((c) => c.name)).toEqual(['c_three', 'e_five', 'd_four']);
    expect(view.topComponents[0].label).toBe('C three');
    expect(view.overrides[1]).toBe('brand_new_rule');
    expect(view.capacityWarning).toBe(UNREALISTIC_GOAL_WARNING);
  });

  it('maps unknown override ids to themselves', () => {
    expect(overrideLabel('xyz')).toBe('xyz');
  });
});

describe('badges', () => {
  it('detects the deterministic fallback summary', () => {
    expect(isFallbackSummary(JSON.stringify({ summary: 's', fallback: true }))).toBe(true);
    expect(isFallbackSummary(JSON.stringify({ summary: 's' }))).toBe(false);
    expect(isFallbackSummary('Plain text summary')).toBe(false);
    expect(isFallbackSummary(null)).toBe(false);
    expect(isFallbackSummary('{broken')).toBe(false);
  });

  it('uses signal_coverage, then learning_path.coverage', () => {
    expect(resolveSignalCoverage({ signal_coverage: 0.4 })).toBe(0.4);
    expect(resolveSignalCoverage({ signal_coverage: '0.75' })).toBe(0.75);
    expect(resolveSignalCoverage({ learning_path: v2 as never })).toBe(0.55);
    expect(resolveSignalCoverage({ raw_answers: { learning_path: v1 } })).toBeNull();
    expect(isLowSignalCoverage(0.59)).toBe(true);
    expect(isLowSignalCoverage(0.6)).toBe(false);
    expect(isLowSignalCoverage(null)).toBe(false);
  });
});

describe('toDivergenceRows', () => {
  it('returns null when there is nothing to show', () => {
    expect(toDivergenceRows(null)).toBeNull();
    expect(toDivergenceRows([])).toBeNull();
    expect(toDivergenceRows([{ pair: 'level' }])).toBeNull();
  });

  it('labels pairs, humanizes values and sorts strongest first', () => {
    const rows = toDivergenceRows([
      { pair: 'motivation', declared: 'instrumental', observed: 'career_critical', gap: null, severity: 'info' },
      { pair: 'level', declared: 'B2', observed: 'A2', gap: 2, severity: 'strong' },
      { pair: 'new_pair', declared: 'x', observed: 'y', gap: null, severity: 'weird' },
    ])!;
    expect(rows.map((r) => r.label)).toEqual(['Level', 'Motivation', 'New pair']);
    expect(rows[0].severityLabel).toBe('Strong');
    expect(rows[1].observed).toBe('career critical');
    expect(rows[2].severity).toBe('info');
  });
});

describe('describeAnswerBehaviour', () => {
  it('returns null for missing data', () => {
    expect(describeAnswerBehaviour(null)).toBeNull();
    expect(describeAnswerBehaviour({})).toBeNull();
  });

  it('builds the line parts', () => {
    expect(describeAnswerBehaviour({
      keyed_total: 20, keyed_answered: 17, skip_count_skill: 3, idk_count_skill: 1,
      coverage: 0.85, median_seconds_keyed: 11.6, rushed_count: 1,
    })).toEqual([
      'Answered 17 of 20 skill items',
      '3 skill items skipped',
      '1 "I don\'t know"',
      'median 12 s per skill item',
      '1 rushed answer (under 3 s)',
    ]);
  });

  it('omits the median when it is null', () => {
    const parts = describeAnswerBehaviour({ keyed_total: 0, keyed_answered: 0, skip_count_skill: 0, idk_count_skill: 0, coverage: 0, median_seconds_keyed: null, rushed_count: 0 })!;
    expect(parts.some((p) => p.startsWith('median'))).toBe(false);
  });
});
