/**
 * Pure helpers for the "Pacing set from the Welcome Test" info card.
 *
 * recalculate-pacing applies the pacing of the FIRST Welcome Test automatically and
 * records it as an accepted proposal with trigger_details.reason
 * 'welcome_test_initial_auto' (previous values kept so the teacher can undo).
 */

export const WT_INITIAL_AUTO_REASON = 'welcome_test_initial_auto';
export const AUTO_APPLIED_CARD_MAX_AGE_DAYS = 30;

export interface PacingChangeRow {
  id: string;
  status: string;
  trigger_type: string;
  trigger_details: unknown;
  current_pacing: number;
  proposed_pacing: number;
  created_at: string;
  decided_at?: string | null;
}

export interface AutoAppliedWtPacing {
  proposalId: string;
  newPacing: number;
  previousPacing: number;
  previousLastPacingSetManually: boolean | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const APPLIED_STATUSES = new Set(['accepted', 'applied']);
const DAY_MS = 24 * 60 * 60 * 1000;

const changeTime = (r: PacingChangeRow): number => Date.parse(r.decided_at || r.created_at);

/**
 * The auto-applied Welcome Test change to show, or null. It is shown only when it is
 * the most recent applied pacing change (a later accepted proposal replaces it), is
 * younger than 30 days, still carries the previous value, and the student's current
 * pacing is still the one it set (a manual change since then hides it).
 */
export function selectAutoAppliedWtPacing(
  rows: ReadonlyArray<PacingChangeRow>,
  currentPacing: number | null | undefined,
  now: Date = new Date(),
): AutoAppliedWtPacing | null {
  const applied = rows
    .filter((r) => APPLIED_STATUSES.has(r.status) && Number.isFinite(changeTime(r)))
    .sort((a, b) => changeTime(b) - changeTime(a));
  const latest = applied[0];
  if (!latest) return null;
  const details = isRecord(latest.trigger_details) ? latest.trigger_details : null;
  if (!details || details.reason !== WT_INITIAL_AUTO_REASON) return null;
  if (latest.trigger_type !== 'placement_test') return null;
  if (now.getTime() - changeTime(latest) >= AUTO_APPLIED_CARD_MAX_AGE_DAYS * DAY_MS) return null;
  const prev = details.previous_pacing;
  const previousPacing = typeof prev === 'number' && Number.isFinite(prev) ? prev : latest.current_pacing;
  if (typeof previousPacing !== 'number') return null;
  if (typeof currentPacing === 'number' && currentPacing !== latest.proposed_pacing) return null;
  const flag = details.previous_last_pacing_set_manually;
  return {
    proposalId: latest.id,
    newPacing: latest.proposed_pacing,
    previousPacing,
    previousLastPacingSetManually: typeof flag === 'boolean' ? flag : null,
  };
}
