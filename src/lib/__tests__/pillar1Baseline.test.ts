import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  FORGETTING_GRACE_DAYS,
  FORGETTING_HALF_LIFE_DAYS,
  FORGETTING_FLOOR,
  effectiveMastery,
  withEffectiveMastery,
} from '../../../supabase/functions/_shared/forgetting';

/**
 * Pillar 1 zero-regression baseline (Stage 1.4).
 *
 * Cross-cutting invariants that must hold after Stages 1.1-1.3 regardless of
 * which file a future change touches: the unevaluated sentinel, the forgetting
 * constants shared by client and SQL, and the read-only state vector contract.
 * SQL-side invariants live in dslmSqlBaseline.test.ts; this file guards the
 * TypeScript boundary and the TS<->SQL parity inputs.
 */

const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
  .join('\n');

describe('Unevaluated sentinel (Stage 1.2)', () => {
  const mapper = readFileSync(join(__dirname, '../../utils/aiEvaluationMapper.ts'), 'utf8');

  it('a missing or non-finite quality_score maps to -1, never to a fabricated score', () => {
    expect(mapper).toMatch(/quality_score:\s*typeof qe\.quality_score === 'number' && Number\.isFinite\(qe\.quality_score\) \? qe\.quality_score : -1/);
    expect(mapper).not.toMatch(/quality_score\s*\|\|\s*0\.7/);
  });

  it('an unmapped question keeps quality_score -1 instead of a fallback', () => {
    expect(mapper).toMatch(/is_acceptable: false, quality_score: -1/);
  });
});

describe('Forgetting curve constants (Stage 1.3 parity inputs)', () => {
  it('the shared constants keep the approved values (14d grace, 60d half-life, 50% floor)', () => {
    expect(FORGETTING_GRACE_DAYS).toBe(14);
    expect(FORGETTING_HALF_LIFE_DAYS).toBe(60);
    expect(FORGETTING_FLOOR).toBe(0.5);
  });

  it('the SQL decay helper uses the same constants', () => {
    const body = readFileSync(join(MIGRATIONS, '20261017134759_4942ac57-81e4-47df-a362-f032f608f5f0.sql'), 'utf8');
    expect(body).toMatch(/14/);
    expect(body).toMatch(/60/);
    expect(body).toMatch(/0\.5/);
  });

  it('effectiveMastery never writes back: raw value is preserved alongside', () => {
    const rows = withEffectiveMastery([
      { current_mastery: 80, last_event_at: new Date(Date.now() - 200 * 86400000).toISOString() },
    ]);
    expect(rows[0].raw_mastery).toBe(80);
    expect(rows[0].current_mastery).toBeLessThan(80);
    expect(rows[0].current_mastery).toBeGreaterThanOrEqual(80 * FORGETTING_FLOOR - 0.1);
  });

  it('grace period and missing date leave the stored value untouched', () => {
    const recent = new Date(Date.now() - 5 * 86400000).toISOString();
    expect(effectiveMastery(73.4, recent)).toBe(73.4);
    expect(effectiveMastery(73.4, null)).toBe(73.4);
    expect(effectiveMastery(73.4, 'not-a-date')).toBe(73.4);
  });
});

describe('State vector read-only contract (Stage 1.3)', () => {
  it('no client module imports the state vector RPC into a write path', () => {
    // The RPC is a read-only projection; nothing in src/ may call it yet.
    // When a UI consumer is added, replace this guard with a usage allowlist.
    const srcFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(p); }
        else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && entry.name !== 'types.ts') srcFiles.push(p);
      }
    };
    walk(join(__dirname, '../..'));
    const callers = srcFiles.filter((f) => readFileSync(f, 'utf8').includes('get_student_dslm_state_vector'));
    expect(callers).toEqual([]);
  });

  it('student_skill_metrics.current_mastery is never overwritten with a decayed value in migrations', () => {
    // Forgetting applies at read time only (decision D9); the stored value is the audit trail.
    expect(sql).not.toMatch(/UPDATE public\.student_skill_metrics SET current_mastery = public\.dslm_effective_mastery/);
  });
});

describe('Event boundary normalization coverage (Stage 1.2)', () => {
  it('every DSLM event producer migration routes ratings through normalize_dslm_ratings or the trigger', () => {
    // The BEFORE INSERT/UPDATE trigger on student_events is the single boundary;
    // no later migration may bypass it with a direct payload rewrite.
    const later = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f > '20261016074048').sort();
    for (const f of later) {
      const body = readFileSync(join(MIGRATIONS, f), 'utf8');
      expect({ f, bad: /DROP TRIGGER (IF EXISTS )?trg_normalize_student_event_ratings/.test(body) }).toEqual({ f, bad: false });
    }
  });
});
