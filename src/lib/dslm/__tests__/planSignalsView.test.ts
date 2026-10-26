import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildWeakSkillsSnapshot } from '../../../../supabase/functions/_shared/planSignals';
import {
  computeStalePlanNotice,
  decidePhaseAdvanceProposal,
  findNextPlannedPhase,
  newestPlanOrigin,
} from '../planSignalsView';

const NOW = new Date('2026-10-26T12:00:00Z').getTime();
const ago = (d: number) => new Date(NOW - d * 86400000).toISOString();
const row = (name: string, mastery: number, events: number, ageDays: number, extra: any = {}) => ({
  skill_name: name, skill_category: 'grammar', micro_skill: name, current_mastery: mastery,
  total_events: events, trend: 'stable', last_event_at: ago(ageDays), ...extra,
});
const phase = (id: string, seq: number, status: string, createdDays: number, ctx: any = {}) => ({
  id, sequence_number: seq, status, created_at: ago(createdDays), generation_context: ctx,
});

describe('computeStalePlanNotice', () => {
  const metrics = [row('ns.grammar.modal_might', 30, 4, 2), row('ns.grammar.articles', 90, 5, 3)];
  it('shows one line with the count when newer evidence meets an old plan', () => {
    const n = computeStalePlanNotice({ phases: [phase('p1', 1, 'in_progress', 21)], metrics, now: NOW });
    expect(n?.count).toBe(2);
    expect(n?.text).toBe('2 skills practised since the plan was generated: refresh');
  });
  it('singular wording', () => {
    const n = computeStalePlanNotice({ phases: [phase('p1', 1, 'in_progress', 21)], metrics: [metrics[0]], now: NOW });
    expect(n?.text).toBe('1 skill practised since the plan was generated: refresh');
  });
  it('uses the newest generation, preferring generated_at from the context', () => {
    const phases = [phase('old', 1, 'done', 60), phase('new', 2, 'planned', 1, { generated_at: ago(30) })];
    expect(newestPlanOrigin(phases).generatedAt).toBe(ago(30));
  });
  it('is silent without a snapshot and without newer evidence', () => {
    const old = [row('ns.grammar.modal_might', 30, 4, 40)];
    expect(computeStalePlanNotice({ phases: [phase('p1', 1, 'in_progress', 21)], metrics: old, now: NOW })).toBeNull();
  });
  it('is silent for a young plan with an unchanged weak list, and without phases', () => {
    const snapshot = buildWeakSkillsSnapshot(metrics, NOW - 86400000);
    const ph = [phase('p1', 1, 'in_progress', 3, { weak_skills_snapshot: snapshot })];
    expect(computeStalePlanNotice({ phases: ph, metrics: [row('ns.grammar.modal_might', 30, 4, 0.5), row('ns.grammar.articles', 90, 5, 0.5)], now: NOW })).toBeNull();
    expect(computeStalePlanNotice({ phases: [], metrics, now: NOW })).toBeNull();
  });
  it('is stale early when the weak list changed since the snapshot', () => {
    const snapshot = buildWeakSkillsSnapshot([row('ns.grammar.articles', 20, 4, 5)], NOW - 5 * 86400000);
    const ph = [phase('p1', 1, 'in_progress', 5, { weak_skills_snapshot: snapshot, generated_at: ago(5) })];
    const n = computeStalePlanNotice({ phases: ph, metrics: [row('ns.grammar.articles', 85, 6, 1), row('ns.grammar.modal_might', 30, 4, 1)], now: NOW });
    expect(n?.count).toBe(2);
  });
  it('ignores flashcard evidence', () => {
    const fc = [row('flashcard:x', 10, 5, 0, { micro_skill: 'flashcard' })];
    expect(computeStalePlanNotice({ phases: [phase('p1', 1, 'in_progress', 30)], metrics: fc, now: NOW })).toBeNull();
  });
});

