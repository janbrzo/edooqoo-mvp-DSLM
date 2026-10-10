/**
 * Per-exercise debounced autosave.
 *
 * A single shared timer used to drop the pending save of exercise A whenever the
 * student touched exercise B within the debounce window, and nothing flushed the
 * queue on submit, so answers could be lost. Each exercise now has its own timer,
 * and `flush()` runs every pending save immediately (submit, unmount).
 */
type SaveJob = () => Promise<unknown> | unknown;

export interface PendingSaves {
  /** (Re)schedule the save of one exercise; only that exercise's earlier timer is replaced. */
  schedule: (exerciseIndex: number, job: SaveJob) => void;
  /** Drop one exercise's pending save (the caller saves it itself, e.g. on blur). */
  cancel: (exerciseIndex: number) => void;
  /** Run every pending save now and wait for them. */
  flush: () => Promise<void>;
  size: () => number;
}

export const createPendingSaves = (delayMs = 1500): PendingSaves => {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  const jobs = new Map<number, SaveJob>();

  const cancel = (exerciseIndex: number) => {
    const t = timers.get(exerciseIndex);
    if (t !== undefined) clearTimeout(t);
    timers.delete(exerciseIndex);
    jobs.delete(exerciseIndex);
  };

  const run = (exerciseIndex: number) => {
    const job = jobs.get(exerciseIndex);
    cancel(exerciseIndex);
    return job ? Promise.resolve(job()) : Promise.resolve();
  };

  return {
    schedule: (exerciseIndex, job) => {
      cancel(exerciseIndex);
      jobs.set(exerciseIndex, job);
      timers.set(exerciseIndex, setTimeout(() => { void run(exerciseIndex); }, delayMs));
    },
    cancel,
    flush: async () => {
      await Promise.all([...jobs.keys()].map((i) => run(i).catch(() => undefined)));
    },
    size: () => jobs.size,
  };
};
