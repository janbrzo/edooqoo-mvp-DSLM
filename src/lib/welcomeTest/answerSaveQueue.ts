/**
 * Per-question save queue for the Welcome Test.
 *
 * - One save in flight per question; a newer answer for the same question
 *   supersedes the older payload (last write wins, no overlapping RPCs).
 * - A thrown error (network, 5xx) is retried with backoff; after the last
 *   delay the entry stays `failed` until `retryFailed()`.
 * - `save` resolving `false` is a hard failure (token rotated or expired, test
 *   closed, question missing): it is NOT retried and stays `failed`.
 * - `flush()` waits for everything in flight and tells whether all is saved.
 */
export type SaveState = 'saved' | 'saving' | 'retrying' | 'failed';

export interface SaveSnapshot {
  state: SaveState;
  /** Questions whose latest answer is not confirmed saved. */
  unsaved: number;
  /** At least one failure was a hard rejection (retrying will not help until the link is valid). */
  hardFailed: boolean;
}

export interface AnswerSaveQueue<P> {
  enqueue: (key: string, payload: P, opts?: { onSaved?: () => Promise<void> | void }) => Promise<boolean>;
  flush: () => Promise<boolean>;
  retryFailed: () => Promise<boolean>;
  snapshot: () => SaveSnapshot;
  hasUnsaved: () => boolean;
}

interface Entry<P> {
  payload: P;
  version: number;
  onSaved?: () => Promise<void> | void;
  status: 'pending' | 'retrying' | 'failed';
  hard: boolean;
  attempts: number;
  running: Promise<boolean> | null;
}

export const DEFAULT_SAVE_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

export function createAnswerSaveQueue<P>(opts: {
  /** Resolve true when saved, false for a hard rejection, throw for a retryable error. */
  save: (key: string, payload: P) => Promise<boolean>;
  delaysMs?: number[];
  wait?: (ms: number) => Promise<void>;
  onChange?: (snapshot: SaveSnapshot) => void;
}): AnswerSaveQueue<P> {
  const delays = opts.delaysMs ?? DEFAULT_SAVE_RETRY_DELAYS_MS;
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const entries = new Map<string, Entry<P>>();

  const snapshot = (): SaveSnapshot => {
    const list = [...entries.values()];
    let state: SaveState = 'saved';
    if (list.some((e) => e.status === 'failed')) state = 'failed';
    else if (list.some((e) => e.status === 'retrying')) state = 'retrying';
    else if (list.length > 0) state = 'saving';
    return { state, unsaved: list.length, hardFailed: list.some((e) => e.status === 'failed' && e.hard) };
  };
  const notify = () => opts.onChange?.(snapshot());

  const run = async (key: string, e: Entry<P>): Promise<boolean> => {
    for (;;) {
      const version = e.version;
      const payload = e.payload;
      e.status = 'pending';
      notify();
      let ok: boolean;
      try {
        ok = await opts.save(key, payload);
      } catch {
        if (e.version !== version) { e.attempts = 0; continue; }
        if (e.attempts >= delays.length) {
          e.status = 'failed';
          e.hard = false;
          notify();
          return false;
        }
        e.status = 'retrying';
        notify();
        await wait(delays[e.attempts++]);
        continue;
      }
      if (e.version !== version) continue; // a newer answer arrived meanwhile
      if (!ok) {
        e.status = 'failed';
        e.hard = true;
        notify();
        return false;
      }
      entries.delete(key);
      notify();
      try { await e.onSaved?.(); } catch { /* event logging must never break saving */ }
      return true;
    }
  };

  const start = (key: string, e: Entry<P>): Promise<boolean> => {
    if (e.running) return e.running;
    const p = run(key, e).finally(() => { e.running = null; });
    e.running = p;
    return p;
  };

  const flush = async (): Promise<boolean> => {
    for (;;) {
      const running = [...entries.values()].map((e) => e.running).filter((p): p is Promise<boolean> => !!p);
      if (running.length === 0) break;
      await Promise.all(running);
    }
    return ![...entries.values()].some((e) => e.status === 'failed');
  };

  return {
    enqueue(key, payload, o) {
      const existing = entries.get(key);
      if (existing) {
        existing.payload = payload;
        existing.version++;
        existing.onSaved = o?.onSaved;
        existing.attempts = 0;
        existing.hard = false;
        if (existing.status === 'failed') existing.status = 'pending';
        return start(key, existing);
      }
      const e: Entry<P> = { payload, version: 0, onSaved: o?.onSaved, status: 'pending', hard: false, attempts: 0, running: null };
      entries.set(key, e);
      return start(key, e);
    },
    flush,
    async retryFailed() {
      for (const [key, e] of entries) {
        if (e.status === 'failed' && !e.running) {
          e.attempts = 0;
          e.hard = false;
          e.status = 'pending';
          void start(key, e);
        }
      }
      return flush();
    },
    snapshot,
    hasUnsaved: () => entries.size > 0,
  };
}
