/**
 * planSignals: pure helpers for the adaptive loop (audit 9.6, decision D14).
 *
 *  - buildWeakSkillsSnapshot: the weak skills a plan was generated from, stored in
 *    `generation_context.weak_skills_snapshot`, so it can later be checked whether
 *    a lesson or phase helped.
 *  - assessPlanStaleness: is the plan older than the newest evidence? A reminder
 *    for the teacher only; nothing is regenerated automatically.
 *  - evaluatePhaseAdvance: do the current phase's weak skills show recovery? The
 *    result is a PROPOSAL input; a phase never advances by itself.
 * No Deno APIs, no I/O.
 */
import { groupSkillMetrics, WEAK_MASTERY_THRESHOLD, AUTHORITATIVE_MIN_EVENTS, type EvidenceTier } from './dslmPromptCore.ts';
import { isFlashcardSkill } from './skillLabels.ts';

const DAY_MS = 86400000;

export interface WeakSkillSnapshotEntry {
  label: string;
  mastery: number;
  events: number;
  tier: EvidenceTier;
}

export interface WeakSkillsSnapshot {
  version: 1;
  taken_at: string;
  skills: WeakSkillSnapshotEntry[];
}

/** Weak skills (effective mastery under the weak threshold, flashcards excluded) as used for a plan. */
export function buildWeakSkillsSnapshot(metrics: any[], now: number = Date.now(), limit = 12): WeakSkillsSnapshot {
  const { weak } = groupSkillMetrics(metrics, now);
  return {
    version: 1,
    taken_at: new Date(now).toISOString(),
    skills: weak.slice(0, limit).map((g) => ({ label: g.label, mastery: g.mastery, events: g.events, tier: g.tier })),
  };
}

/** A plan older than this with any newer evidence is stale even when the weak list is unchanged. */
export const STALE_PLAN_MIN_AGE_DAYS = 14;

