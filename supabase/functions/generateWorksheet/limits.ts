/* eslint-disable @typescript-eslint/no-explicit-any */
// Limits and permissions of the generateWorksheet request stage (P2.5):
//  * a database-backed rate limiter shared by all isolates (RPC
//    consume_engine_rate_limit), keyed on the verified user or a trusted IP;
//  * a read-only balance pre-check (RPC engine_pre_check) so a teacher without
//    credit gets a calm 402 before any model cost.
// Both fail OPEN: a database problem must never block generation, the legacy
// in-memory limiter takes over and a warning is logged. Both are switchable
// without a redeploy (ENGINE_DB_RATE_LIMIT, ENGINE_BALANCE_PRECHECK = on | off).
// No prompt, model parameter or generation output is touched here.
import { RateLimiter } from "./rateLimiter.ts";

// ---------------------------------------------------------------------------
// Configuration (one place; every value can be overridden by an env var)
// ---------------------------------------------------------------------------
export type BucketKind = "generate" | "batch" | "regenerate";

/** One fixed window: at most `limit` requests per `windowSeconds`. */
export interface Tier {
  limit: number;
  windowSeconds: number;
}

/**
 * Starting thresholds. `generate` keeps the thresholds of the legacy in-memory
 * limiter (3 per 5 min, 5 per 15 min, 10 per 60 min); `batch` and `regenerate`
 * are separate, higher buckets because one homework or edit session sends
 * several requests. `daily` is the per-user cap for signed-in teachers and
 * counts every kind. Env override format: "limit:seconds,limit:seconds"
 * (ENGINE_RATE_LIMIT_GENERATE, _BATCH, _REGENERATE, _DAILY); "off" disables
 * a bucket, an unparsable value keeps the default.
 */
export const DEFAULT_TIERS: Record<BucketKind | "daily", Tier[]> = {
  generate: [
    { limit: 3, windowSeconds: 300 },
    { limit: 5, windowSeconds: 900 },
    { limit: 10, windowSeconds: 3600 },
  ],
  batch: [{ limit: 30, windowSeconds: 600 }],
  regenerate: [{ limit: 20, windowSeconds: 600 }],
  daily: [{ limit: 60, windowSeconds: 86400 }],
};

/** Total time budget of all limiter RPCs of one request, and of the pre-check. */
export const DB_TIMEOUT_MS = 2000;

const MAX_KEY_LENGTH = 64;

export type EnvReader = (name: string) => string | undefined;

const defaultEnv: EnvReader = (name) => {
  try {
    return Deno.env.get(name) ?? undefined;
  } catch {
    return undefined;
  }
};

function flagOn(env: EnvReader, name: string): boolean {
  return (env(name) ?? "on").trim().toLowerCase() !== "off";
}

export function parseTiers(raw: string | undefined, fallback: Tier[]): Tier[] {
  if (raw === undefined || raw.trim() === "") return fallback;
  if (raw.trim().toLowerCase() === "off") return [];
  const tiers: Tier[] = [];
  for (const part of raw.split(",")) {
    const m = /^\s*(\d{1,6})\s*:\s*(\d{1,7})\s*$/.exec(part);
    if (!m) return fallback;
    const limit = Number(m[1]);
    const windowSeconds = Number(m[2]);
    if (limit < 1 || windowSeconds < 1) return fallback;
    tiers.push({ limit, windowSeconds });
  }
  // Shortest window first: the most likely denial happens before any counter of a longer window moves.
  return tiers.sort((a, b) => a.windowSeconds - b.windowSeconds);
}

export function tiersFor(kind: BucketKind | "daily", env: EnvReader = defaultEnv): Tier[] {
  return parseTiers(env(`ENGINE_RATE_LIMIT_${kind.toUpperCase()}`), DEFAULT_TIERS[kind]);
}

// ---------------------------------------------------------------------------
// Caller key
// ---------------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IP_CHARS = /^[0-9a-f:.]{2,45}$/;

/** An IPv4/IPv6 literal, lowercased, or null. Rejects anything else so keys stay bounded. */
export function sanitiseIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!IP_CHARS.test(value)) return null;
  if (!/[.:]/.test(value)) return null;
  return value;
}

/**
 * Trusted client IP: cf-connecting-ip when present, otherwise the FIRST element
 * of x-forwarded-for (the tail is client-controlled), otherwise x-real-ip.
 */
