/**
 * v6.9.65 — Single source of truth for worksheet generation progress %.
 * Both GeneratingModal (foreground) and ActiveGenerationMiniPanel
 * (background) must call this so their bars never disagree.
 *
 * Algorithm priority:
 *  1. SSE-supplied `progress.percent` (set explicitly by the edge
 *     function during repairing/saving phases) wins.
 *  2. During `media` phase: ramp 3 → 18% over the first quarter of the
 *     estimated duration.
 *  3. During exercise streaming: 18% floor + linear by exercise count
 *     up to 91%, plus tiny per-second drift between exercises so the
 *     bar visibly moves.
 *  4. Bootstrap (no progress yet): 0.8% per second up to 18%.
 */
import type { WorksheetGenerationJob } from './generationJobRegistry';

export function estimateDurationSec(meta?: WorksheetGenerationJob['formMeta'] | null): number {
  let s = 50;
  if (meta?.requiresImage) s += 25;
  if (meta?.requiresAudio) s += 25;
  if (meta?.hasGrammar) s += 8;
  s += Math.max(0, (meta?.selectedExercises?.length || 6) - 6) * 4;
  return s;
}

export interface ProgressJobShape {
  progress?: WorksheetGenerationJob['progress'] | null;
  formMeta?: WorksheetGenerationJob['formMeta'] | null;
}

export function computeGenerationProgress(
  job: ProgressJobShape,
  elapsedSec: number,
): number {
  const p = job.progress ?? null;

  if (p && typeof (p as any).percent === 'number') {
    return Math.max(0, Math.min(99, Math.round((p as any).percent)));
  }

  const dur = estimateDurationSec(job.formMeta);

  if (p && (p as any).phase === 'media') {
    return Math.min(
      18,
      Math.max(3, Math.round((elapsedSec / Math.max(20, dur * 0.25)) * 18)),
    );
  }

  if (p && (p as any).expectedTotal > 0) {
    const completed = Math.max(0, (p as any).exercisesGenerated || 0);
    const expected = (p as any).expectedTotal;
    const perExercise = 74 / expected;
    const floor = 18 + completed * perExercise;
    const liveDrift = Math.min(perExercise * 0.85, Math.max(0, elapsedSec - 20) * 0.35);
    return Math.min(91, Math.round(floor + liveDrift));
  }

  return Math.min(18, Math.max(2, Math.round(elapsedSec * 0.8)));
}