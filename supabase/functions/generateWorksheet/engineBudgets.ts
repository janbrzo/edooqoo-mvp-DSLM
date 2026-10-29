// Time budgets of the generation pipeline, and the logic that enforces them.
//
// The Supabase edge request limit is 150 s, so the whole pipeline (model call,
// fallback, JSON repair, save) is planned inside ENGINE_BUDGETS.totalMs, measured
// from the start of the request. Observed typical generation takes 57-111 s, so
// the primary model is never cut off while it is still delivering content: a
// call is only aborted when it is silent (no first chunk, a stall), when it ran
// past its hard budget and stopped streaming, or when the request deadline is
// reached. Pure functions take the clock as an argument so the logic is
// unit-tested with fake timers.

export const ENGINE_BUDGETS = {
  /** Wall-clock budget of one request, from the start of the handler. */
  totalMs: 140_000,
  /** Kept free after the last model call for parse, save and the response. */
  postModelReserveMs: 12_000,
  /** Streaming: no first chunk within this long means the call is stuck. */
  streamFirstChunkMs: 60_000,
  /** Streaming: silence this long after the first chunk means a stall. */
  streamStallMs: 30_000,
  /** Primary streaming call: past this it is aborted unless it is still streaming. */
  primaryHardMs: 100_000,
  /** "Still streaming" = a chunk arrived within this long. */
  activeGraceMs: 10_000,
  /** Non-streaming primary call (batch, regular): one hard timeout. */
  nonStreamingPrimaryMs: 120_000,
  /** The fallback model is only started when at least this much time remains. */
  fallbackMinMs: 40_000,
  /** AI repair of the broken window around a JSON syntax error. */
  aiRepairWindowMs: 20_000,
  /** AI repair of the whole document. */
  aiRepairDocumentMs: 30_000,
  /** An AI repair is skipped when less than this remains. */
  aiRepairMinMs: 5_000,
  /** One geolocation lookup request. */
  geolocationFetchMs: 2_000,
  /** The whole geolocation lookup (cache and both services) is given up after this. */
  geolocationTotalMs: 5_000,
  /** How often the stream watchdog evaluates its limits. */
  watchdogPollMs: 1_000,
} as const;

export interface StreamLimits {
  firstChunkMs: number;
  stallMs: number;
  /** After this the call is aborted unless it is still streaming (Infinity = never). */
  hardMs: number;
  activeGraceMs: number;
}

export const PRIMARY_STREAM_LIMITS: StreamLimits = {
  firstChunkMs: ENGINE_BUDGETS.streamFirstChunkMs,
  stallMs: ENGINE_BUDGETS.streamStallMs,
  hardMs: ENGINE_BUDGETS.primaryHardMs,
  activeGraceMs: ENGINE_BUDGETS.activeGraceMs,
};

export const FALLBACK_STREAM_LIMITS: StreamLimits = {
  firstChunkMs: ENGINE_BUDGETS.streamFirstChunkMs,
  stallMs: ENGINE_BUDGETS.streamStallMs,
  hardMs: Number.POSITIVE_INFINITY,
  activeGraceMs: ENGINE_BUDGETS.activeGraceMs,
};

export type TimeoutReason = "first_chunk_timeout" | "stall" | "hard_timeout" | "deadline" | "call_timeout";

/** Raised when a model call is aborted by one of the budgets above. */
export class ModelTimeoutError extends Error {
  readonly reason: TimeoutReason;
  constructor(reason: TimeoutReason, detail = "") {
    super(`Model call timeout (${reason})${detail ? `: ${detail}` : ""}`);
    this.name = "ModelTimeoutError";
    this.reason = reason;
  }
}

/** Absolute end of the model budget for a request that started at `generationStartTime`. */
export function deadlineFrom(generationStartTime: number): number {
  return generationStartTime + ENGINE_BUDGETS.totalMs;
}