export interface PlanStaleness {
  stale: boolean;
  planAgeDays: number | null;
  /** Newest `last_event_at` over non-flashcard skills. */
  newestEventAt: string | null;
  /** Skills practised after the plan was generated. */
  skillsWithNewEvidence: number;
  /** Weak skill labels that were not in the plan snapshot / that left the weak list. Null when the plan has no snapshot. */
  weakAdded: string[] | null;
  weakResolved: string[] | null;
  reasons: string[];
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Stale when evidence newer than the plan exists AND either the weak-skill list
 * changed since the plan snapshot or the plan is at least STALE_PLAN_MIN_AGE_DAYS old.
 * `metrics` must be the rows passed through `withEffectiveMastery`.
 */
export function assessPlanStaleness(input: {
  planGeneratedAt: string | null | undefined;
  snapshot?: WeakSkillsSnapshot | null;
  metrics: any[];
  now?: number;
}): PlanStaleness {
  const now = input.now ?? Date.now();
  const planMs = ms(input.planGeneratedAt);
  const rows = (input.metrics || []).filter((m) => m && !isFlashcardSkill(m));
  const times = rows.map((m) => ms(m.last_event_at)).filter((t): t is number => t !== null);
  const newest = times.length ? Math.max(...times) : null;
  const newestEventAt = newest === null ? null : new Date(newest).toISOString();
  const skillsWithNewEvidence = planMs === null ? 0 : times.filter((t) => t > planMs).length;
  const planAgeDays = planMs === null ? null : Math.max(0, Math.floor((now - planMs) / DAY_MS));

  let weakAdded: string[] | null = null;
  let weakResolved: string[] | null = null;
  if (input.snapshot && Array.isArray(input.snapshot.skills)) {
    const before = new Set(input.snapshot.skills.map((s) => s.label));
    const current = new Set(groupSkillMetrics(rows, now).weak.map((g) => g.label));
    weakAdded = [...current].filter((l) => !before.has(l));
    weakResolved = [...before].filter((l) => !current.has(l));
  }

  const reasons: string[] = [];
  const hasNewer = planMs !== null && newest !== null && newest > planMs;
  const weakChanged = !!((weakAdded && weakAdded.length) || (weakResolved && weakResolved.length));
  if (hasNewer) reasons.push(`${skillsWithNewEvidence} skill${skillsWithNewEvidence === 1 ? '' : 's'} practised since the plan was generated`);
  if (hasNewer && weakChanged) reasons.push('the weak skills changed since the plan was generated');
  const oldEnough = planAgeDays !== null && planAgeDays >= STALE_PLAN_MIN_AGE_DAYS;
  if (hasNewer && oldEnough) reasons.push(`the plan is ${planAgeDays} days old`);
  const stale = hasNewer && (weakChanged || oldEnough);
  return { stale, planAgeDays, newestEventAt, skillsWithNewEvidence, weakAdded, weakResolved, reasons: stale ? reasons : [] };
}

/** A snapshot skill counts as recovered at or above this effective mastery. */
export const PHASE_RECOVERED_MASTERY = 75;
/** Share of the phase's snapshot skills that must be recovered to propose advancing. */
export const PHASE_ADVANCE_MIN_SHARE = 0.7;
/** At least this many recovered skills (a one-skill phase is too thin to propose on). */
export const PHASE_ADVANCE_MIN_RECOVERED = 2;

export interface PhaseAdvanceDecision {
  propose: boolean;
  recovered: string[];
  pending: string[];
  /** Snapshot skills with no current evidence row at all. */
  missingEvidence: string[];
  reason: string;
}

/**
 * Evidence says the phase's goals are met when most skills that were weak when the
 * phase plan was made now have FRESH evidence gathered after the plan: at least
 * AUTHORITATIVE_MIN_EVENTS events, last event after the plan, effective mastery
 * >= PHASE_RECOVERED_MASTERY. Returns a proposal decision only; the teacher approves.
 */
export function evaluatePhaseAdvance(input: {
  phaseStatus: string | null | undefined;
  planGeneratedAt: string | null | undefined;
  snapshot: WeakSkillsSnapshot | null | undefined;
  metrics: any[];
  now?: number;
}): PhaseAdvanceDecision {
  const none = (reason: string): PhaseAdvanceDecision => ({ propose: false, recovered: [], pending: [], missingEvidence: [], reason });
  if (String(input.phaseStatus ?? '').toLowerCase() !== 'in_progress') return none('phase is not in progress');
  const snap = input.snapshot?.skills;
  if (!Array.isArray(snap) || snap.length === 0) return none('no weak-skill snapshot for this phase');
  const planMs = ms(input.planGeneratedAt);
  if (planMs === null) return none('plan date unknown');
  const now = input.now ?? Date.now();
  const rows = (input.metrics || []).filter((m) => m && !isFlashcardSkill(m));
  const byLabel = new Map(groupSkillMetrics(rows, now).all.map((g) => [g.label, g]));

  const recovered: string[] = [];
  const pending: string[] = [];
  const missingEvidence: string[] = [];
  for (const s of snap) {
    const g = byLabel.get(s.label);
    if (!g) { missingEvidence.push(s.label); pending.push(s.label); continue; }
    const last = ms(g.lastEventAt);
    const fresh = last !== null && last > planMs && g.events >= AUTHORITATIVE_MIN_EVENTS;
    if (fresh && g.mastery >= PHASE_RECOVERED_MASTERY) recovered.push(s.label);
    else pending.push(s.label);
  }
  const share = recovered.length / snap.length;
  const propose = recovered.length >= PHASE_ADVANCE_MIN_RECOVERED && share >= PHASE_ADVANCE_MIN_SHARE;
  return {
    propose,
    recovered,
    pending,
    missingEvidence,
    reason: propose
      ? `${recovered.length} of ${snap.length} skills that were weak (under ${WEAK_MASTERY_THRESHOLD}%) now show fresh evidence at ${PHASE_RECOVERED_MASTERY}% or more`
      : `${recovered.length} of ${snap.length} weak skills recovered, not enough to propose the next phase`,
  };
}
