/**
 * v6.9.13: Server-side safety net.
 * Forces sum of phase weeks to fit within targetWeeks. Idempotent.
 * Rules:
 *   - Phases keep their order.
 *   - Each phase has minWeeks=2 (or floor(targetWeeks/phaseCount) if smaller).
 *   - Remaining weeks distributed proportionally to AI's original durations.
 *   - Output: contiguous integer ranges starting at week 1, no gaps, no overlaps.
 */
export function fitPhasesToDeadline(
  phases: any[],
  targetWeeks: number | null,
  startingWeek: number = 1,
): { phases: any[]; adjusted: boolean } {
  if (!targetWeeks || !Array.isArray(phases) || phases.length === 0) {
    return { phases, adjusted: false };
  }
  const n = phases.length;
  const minWeeks = Math.max(1, Math.min(2, Math.floor(targetWeeks / n) || 1));
  if (minWeeks * n > targetWeeks) {
    // Cannot honor min, distribute as evenly as possible (every phase = 1 week up to budget)
    let cursor = Math.max(1, startingWeek);
    const lastWeek = cursor + targetWeeks - 1;
    const out = phases.map((p, i) => {
      const end = i === n - 1 ? lastWeek : Math.min(lastWeek, cursor);
      const fixed = { ...p, estimated_weeks_start: cursor, estimated_weeks_end: end };
      cursor = end + 1;
      return fixed;
    });
    return { phases: out, adjusted: true };
  }

  // 1. Read AI durations (fallback = 4)
  const aiDur = phases.map((p) => {
    const s = Number.isInteger(p.estimated_weeks_start) ? p.estimated_weeks_start : null;
    const e = Number.isInteger(p.estimated_weeks_end) ? p.estimated_weeks_end : null;
    return s !== null && e !== null && e >= s ? (e - s + 1) : 4;
  });
  const aiSum = aiDur.reduce((a, b) => a + b, 0);

  let durations: number[];
  if (aiSum <= targetWeeks) {
    // AI already fits, keep as-is, just renormalize to contiguous ranges from week 1.
    durations = aiDur.map((d) => Math.max(minWeeks, d));
    const sum0 = durations.reduce((a, b) => a + b, 0);
    if (sum0 > targetWeeks) {
      // bumping to minWeeks pushed past budget, fall through to scaling
      durations = aiDur;
    } else {
      // Distribute leftover slack to last phase
      const leftover = targetWeeks - sum0;
      durations[durations.length - 1] += leftover;
      return { phases: rebaseFromWeek(phases, durations, startingWeek), adjusted: aiSum !== targetWeeks };
    }
  }

  // 2. Scale proportionally so sum == targetWeeks, respecting minWeeks
  const scalable = targetWeeks - minWeeks * n;
  const aiScalable = Math.max(1, aiSum - minWeeks * n);
  durations = aiDur.map((d) => {
    const extra = Math.max(0, d - minWeeks);
    return minWeeks + Math.floor((extra * scalable) / aiScalable);
  });
  // Fix rounding drift, push to last phase
  let drift = targetWeeks - durations.reduce((a, b) => a + b, 0);
  durations[durations.length - 1] += drift;
  // Guard against negatives from drift
  if (durations[durations.length - 1] < minWeeks) {
    durations[durations.length - 1] = minWeeks;
    // re-normalize: scale down longest until sum matches
    while (durations.reduce((a, b) => a + b, 0) > targetWeeks) {
      const maxIdx = durations.indexOf(Math.max(...durations));
      if (durations[maxIdx] <= minWeeks) break;
      durations[maxIdx] -= 1;
    }
  }

  return { phases: rebaseFromWeek(phases, durations, startingWeek), adjusted: true };
}

export function rebaseFromWeek(phases: any[], durations: number[], startingWeek: number): any[] {
  let cursor = Math.max(1, Number.isInteger(startingWeek) ? startingWeek : 1);
  return phases.map((p, i) => {
    const start = cursor;
    const end = cursor + durations[i] - 1;
    cursor = end + 1;
    return { ...p, estimated_weeks_start: start, estimated_weeks_end: end };
  });
}