export function trustedIp(headers: Headers): string {
  const cf = sanitiseIp(headers.get("cf-connecting-ip"));
  if (cf) return cf;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = sanitiseIp(xff.split(",")[0]);
    if (first) return first;
  }
  return sanitiseIp(headers.get("x-real-ip")) ?? "unknown";
}

/**
 * Rate-limit key: `user:<uuid>` for a signed-in non-anonymous teacher, else
 * `ip:<trusted ip>`. Anonymous Supabase sessions use the IP because a bot can
 * mint a new anonymous session per request.
 */
export function deriveCallerKey(headers: Headers, userId: string | null, isAnonymous: boolean): string {
  if (userId && !isAnonymous && UUID.test(userId)) return `user:${userId.toLowerCase()}`;
  return `ip:${trustedIp(headers)}`.slice(0, MAX_KEY_LENGTH);
}

/** Bucket of a request; mirrors how index.ts routes batch, regeneration and normal generation. */
export function bucketKind(input: { isBatchGeneration?: boolean; isRegeneration?: boolean; formData?: any }): BucketKind {
  if (input.isBatchGeneration && Array.isArray(input.formData?.targetExerciseTypes)) return "batch";
  if (input.isRegeneration) return "regenerate";
  return "generate";
}

// ---------------------------------------------------------------------------
// Database calls (fail open)
// ---------------------------------------------------------------------------
export interface RpcClient {
  rpc: (fn: string, args?: Record<string, unknown>) => any;
}

class DbTimeout extends Error {}

async function callRpc(
  client: RpcClient,
  fn: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
  timeout: Promise<never>,
) {
  let query = client.rpc(fn, args);
  if (query && typeof query.abortSignal === "function") query = query.abortSignal(signal);
  const result = await Promise.race([Promise.resolve(query), timeout]);
  return result as { data: any; error: any };
}

function withDeadline(ms: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DbTimeout(`database call exceeded ${ms}ms`));
    }, ms);
  });
  // The race may settle first; never leave an unhandled rejection behind.
  timeout.catch(() => {});
  return { signal: controller.signal, timeout, done: () => clearTimeout(timer) };
}

export interface LimitDenied {
  ok: false;
  status: 429 | 402;
  body: Record<string, unknown>;
  retryAfterSeconds?: number;
}
export type LimitDecision = { ok: true } | LimitDenied;

export const RATE_LIMIT_BODY = { error: "Rate limit exceeded. Please try again later." };

export interface RateLimitInput {
  client: RpcClient;
  headers: Headers;
  /** Verified user id (null for public callers). */
  userId: string | null;
  isAnonymous: boolean;
  isBatchGeneration?: boolean;
  isRegeneration?: boolean;
  formData?: any;
  /** The legacy key (the whole forwarded-for string), used only when the DB limiter is off. */
  legacyKey: string;
}

export interface LimitDeps {
  env?: EnvReader;
  memory?: { isAllowed(key: string): boolean };
}

/** Legacy limiter, shared by the flag-off path and the fail-open fallback. */
export const memoryLimiter = new RateLimiter();

const tooMany = (retryAfterSeconds?: number): LimitDenied => ({
  ok: false,
  status: 429,
  body: { ...RATE_LIMIT_BODY },
  ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
});

