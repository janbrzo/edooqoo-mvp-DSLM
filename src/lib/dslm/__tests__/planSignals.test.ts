import { describe, it, expect } from 'vitest';
import { buildWeakSkillsSnapshot, assessPlanStaleness, evaluatePhaseAdvance } from '../../../../supabase/functions/_shared/planSignals';

const NOW = new Date('2026-10-21T12:00:00Z').getTime();
const ago = (d: number) => new Date(NOW - d * 86400000).toISOString();
const row = (name: string, mastery: number, events: number, ageDays: number, extra: any = {}) => ({
  skill_name: name, skill_category: 'grammar', micro_skill: name, current_mastery: mastery,
  total_events: events, trend: 'stable', last_event_at: ago(ageDays), ...extra,
});

describe('buildWeakSkillsSnapshot', () => {
  it('lists weak non-flashcard skills with label, mastery, events and tier', () => {
    const snap = buildWeakSkillsSnapshot([
      row('ns.grammar.modal_might', 30, 4, 2),
      row('ns.grammar.articles', 90, 5, 2),
      row('flashcard:apple', 10, 9, 1, { skill_category: 'vocabulary', micro_skill: 'flashcard' }),
    ], NOW);
    expect(snap.version).toBe(1);
    expect(snap.skills).toHaveLength(1);
    expect(snap.skills[0]).toMatchObject({ mastery: 30, events: 4, tier: 'AUTHORITATIVE' });
  });
});

describe('assessPlanStaleness', () => {
  const metrics = [row('ns.grammar.modal_might', 30, 4, 2), row('ns.grammar.articles', 90, 5, 20)];
  it('is not stale without evidence newer than the plan', () => {
    const r = assessPlanStaleness({ planGeneratedAt: ago(3), metrics, now: NOW });
    expect(r.stale).toBe(false);
    expect(r.skillsWithNewEvidence).toBe(1);
  });
  it('is stale when evidence is newer and the plan is old enough', () => {
    const r = assessPlanStaleness({ planGeneratedAt: ago(21), metrics, now: NOW });
    expect(r.stale).toBe(true);
    expect(r.planAgeDays).toBe(21);
    expect(r.reasons.join(' ')).toMatch(/21 days old/);
  });
  it('is stale early when the weak list changed since the snapshot', () => {
    const snapshot = buildWeakSkillsSnapshot([row('ns.grammar.articles', 20, 4, 5)], NOW - 5 * 86400000);
    const r = assessPlanStaleness({ planGeneratedAt: ago(5), snapshot, metrics: [row('ns.grammar.articles', 85, 6, 1), row('ns.grammar.modal_might', 30, 4, 1)], now: NOW });
    expect(r.stale).toBe(true);
    expect(r.weakResolved).toHaveLength(1);
    expect(r.weakAdded).toHaveLength(1);
  });
  it('ignores flashcard evidence and a plan with no date', () => {
    const fc = [row('flashcard:x', 10, 5, 0, { micro_skill: 'flashcard' })];
    expect(assessPlanStaleness({ planGeneratedAt: ago(30), metrics: fc, now: NOW }).stale).toBe(false);
    expect(assessPlanStaleness({ planGeneratedAt: null, metrics, now: NOW }).stale).toBe(false);
  });
  it('never reads updated_at as evidence', () => {
    const m = [row('ns.grammar.modal_might', 30, 4, 40, { updated_at: ago(0) })];
    expect(assessPlanStaleness({ planGeneratedAt: ago(20), metrics: m, now: NOW }).stale).toBe(false);
  });
});

describe('evaluatePhaseAdvance', () => {
  const planAt = ago(20);
  const snapshot = buildWeakSkillsSnapshot([
    row('ns.grammar.modal_might', 30, 4, 25),
    row('ns.grammar.articles', 35, 4, 25),
    row('ns.grammar.tenses', 40, 4, 25),
  ], NOW - 20 * 86400000);
  const fresh = (name: string, m: number, ev = 4, age = 2) => row(name, m, ev, age);
  it('proposes when most snapshot skills recovered with fresh evidence', () => {
    const d = evaluatePhaseAdvance({ phaseStatus: 'in_progress', planGeneratedAt: planAt, snapshot, now: NOW,
      metrics: [fresh('ns.grammar.modal_might', 80), fresh('ns.grammar.articles', 78), fresh('ns.grammar.tenses', 80)] });
    expect(d.propose).toBe(true);
    expect(d.recovered).toHaveLength(3);
  });
  it('does not propose on thin evidence, old events or low mastery', () => {
    const d = evaluatePhaseAdvance({ phaseStatus: 'in_progress', planGeneratedAt: planAt, snapshot, now: NOW,
      metrics: [fresh('ns.grammar.modal_might', 90, 1), fresh('ns.grammar.articles', 90, 4, 40), fresh('ns.grammar.tenses', 50)] });
    expect(d.propose).toBe(false);
    expect(d.pending).toHaveLength(3);
  });
  it('needs at least two recovered skills and ignores phases not in progress', () => {
    const one = buildWeakSkillsSnapshot([row('ns.grammar.modal_might', 30, 4, 25)], NOW - 20 * 86400000);
    expect(evaluatePhaseAdvance({ phaseStatus: 'in_progress', planGeneratedAt: planAt, snapshot: one, now: NOW, metrics: [fresh('ns.grammar.modal_might', 90)] }).propose).toBe(false);
    expect(evaluatePhaseAdvance({ phaseStatus: 'planned', planGeneratedAt: planAt, snapshot, now: NOW, metrics: [] }).propose).toBe(false);
    expect(evaluatePhaseAdvance({ phaseStatus: 'in_progress', planGeneratedAt: planAt, snapshot: null, now: NOW, metrics: [] }).reason).toMatch(/no weak-skill snapshot/);
  });
});
