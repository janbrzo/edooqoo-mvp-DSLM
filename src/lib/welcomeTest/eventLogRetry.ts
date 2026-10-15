/**
 * Welcome Test event logging with bounded retries.
 *
 * `log_welcome_test_event_by_share_token` deletes and re-inserts the event of
 * one answer, so calling it again is safe. The first attempt is awaited (as
 * before); when it fails, the remaining attempts run in the background with
 * backoff and never block the test UI. A newer log for the same answer cancels
 * the retries of the older one, and calls for one key never overlap (a newer
 * call waits for the RPC still in flight), so a late retry cannot land after
 * and overwrite a newer answer.
 * Whatever still fails is rebuilt server side when the test is processed.
 */

export interface EventLogCall { error?: { message?: string } | null }

export interface EventLogger<A> {
  /** Resolves after the first attempt. Never rejects. */
  log: (key: string, args: A) => Promise<void>;
}

export function createEventLogger<A>(opts: {
  call: (args: A) => Promise<EventLogCall | void>;
  /** Delay before each retry; the number of retries is its length. */
  delaysMs?: number[];
  wait?: (ms: number) => Promise<void>;
  onGiveUp?: (key: string, message: string) => void;
}): EventLogger<A> {
  const delays = opts.delaysMs ?? [1000, 3000];
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const latest = new Map<string, number>();
  const tail = new Map<string, Promise<unknown>>();
  let seq = 0;

  const run = async (args: A): Promise<string | null> => {
    try {
      const res = await opts.call(args);
      const err = res && (res as EventLogCall).error;
      return err ? (err.message || 'event not logged') : null;
    } catch (e) {
      return e instanceof Error ? e.message : 'event not logged';
    }
  };
  // One RPC at a time per key, in call order.
  const attempt = (key: string, args: A): Promise<string | null> => {
    const result = (tail.get(key) ?? Promise.resolve()).then(() => run(args));
    tail.set(key, result);
    void result.then(() => { if (tail.get(key) === result) tail.delete(key); });
    return result;
  };

  return {
    async log(key, args) {
      const mine = ++seq;
      latest.set(key, mine);
      let failure = await attempt(key, args);
      if (!failure) return;
      // Background retries: not awaited by the caller.
      void (async () => {
        for (const delay of delays) {
          await wait(delay);
          if (latest.get(key) !== mine) return;
          failure = await attempt(key, args);
          if (!failure) return;
        }
        if (latest.get(key) === mine) opts.onGiveUp?.(key, failure || 'event not logged');
      })();
    },
  };
}
