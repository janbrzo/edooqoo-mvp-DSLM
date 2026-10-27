import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * DSLM_EVENT_WEIGHT_VERSION 1 (owner decision 2026-10-26): homework evidence counts 1.0
 * once submitted and 0.8 while it is a draft; every other source counts 1.0. The rule lives
 * in public.dslm_event_weight and compute_skill_metric applies it (docs/ux/learning-model-spec.md).
 */
const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const read = (f: string) => readFileSync(join(MIGRATIONS, f), 'utf8');
const flag = read('20261027100000_homework_evidence_draft_flag.sql');
const compute = read('20261027100100_compute_skill_metric_source_weight.sql');

describe('dslm_event_weight', () => {
  it('weighs a draft homework event 0.8 and everything else 1.0', () => {
    expect(flag).toMatch(/WHEN p_event_source = 'homework' AND p_payload->>'is_submitted' = 'false' THEN 0\.8\s+ELSE 1\.0/);
  });

  it('is not callable by clients', () => {
    expect(flag).toMatch(/REVOKE ALL ON FUNCTION public\.dslm_event_weight\(text, jsonb\) FROM PUBLIC, anon, authenticated;/);
  });
});

describe('compute_skill_metric applies the weight', () => {
  it('multiplies the recency decay by the event weight in both sums', () => {
    expect(compute).toMatch(/public\.dslm_event_weight\(se\.event_source, se\.event_payload\) AS weight/);
    expect(compute).toMatch(/SUM\(p\.mastery_val \* COALESCE\(p\.weight, 1\) \* exp\(-0\.03/);
    expect(compute).toMatch(/SUM\(COALESCE\(p\.weight, 1\) \* exp\(-0\.03/);
  });

  it('keeps flashcard points at weight 1.0 and history and trend on the raw points', () => {
    expect(compute).toMatch(/1\.0::numeric AS weight/);
    expect(compute).toMatch(/'mastery', ROUND\(l\.mastery_val, 1\)/);
  });

  it('keeps removing a metric that has no supporting events left', () => {
    expect(compute).toMatch(/IF v_total_events = 0 THEN[\s\S]*DELETE FROM public\.student_skill_metrics/);
  });
});

describe('submit finalises draft flags', () => {
  it('flips is_submitted of the submitted exercises and backfills stale events', () => {
    expect(flag).toMatch(/jsonb_set\(se\.event_payload, '\{is_submitted\}', 'true'::jsonb\)/);
    expect(flag.match(/jsonb_set\(se\.event_payload, '\{is_submitted\}'/g)?.length).toBe(2);
  });

  it('the first migration has no DELETE or DROP (the SQL tool waits for a confirmation on one)', () => {
    expect(flag).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(flag).not.toMatch(/\bDROP\s+(FUNCTION|TRIGGER|TABLE|POLICY)\b/i);
  });
});