/** Time left for model work before the post-model reserve (can be negative). */
export function remainingModelMs(deadlineAt: number, now: number): number {
  return deadlineAt - now - ENGINE_BUDGETS.postModelReserveMs;
}

/** True when there is enough time left to start the fallback model. */
export function canStartFallback(deadlineAt: number, now: number): boolean {
  return remainingModelMs(deadlineAt, now) >= ENGINE_BUDGETS.fallbackMinMs;
}

/**
 * Budget for one non-streaming call: the call's own maximum, clipped to the
 * time left. A value <= 0 means there is no time for the call.
 */
export function callBudgetMs(maxMs: number, deadlineAt: number | undefined, now: number): number {
  if (deadlineAt === undefined) return maxMs;
  return Math.min(maxMs, remainingModelMs(deadlineAt, now));
}

export interface StreamClock {
  now: number;
  callStartedAt: number;
  /** Time of the last chunk, null before the first one. */
  lastChunkAt: number | null;
  deadlineAt: number;
}

export type StreamVerdict = { ok: true } | { ok: false; reason: TimeoutReason };

/** Decides whether a streaming call must be aborted. Pure. */
export function evaluateStream(clock: StreamClock, limits: StreamLimits): StreamVerdict {
  const { now, callStartedAt, lastChunkAt, deadlineAt } = clock;
  if (remainingModelMs(deadlineAt, now) <= 0) return { ok: false, reason: "deadline" };
  if (lastChunkAt === null) {
    return now - callStartedAt >= limits.firstChunkMs ? { ok: false, reason: "first_chunk_timeout" } : { ok: true };
  }
  const silent = now - lastChunkAt;
  if (silent >= limits.stallMs) return { ok: false, reason: "stall" };
  if (now - callStartedAt >= limits.hardMs && silent >= limits.activeGraceMs) return { ok: false, reason: "hard_timeout" };
  return { ok: true };
}

export interface StreamWatchdog {
  /** Call for every chunk received. */
  touch(): void;
  /** Stops the timer; always call it when the call ends. */
  stop(): void;
  /** Why the call was aborted, null while it was not. */
  reason(): TimeoutReason | null;
  signal: AbortSignal;
}

/**
 * Polls evaluateStream and aborts the controller with a ModelTimeoutError when
 * a limit is hit. The abort reaches the SDK through `signal` and also rejects
 * `raceAbort`, so a stuck stream cannot hang the request.
 */
export function startStreamWatchdog(options: {
  limits: StreamLimits;
  deadlineAt: number;
  controller?: AbortController;
  now?: () => number;
  pollMs?: number;
}): StreamWatchdog {
  const controller = options.controller ?? new AbortController();
  const now = options.now ?? (() => Date.now());
  const callStartedAt = now();
  let lastChunkAt: number | null = null;
  let reason: TimeoutReason | null = null;

  const timer = setInterval(() => {
    if (reason) return;
    const verdict = evaluateStream({ now: now(), callStartedAt, lastChunkAt, deadlineAt: options.deadlineAt }, options.limits);
    if (!verdict.ok) {
      reason = verdict.reason;
      controller.abort(new ModelTimeoutError(verdict.reason, `${Math.round((now() - callStartedAt) / 1000)}s into the call`));
    }
  }, options.pollMs ?? ENGINE_BUDGETS.watchdogPollMs);

  return {
    touch() {
      lastChunkAt = now();
    },
    stop() {
      clearInterval(timer);
    },
    reason: () => reason,
    signal: controller.signal,
  };
}

/** Rejects with the abort reason as soon as `signal` aborts; the pending promise is left to settle on its own. */
export function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  // The losing promise may reject later; keep that from surfacing as unhandled.
  promise.catch(() => {});
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Runs `fn` with an AbortSignal that aborts after `ms`. Used for calls that give
 * no progress to watch (non-streaming completions, AI repair, fetches).
 */
export async function withCallTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new ModelTimeoutError("call_timeout", `${Math.round(ms / 1000)}s`)), ms);
  try {
    return await raceAbort(fn(controller.signal), controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
