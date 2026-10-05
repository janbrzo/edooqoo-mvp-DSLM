/**
 * learningPlan — the single ordering rule for "what is taught next".
 *
 * Both the Prep tab (`selectPrepSuggestion`) and the Learning plan tab
 * (Up next) read the queue from `orderUpNext`, so the teacher never sees two
 * different "next lessons" for the same student.
 *
 * Order (identical to the pre-2026-10 PathwayView rule):
 *  1. steps of the in-progress phase,
 *  2. steps of the other phases, by phase `sequence_number`,
 *  3. steps whose phase is unknown,
 *  4. free-floating next steps (no phase).
 * Inside a phase, steps follow their own `sequence_number` — it restarts at 1
 * in every phase, so it must never be compared across phases. `id` breaks ties.
 *
 * No React, no Supabase, no globals — every rule here is unit-testable.
 */

export interface PlanPhaseLite {
  id: string;
  sequence_number: number;
  status: string;
  title: string;
}

export interface PlanSuggestionLite {
  id: string;
  sequence_number: number;
  suggested_topic?: string | null;
  phase_id?: string | null;
  is_used?: boolean | null;
  deleted_at?: string | null;
}

export interface UpNextItem<T extends PlanSuggestionLite> {
  suggestion: T;
  /** 1-based position inside its own scope (phase or free steps). */
  displayIndex: number;
  phaseId: string | null;
  /** `Phase 2` — null for free steps or unknown phases. */
  phaseLabel: string | null;
  phaseTitle: string | null;
  isCurrentPhase: boolean;
}

export interface OrderUpNextInput<T extends PlanSuggestionLite> {
  phases?: readonly PlanPhaseLite[] | null;
  phaseSteps?: readonly T[] | null;
  nextSteps?: readonly T[] | null;
}

const UNKNOWN_PHASE_ORDER = Number.MAX_SAFE_INTEGER;

function seq(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : Number.MAX_SAFE_INTEGER;
}

function bySequenceThenId(a: PlanSuggestionLite, b: PlanSuggestionLite): number {
  const diff = seq(a.sequence_number) - seq(b.sequence_number);
  if (diff !== 0) return diff;
  return String(a.id).localeCompare(String(b.id));
}

function isActive(row: PlanSuggestionLite): boolean {
  return !row.is_used && !row.deleted_at;
}

function hasTopic(row: PlanSuggestionLite): boolean {
  return (row.suggested_topic ?? '').trim().length > 0;
}

/** Phases sorted by their own sequence number. */
export function sortPhases<P extends PlanPhaseLite>(phases: readonly P[] | null | undefined): P[] {
  return [...(phases ?? [])].sort((a, b) => {
    const diff = seq(a.sequence_number) - seq(b.sequence_number);
    return diff !== 0 ? diff : String(a.id).localeCompare(String(b.id));
  });
}

/** The phase the student is in now: the first `in_progress` phase in sequence order. */
export function findCurrentPhase<P extends PlanPhaseLite>(
  phases: readonly P[] | null | undefined,
): P | null {
  return sortPhases(phases).find((phase) => phase.status === 'in_progress') ?? null;
}

/**
 * Ordered "Up next" queue. Used and soft-deleted rows are dropped; rows
 * without a topic cannot be taught, so they move to the end of the queue
 * (they stay visible for editing but never become #1).
 */
export function orderUpNext<T extends PlanSuggestionLite>(
  input: OrderUpNextInput<T>,
): UpNextItem<T>[] {
  const phases = sortPhases(input.phases);
  const current = findCurrentPhase(phases);
  const phaseById = new Map(phases.map((phase) => [phase.id, phase]));

  const phaseRows = (input.phaseSteps ?? []).filter(isActive);
  const freeRows = (input.nextSteps ?? []).filter(isActive);

  // Display index is local to each phase (and to the free-step scope).
  const displayIndex = new Map<string, number>();
  const byScope = new Map<string, T[]>();
  for (const row of phaseRows) {
    const key = row.phase_id ?? '__unknown__';
    const list = byScope.get(key) ?? [];
    list.push(row);
    byScope.set(key, list);
  }
  for (const list of byScope.values()) {
    [...list].sort(bySequenceThenId).forEach((row, index) => displayIndex.set(row.id, index + 1));
  }
  [...freeRows].sort(bySequenceThenId).forEach((row, index) => displayIndex.set(row.id, index + 1));

  const phaseRank = (row: T): number => {
    const phase = row.phase_id ? phaseById.get(row.phase_id) : undefined;
    return phase ? seq(phase.sequence_number) : UNKNOWN_PHASE_ORDER;
  };
  const isCurrent = (row: T): boolean => !!current && row.phase_id === current.id;

  const orderedPhaseRows = [...phaseRows].sort((a, b) => {
    const currentDiff = Number(isCurrent(b)) - Number(isCurrent(a));
    if (currentDiff !== 0) return currentDiff;
    const rankDiff = phaseRank(a) - phaseRank(b);
    if (rankDiff !== 0) return rankDiff;
    return bySequenceThenId(a, b);
  });
  const orderedFreeRows = [...freeRows].sort(bySequenceThenId);

  const all = [...orderedPhaseRows, ...orderedFreeRows];
  const usable = all.filter(hasTopic);
  const unusable = all.filter((row) => !hasTopic(row));

  return [...usable, ...unusable].map((row) => {
    const phase = row.phase_id ? phaseById.get(row.phase_id) ?? null : null;
    return {
      suggestion: row,
      displayIndex: displayIndex.get(row.id) ?? 0,
      phaseId: row.phase_id ?? null,
      phaseLabel: phase ? `Phase ${phase.sequence_number}` : null,
      phaseTitle: phase ? phase.title : null,
      isCurrentPhase: isCurrent(row),
    };
  });
}

/** `Phase 2: Meetings language` — or null for free steps. */
export function formatPhaseCaption(item: Pick<UpNextItem<PlanSuggestionLite>, 'phaseLabel' | 'phaseTitle'>): string | null {
  if (!item.phaseLabel) return null;
  return item.phaseTitle ? `${item.phaseLabel}: ${item.phaseTitle}` : item.phaseLabel;
}
