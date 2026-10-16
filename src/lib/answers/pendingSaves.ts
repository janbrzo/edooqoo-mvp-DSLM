/**
 * Per-exercise debounced autosave with serialized, retried writes.
 *
 * A single shared timer used to drop the pending save of exercise A whenever the
 * student touched exercise B within the debounce window, and nothing flushed the
 * queue on submit, so answers could be lost. Each exercise now has its own timer,
 * and `flush()` runs every pending save immediately (submit, unmount).
 *
 * Writes of one exercise never overlap: while a save is in flight, a newer job
 * waits and runs right after it, so a slow older request cannot land after a newer
 * one. A job that fails (returns `false` or throws) stays queued and is retried
 * with increasing delays until it succeeds or is replaced by a newer job; `flush()`
 * reports whether everything is saved so a submit can refuse to continue on top of
 * unsaved answers.
 */
export type SaveJob = () => Promise<unknown> | unknown;

export interface SaveStatus {
  /** Exercises with changes not yet confirmed by the server (waiting, in flight or failed). */
  pending: number;
  /** Exercises whose last save attempt failed and is waiting for a retry. */
  failed: number;
}

export interface PendingSaves {
  /** (Re)schedule the save of one exercise; only that exercise's earlier timer is replaced. */
  schedule: (exerciseIndex: number, job: SaveJob, delayMs?: number) => void;
  /** Drop one exercise's pending save (the caller saves it itself). */
  cancel: (exerciseIndex: number) => void;
  /** Run every pending save now and wait for them. True when nothing is left unsaved. */
  flush: () => Promise<boolean>;
  /** Run one exercise's pending save now (blur) and wait for it. */
  flushOne: (exerciseIndex: number) => Promise<boolean>;
  /** Exercises with unsaved changes (used by the page-hide keepalive write). */
  pendingIndices: () => number[];
  size: () => number;
  /** Subscribe to status changes; returns an unsubscribe function. */
  onStatus: (listener: (status: SaveStatus) => void) => () => void;
  /** Stop all timers (unmount); pending jobs are kept for a final flush. */
  dispose: () => void;
}

const DEFAULT_RETRY_DELAYS_MS = [3000, 8000, 20000, 45000];

export const createPendingSaves = (
  delayMs = 1500,
  retryDelaysMs: number[] = DEFAULT_RETRY_DELAYS_MS,
): PendingSaves => {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  const jobs = new Map<number, SaveJob>();
  const inflight = new Map<number, Promise<boolean>>();
  const rerun = new Set<number>();
  const failures = new Map<number, number>();
  const listeners = new Set<(status: SaveStatus) => void>();

  const status = (): SaveStatus => ({
    pending: new Set([...jobs.keys(), ...inflight.keys()]).size,
    failed: [...failures.values()].filter((n) => n > 0).length,
  });
  const emit = () => {
    const s = status();
    listeners.forEach((l) => l(s));
  };

  const clearTimer = (i: number) => {
    const t = timers.get(i);
    if (t !== undefined) clearTimeout(t);
    timers.delete(i);
  };

  const cancel = (i: number) => {
    clearTimer(i);
    jobs.delete(i);
    failures.delete(i);
    emit();
  };

  const arm = (i: number, ms: number) => {
    clearTimer(i);
    timers.set(i, setTimeout(() => { void run(i); }, ms));
  };

  async function run(i: number): Promise<boolean> {
    clearTimer(i);
    const running = inflight.get(i);
    if (running) {
      rerun.add(i); // a newer job exists: run it as soon as the in-flight save settles
      await running;
      return !jobs.has(i);
    }
    const job = jobs.get(i);
    if (!job) return true;

    const attempt = (async () => {
      try {
        return (await job()) !== false;
      } catch {
        return false;
      }
    })();
    inflight.set(i, attempt);
    emit();
    const ok = await attempt;
    inflight.delete(i);

    const replaced = jobs.get(i) !== job;
    if (ok) {
      failures.delete(i);
      if (!replaced) jobs.delete(i);
    } else if (!replaced) {
      const n = (failures.get(i) ?? 0) + 1;
      failures.set(i, n);
      if (n <= retryDelaysMs.length) arm(i, retryDelaysMs[n - 1]);
    } else {
      failures.delete(i);
    }
    emit();

    if (rerun.delete(i) || (replaced && jobs.has(i))) return run(i);
    return ok;
  }

  return {
    schedule: (i, job, delay = delayMs) => {
      jobs.set(i, job);
      failures.delete(i);
      arm(i, delay);
      emit();
    },
    cancel,
    flush: async () => {
      const indices = [...new Set([...jobs.keys(), ...inflight.keys()])];
      const results = await Promise.all(indices.map((i) => run(i)));
      return results.every(Boolean) && jobs.size === 0;
    },
    flushOne: async (i) => {
      const ok = await run(i);
      return ok && !jobs.has(i);
    },
    pendingIndices: () => [...new Set([...jobs.keys(), ...inflight.keys()])],
    size: () => jobs.size,
    onStatus: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      [...timers.keys()].forEach(clearTimer);
    },
  };
};