describe('decidePhaseAdvanceProposal', () => {
  const snapshot = buildWeakSkillsSnapshot([
    row('ns.grammar.modal_might', 30, 4, 25),
    row('ns.grammar.articles', 35, 4, 25),
    row('ns.grammar.tenses', 40, 4, 25),
  ], NOW - 20 * 86400000);
  const current = phase('p1', 1, 'in_progress', 20, { weak_skills_snapshot: snapshot, generated_at: ago(20) });
  const recovered = [
    row('ns.grammar.modal_might', 85, 5, 2),
    row('ns.grammar.articles', 80, 5, 3),
    row('ns.grammar.tenses', 78, 4, 4),
  ];
  const none = new Set<string>();

  it('creates a proposal when evidence supports it and none exists', () => {
    const d = decidePhaseAdvanceProposal({ currentPhase: current, metrics: recovered, metricsLoaded: true, proposalPhaseIds: none, now: NOW });
    expect(d.create).toBe(true);
    expect(d.evidence?.recovered).toHaveLength(3);
  });
  it('does not create while metrics are loading', () => {
    expect(decidePhaseAdvanceProposal({ currentPhase: current, metrics: [], metricsLoaded: false, proposalPhaseIds: none, now: NOW }).create).toBe(false);
  });
  it('does not create twice for a phase (pending or already decided)', () => {
    const d = decidePhaseAdvanceProposal({ currentPhase: current, metrics: recovered, metricsLoaded: true, proposalPhaseIds: new Set(['p1']), now: NOW });
    expect(d.create).toBe(false);
  });
  it('does not create without recovery, without a snapshot or without an in-progress phase', () => {
    const weakStill = recovered.map((r) => ({ ...r, current_mastery: 40 }));
    expect(decidePhaseAdvanceProposal({ currentPhase: current, metrics: weakStill, metricsLoaded: true, proposalPhaseIds: none, now: NOW }).create).toBe(false);
    expect(decidePhaseAdvanceProposal({ currentPhase: phase('p2', 2, 'in_progress', 20), metrics: recovered, metricsLoaded: true, proposalPhaseIds: none, now: NOW }).create).toBe(false);
    expect(decidePhaseAdvanceProposal({ currentPhase: null, metrics: recovered, metricsLoaded: true, proposalPhaseIds: none, now: NOW }).create).toBe(false);
    expect(decidePhaseAdvanceProposal({ currentPhase: { ...current, status: 'planned' }, metrics: recovered, metricsLoaded: true, proposalPhaseIds: none, now: NOW }).create).toBe(false);
  });
  it('counts evidence only after the phase became active (the snapshot is shared by the roadmap run)', () => {
    const justStarted = { ...current, updated_at: ago(1) };
    const d = decidePhaseAdvanceProposal({ currentPhase: justStarted, metrics: recovered, metricsLoaded: true, proposalPhaseIds: none, now: NOW });
    expect(d.create).toBe(false);
    const longActive = { ...current, updated_at: ago(10) };
    expect(decidePhaseAdvanceProposal({ currentPhase: longActive, metrics: recovered, metricsLoaded: true, proposalPhaseIds: none, now: NOW }).create).toBe(true);
  });
  it('finds the next planned phase by sequence', () => {
    const phases = [current, phase('p3', 3, 'planned', 20), phase('p2', 2, 'planned', 20), phase('p0', 0, 'planned', 20)];
    expect(findNextPlannedPhase(phases, current)?.id).toBe('p2');
    expect(findNextPlannedPhase([current], current)).toBeNull();
  });
});

describe('phase_advance_proposals migration', () => {
  const sql = readFileSync(resolve(__dirname, '../../../../supabase/migrations/20261026090000_phase_advance_proposals.sql'), 'utf8');
  it('is idempotent, guards duplicates and has RLS', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.phase_advance_proposals/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS[\s\S]*\(phase_id\)\s*WHERE status = 'pending'/);
    expect(sql).toMatch(/CHECK \(status IN \('pending', 'accepted', 'dismissed', 'superseded'\)\)/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/auth\.uid\(\) = teacher_id/);
  });
  it('ties a proposal to a phase of the same teacher and student, and revokes default grants', () => {
    expect(sql).toMatch(/ph\.teacher_id = auth\.uid\(\)/);
    expect(sql).toMatch(/ph\.student_id = phase_advance_proposals\.student_id/);
    expect(sql).toMatch(/REVOKE ALL ON public\.phase_advance_proposals FROM PUBLIC, anon, authenticated/);
  });
  it('has no destructive keywords and no apostrophes in comments', () => {
    expect(sql).not.toMatch(/\b(drop|delete)\b/i);
    for (const line of sql.split('\n')) if (line.trim().startsWith('--')) expect(line).not.toContain("'");
  });
});
