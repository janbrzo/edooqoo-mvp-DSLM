import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FORGETTING_GRACE_DAYS, FORGETTING_HALF_LIFE_DAYS, FORGETTING_FLOOR } from '../../../supabase/functions/_shared/forgetting';
import {
  LPS_VERSION, LOW_CAPACITY_CAP, LOW_CAPACITY_URGENT_CAP, pathForScore,
} from '../../../supabase/functions/_shared/learningPathScore';
import {
  PACING_PROPOSAL_MAX_AGE_DAYS, DEFAULT_PACING_MODE, MIN_PACING_EVIDENCE_EVENTS,
  MIN_PACING_EVIDENCE_SKILLS, STALE_DEADLINE_DAYS,
} from '../../../supabase/functions/_shared/pacing';

/**
 * dslm_interpretation_params version 1 documents the constants in force today.
 * Nothing reads the table yet, so this test is what stops it from drifting.
 */
const ROOT = join(__dirname, '../../../');
const migration = readFileSync(join(ROOT, 'supabase/migrations/20261027090000_dslm_validation_loop_v1.sql'), 'utf8');

const seeded: Record<string, unknown> = {};
for (const m of migration.matchAll(/\('1', '([a-z_.]+)', '((?:[^']|'')*)',/g)) {
  seeded[m[1]] = JSON.parse(m[2]);
}

describe('dslm_interpretation_params version 1 matches the code', () => {
  it('seeds every expected parameter once', () => {
    expect(Object.keys(seeded).sort()).toEqual([
      'forgetting.floor', 'forgetting.grace_days', 'forgetting.half_life_days',
      'lps.low_capacity_cap', 'lps.low_capacity_urgent_cap', 'lps.path_thresholds', 'lps.version', 'lps.weights',
      'metric.decay_per_day', 'metric.history_points', 'metric.min_points_for_trend',
      'metric.trend_older_points', 'metric.trend_recent_points', 'metric.trend_threshold',
      'pacing.default_mode', 'pacing.min_evidence_events', 'pacing.min_evidence_skills',
      'pacing.proposal_max_age_days', 'pacing.stale_deadline_days',
    ]);
  });

  it('forgetting, LPS and pacing constants equal the imported code constants', () => {
    expect(seeded['forgetting.grace_days']).toBe(FORGETTING_GRACE_DAYS);
    expect(seeded['forgetting.half_life_days']).toBe(FORGETTING_HALF_LIFE_DAYS);
    expect(seeded['forgetting.floor']).toBe(FORGETTING_FLOOR);
    expect(seeded['lps.version']).toBe(LPS_VERSION);
    expect(seeded['lps.low_capacity_cap']).toBe(LOW_CAPACITY_CAP);
    expect(seeded['lps.low_capacity_urgent_cap']).toBe(LOW_CAPACITY_URGENT_CAP);
    expect(seeded['pacing.proposal_max_age_days']).toBe(PACING_PROPOSAL_MAX_AGE_DAYS);
    expect(seeded['pacing.default_mode']).toBe(DEFAULT_PACING_MODE);
    expect(seeded['pacing.min_evidence_events']).toBe(MIN_PACING_EVIDENCE_EVENTS);
    expect(seeded['pacing.min_evidence_skills']).toBe(MIN_PACING_EVIDENCE_SKILLS);
    expect(seeded['pacing.stale_deadline_days']).toBe(STALE_DEADLINE_DAYS);
  });

  it('LPS path thresholds equal pathForScore', () => {
    const t = seeded['lps.path_thresholds'] as Record<string, number>;
    expect(pathForScore(t.guided - 1)).toBe('comfort');
    expect(pathForScore(t.guided)).toBe('guided');
    expect(pathForScore(t.accelerated - 1)).toBe('guided');
    expect(pathForScore(t.accelerated)).toBe('accelerated');
    expect(pathForScore(t.target - 1)).toBe('accelerated');
    expect(pathForScore(t.target)).toBe('target');
  });

  it('LPS weights equal the WEIGHTS map in learningPathScore.ts (not exported, read from source)', () => {
    const src = readFileSync(join(ROOT, 'supabase/functions/_shared/learningPathScore.ts'), 'utf8');
    const block = src.match(/const WEIGHTS: Record<string, number> = \{([^}]+)\}/)![1];
    const code: Record<string, number> = {};
    for (const m of block.matchAll(/([a-z_]+):\s*([0-9.]+)/g)) code[m[1]] = Number(m[2]);
    expect(seeded['lps.weights']).toEqual(code);
    expect(Object.values(code).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('metric constants equal compute_skill_metric (decay, trend windows, threshold, history)', () => {
    const dir = join(ROOT, 'supabase/migrations');
    const fn = readFileSync(join(dir, '20261017100000_welcome_test_server_authority.sql'), 'utf8');
    const body = fn.slice(fn.indexOf('CREATE OR REPLACE FUNCTION public.compute_skill_metric('));
    const decay = [...body.matchAll(/exp\(-([0-9.]+) \* EXTRACT/g)].map((m) => Number(m[1]));
    expect(decay.length).toBe(2);
    for (const d of decay) expect(d).toBe(seeded['metric.decay_per_day']);
    expect(body).toContain(`IF v_total_events >= ${seeded['metric.min_points_for_trend']} THEN`);
    expect(body).toContain(`v_recent_avg > v_older_avg + ${seeded['metric.trend_threshold']}`);
    expect(body).toContain(`v_recent_avg < v_older_avg - ${seeded['metric.trend_threshold']}`);
    expect(body).toContain(`LIMIT ${seeded['metric.trend_recent_points']}\n`);
    expect(body).toContain(`OFFSET ${seeded['metric.trend_recent_points']} LIMIT ${seeded['metric.trend_older_points']}`);
    expect(body).toContain(`LIMIT ${seeded['metric.history_points']}\n`);
  });
});