/** Rate limit check. Position in the request order: after validation, before everything costly. */
export async function checkRateLimit(input: RateLimitInput, deps: LimitDeps = {}): Promise<LimitDecision> {
  const env = deps.env ?? defaultEnv;
  const memory = deps.memory ?? memoryLimiter;

  if (!flagOn(env, "ENGINE_DB_RATE_LIMIT")) {
    return memory.isAllowed(input.legacyKey) ? { ok: true } : tooMany();
  }

  const key = deriveCallerKey(input.headers, input.userId, input.isAnonymous);
  const kind = bucketKind(input);
  const checks: Array<{ bucket: string; tier: Tier }> = tiersFor(kind, env).map((tier) => ({
    bucket: `${kind}_${tier.windowSeconds}`,
    tier,
  }));
  if (key.startsWith("user:")) {
    for (const tier of tiersFor("daily", env)) checks.push({ bucket: `daily_${tier.windowSeconds}`, tier });
  }

  const deadline = withDeadline(DB_TIMEOUT_MS);
  try {
    for (const { bucket, tier } of checks) {
      const { data, error } = await callRpc(
        input.client,
        "consume_engine_rate_limit",
        { p_key: key, p_bucket: bucket, p_limit: tier.limit, p_window_seconds: tier.windowSeconds },
        deadline.signal,
        deadline.timeout,
      );
      if (error) throw new Error(`consume_engine_rate_limit: ${error.message ?? String(error)}`);
      if (!data || typeof data.allowed !== "boolean") {
        throw new Error("consume_engine_rate_limit returned an unexpected shape");
      }
      if (!data.allowed) {
        const retry = Number.isFinite(data.retry_after_seconds)
          ? Math.max(1, Math.ceil(data.retry_after_seconds))
          : tier.windowSeconds;
        console.warn(`Rate limit exceeded (${tier.limit}/${tier.windowSeconds}s, ${kind}) for key: ${key}`);
        return tooMany(retry);
      }
    }
    return { ok: true };
  } catch (error) {
    console.warn(
      `[limits] DB rate limiter unavailable, using in-memory limiter: ${error instanceof Error ? error.message : String(error)}`,
    );
    return memory.isAllowed(key) ? { ok: true } : tooMany();
  } finally {
    deadline.done();
  }
}

// ---------------------------------------------------------------------------
// Balance pre-check
// ---------------------------------------------------------------------------
export interface PreCheckInput {
  client: RpcClient;
  userId: string | null;
  isAnonymous: boolean;
  isBatchGeneration?: boolean;
  isRegeneration?: boolean;
  formData?: any;
}

export const INSUFFICIENT_TOKENS_MESSAGE =
  "You have no worksheet credits left. Add credits to your account to generate a new worksheet.";
export const TOKENS_FROZEN_MESSAGE =
  "Your credits are currently on hold, so a new worksheet cannot be generated. Please contact support.";

/**
 * Only a request that will insert a charged worksheet row is pre-checked:
 * batch (homework exercises) and regeneration write no worksheet and are not
 * charged by the server trigger today, so they are never refused here.
 */
export function chargesWorksheet(input: { isBatchGeneration?: boolean; isRegeneration?: boolean; formData?: any }): boolean {
  return bucketKind(input) === "generate";
}

/** Refuses with 402 only when engine_pre_check says the server charge trigger would refuse too. */
export async function checkBalance(input: PreCheckInput, deps: LimitDeps = {}): Promise<LimitDecision> {
  const env = deps.env ?? defaultEnv;
  if (!flagOn(env, "ENGINE_BALANCE_PRECHECK")) return { ok: true };
  if (!input.userId || input.isAnonymous || !chargesWorksheet(input)) return { ok: true };

  const deadline = withDeadline(DB_TIMEOUT_MS);
  try {
    const { data, error } = await callRpc(
      input.client,
      "engine_pre_check",
      { p_user_id: input.userId },
      deadline.signal,
      deadline.timeout,
    );
    if (error) throw new Error(`engine_pre_check: ${error.message ?? String(error)}`);
    if (!data || typeof data.allowed !== "boolean") throw new Error("engine_pre_check returned an unexpected shape");
    if (data.allowed) return { ok: true };

    const frozen = data.reason === "tokens_frozen" || data.frozen === true;
    console.warn(`[limits] balance pre-check refused user ${input.userId}: ${frozen ? "tokens_frozen" : "insufficient_tokens"}`);
    return {
      ok: false,
      status: 402,
      body: frozen
        ? { error: TOKENS_FROZEN_MESSAGE, code: "tokens_frozen" }
        : { error: INSUFFICIENT_TOKENS_MESSAGE, code: "insufficient_tokens" },
    };
  } catch (error) {
    console.warn(`[limits] balance pre-check unavailable, continuing: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: true };
  } finally {
    deadline.done();
  }
}

/** HTTP response for a refused request (429 with Retry-After, or 402 with a machine-readable code). */
export function limitResponse(decision: LimitDenied, baseHeaders: Record<string, string>): Response {
  const headers: Record<string, string> = { ...baseHeaders, "Content-Type": "application/json" };
  if (decision.retryAfterSeconds !== undefined) headers["Retry-After"] = String(decision.retryAfterSeconds);
  return new Response(JSON.stringify(decision.body), { status: decision.status, headers });
}
