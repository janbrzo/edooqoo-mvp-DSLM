/**
 * planSignalsView: client-side decisions for the adaptive loop (audit 9.6, D14).
 *
 *  - computeStalePlanNotice: the one-line reminder "N skills practised since the plan
 *    was generated: refresh". A reminder only: nothing is regenerated automatically.
 *  - decidePhaseAdvanceProposal: should a phase advance proposal be created now?
 *    Proposals are never applied automatically; the teacher accepts or dismisses.
 *
 * Pure: no React, no Supabase. Metrics must already be passed through
 * `withEffectiveMastery`; freshness is read from `last_event_at`, never `updated_at`.
 */
import {
  assessPlanStaleness,
  evaluatePhaseAdvance,
  type PhaseAdvanceDecision,
  type PlanStaleness,
  type WeakSkillsSnapshot,
} from '../../../supabase/functions/_shared/planSignals';

export interface PlanPhaseSignals {
  id: string;
  sequence_number: number;
  status: string;
  created_at?: string | null;
  /** Changes when the phase status changes: used as the moment an in-progress phase started. */
  updated_at?: string | null;
  generation_context?: any;
}

export interface PlanOrigin {
  generatedAt: string | null;
  snapshot: WeakSkillsSnapshot | null;
}

function validSnapshot(value: any): WeakSkillsSnapshot | null {
  return value && typeof value === 'object' && Array.isArray(value.skills) ? (value as WeakSkillsSnapshot) : null;
}

/** When a phase plan was generated and the weak skills it was generated from. */
export function planOriginOfPhase(phase: PlanPhaseSignals | null | undefined): PlanOrigin {
  if (!phase) return { generatedAt: null, snapshot: null };
  const ctx = phase.generation_context && typeof phase.generation_context === 'object' ? phase.generation_context : {};
  const snapshot = validSnapshot(ctx.weak_skills_snapshot);
  const generatedAt = ctx.generated_at || snapshot?.taken_at || phase.created_at || null;
  return { generatedAt: generatedAt ? String(generatedAt) : null, snapshot };
}

/** The newest generation of the roadmap: the phase created last decides. */
export function newestPlanOrigin(phases: readonly PlanPhaseSignals[] | null | undefined): PlanOrigin {
  let best: PlanPhaseSignals | null = null;
  let bestMs = -Infinity;
  for (const p of phases ?? []) {
    const t = p.created_at ? new Date(p.created_at).getTime() : NaN;
    const ms = Number.isFinite(t) ? t : -Infinity;
    if (best === null || ms > bestMs) { best = p; bestMs = ms; }
  }
  return planOriginOfPhase(best);
}

export interface StalePlanNotice {
  count: number;
  text: string;
  staleness: PlanStaleness;
}

/** One reminder line, or null when the plan is not stale (no plan, no newer evidence, too fresh). */
export function computeStalePlanNotice(input: {
  phases: readonly PlanPhaseSignals[] | null | undefined;
  metrics: any[] | null | undefined;
  now?: number;
}): StalePlanNotice | null {
  if (!input.phases || input.phases.length === 0) return null;
  const origin = newestPlanOrigin(input.phases);
  if (!origin.generatedAt) return null;
  const staleness = assessPlanStaleness({
    planGeneratedAt: origin.generatedAt,
    snapshot: origin.snapshot,
    metrics: input.metrics ?? [],
    now: input.now,
  });
  if (!staleness.stale || staleness.skillsWithNewEvidence <= 0) return null;
  const n = staleness.skillsWithNewEvidence;
  return { count: n, text: `${n} skill${n === 1 ? '' : 's'} practised since the plan was generated: refresh`, staleness };
}

/** The first planned phase after the current one (by sequence number). */
export function findNextPlannedPhase<P extends PlanPhaseSignals>(
  phases: readonly P[] | null | undefined,
  current: P | null | undefined,
): P | null {
  if (!current) return null;
  const sorted = [...(phases ?? [])].sort((a, b) => a.sequence_number - b.sequence_number);
  return sorted.find((p) => p.sequence_number > current.sequence_number && p.status === 'planned') ?? null;
}

export interface PhaseAdvanceEvidence {
  reason: string;
  recovered: string[];
  pending: string[];
  plan_generated_at: string | null;
  evidence_from?: string | null;
}

export interface PhaseAdvanceCreateDecision {
  create: boolean;
  why: string;
  decision: PhaseAdvanceDecision | null;
  evidence: PhaseAdvanceEvidence | null;
}

/**
 * Create a proposal only when: the metrics are loaded, the phase is in progress, the
 * evidence supports advancing, and the student has no proposal for this phase yet
 * (a pending one is shown, a decided one is not asked again).
 */
export function decidePhaseAdvanceProposal(input: {
  currentPhase: PlanPhaseSignals | null | undefined;
  metrics: any[] | null | undefined;
  metricsLoaded: boolean;
  proposalPhaseIds: ReadonlySet<string>;
  now?: number;
}): PhaseAdvanceCreateDecision {
  const no = (why: string, decision: PhaseAdvanceDecision | null = null): PhaseAdvanceCreateDecision =>
    ({ create: false, why, decision, evidence: null });
  const phase = input.currentPhase;
  if (!phase) return no('no phase in progress');
  if (!input.metricsLoaded) return no('metrics not loaded');
  if (input.proposalPhaseIds.has(phase.id)) return no('a proposal for this phase already exists');
  const origin = planOriginOfPhase(phase);
  // The snapshot and plan date are shared by every phase of one roadmap run. Evidence counts only
  // after this phase became active (its last update), so accepting phase 1 does not make phase 2
  // look finished at once.
  const originMs = origin.generatedAt ? new Date(origin.generatedAt).getTime() : NaN;
  const startedMs = phase.updated_at ? new Date(phase.updated_at).getTime() : NaN;
  const evidenceFrom = Number.isFinite(startedMs) && (!Number.isFinite(originMs) || startedMs > originMs)
    ? new Date(startedMs).toISOString()
    : origin.generatedAt;
  const decision = evaluatePhaseAdvance({
    phaseStatus: phase.status,
    planGeneratedAt: evidenceFrom,
    snapshot: origin.snapshot,
    metrics: input.metrics ?? [],
    now: input.now,
  });
  if (!decision.propose) return no(decision.reason, decision);
  return {
    create: true,
    why: decision.reason,
    decision,
    evidence: {
      reason: decision.reason,
      recovered: decision.recovered,
      pending: decision.pending,
      plan_generated_at: origin.generatedAt,
      evidence_from: evidenceFrom,
    },
  };
}
