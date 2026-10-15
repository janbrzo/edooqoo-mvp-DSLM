/**
 * forgetting: the single read-time "forgetting" curve for DSLM skill mastery
 * (iteration 7, decision D9). Pure TypeScript, no Deno APIs: imported by Edge
 * Functions, the client and vitest.
 *
 * `student_skill_metrics.current_mastery` is a time-weighted average of the
 * events, so a skill with a single event keeps that event's value forever.
 * Effective mastery is derived at READ time from `last_event_at` and is never
 * written back, so the stored value stays the audit trail and the change is
 * reversible.
 *
 *   factor(d) = 1                                              for d <= GRACE_DAYS
 *   factor(d) = FLOOR + (1 - FLOOR) * 0.5 ^ ((d - GRACE) / HALF_LIFE)   otherwise
 *
 * Memory fades, the skill does not vanish: the factor never drops below FLOOR.
 */

export const FORGETTING_GRACE_DAYS = 14;
export const FORGETTING_HALF_LIFE_DAYS = 60;
export const FORGETTING_FLOOR = 0.5;

const DAY_MS = 86400000;

export function forgettingFactor(daysSinceLastEvent: number): number {
  if (!Number.isFinite(daysSinceLastEvent) || daysSinceLastEvent <= FORGETTING_GRACE_DAYS) return 1;
  const decay = Math.pow(0.5, (daysSinceLastEvent - FORGETTING_GRACE_DAYS) / FORGETTING_HALF_LIFE_DAYS);
  return FORGETTING_FLOOR + (1 - FORGETTING_FLOOR) * decay;
}

/**
 * Mastery (0-100) after forgetting. Returns the stored value unchanged when it
 * is not a finite number or when `lastEventAt` is missing/unparseable (no
 * evidence of age means no decay), and never goes below 0 or above the stored value.
 */
export function effectiveMastery(
  currentMastery: number | string | null | undefined,
  lastEventAt: string | Date | null | undefined,
  now: Date | number = Date.now(),
): number {
  const stored = Number(currentMastery);
  if (!Number.isFinite(stored)) return 0;
  if (!lastEventAt) return stored;
  const last = lastEventAt instanceof Date ? lastEventAt.getTime() : new Date(lastEventAt).getTime();
  if (!Number.isFinite(last)) return stored;
  const nowMs = now instanceof Date ? now.getTime() : now;
  const days = (nowMs - last) / DAY_MS;
  const value = stored * forgettingFactor(days);
  return Math.max(0, Math.min(stored, Math.round(value * 10) / 10));
}

export interface MasteryRow {
  current_mastery?: number | string | null;
  last_event_at?: string | null;
}

/**
 * Readers apply forgetting to whole result sets with this helper: `current_mastery`
 * becomes the effective value and the stored one is kept as `raw_mastery`.
 */
export function withEffectiveMastery<T extends MasteryRow>(
  rows: ReadonlyArray<T>,
  now: Date | number = Date.now(),
): Array<Omit<T, 'current_mastery'> & { current_mastery: number; raw_mastery: number }> {
  return (rows || []).map((row) => {
    const raw = Number(row.current_mastery);
    return {
      ...row,
      raw_mastery: Number.isFinite(raw) ? raw : 0,
      current_mastery: effectiveMastery(row.current_mastery, row.last_event_at, now),
    };
  });
}
