/* eslint-disable @typescript-eslint/no-explicit-any */
// Classification of model provider errors: decides whether the OpenAI fallback
// is worth trying, and what the telemetry calls the failure.
import { ModelTimeoutError } from "./engineBudgets.ts";

export type ProviderErrorKind =
  | "timeout"
  | "rate_limit"
  | "server"
  | "auth"
  | "config"
  | "request"
  | "truncated"
  | "network"
  | "unknown";

export interface ProviderErrorClass {
  kind: ProviderErrorKind;
  status: number | null;
  /** False only for errors caused by our own request (the fallback would get the same input). */
  fallback: boolean;
}

/** The model stopped because it hit the output token limit (Gemini MAX_TOKENS, OpenAI length). */
export class ModelTruncatedError extends Error {
  readonly finishReason: string;
  readonly content: string;
  constructor(finishReason: string, content: string) {
    super(`Model output truncated (finish reason ${finishReason})`);
    this.name = "ModelTruncatedError";
    this.finishReason = finishReason;
    this.content = content;
  }
}

export function isTruncationReason(finishReason: string | null | undefined): boolean {
  return finishReason === "MAX_TOKENS" || finishReason === "length";
}

function statusOf(error: any): number | null {
  const direct = error?.status ?? error?.response?.status;
  if (typeof direct === "number") return direct;
  const match = /\[(\d{3})[^\]]*\]/.exec(String(error?.message ?? ""));
  return match ? Number(match[1]) : null;
}

// A 400 that names a provider-side condition (key, region, billing) is not about our request.
const PROVIDER_SIDE_400 = /API[_ ]KEY|FAILED_PRECONDITION|location is not supported|billing|quota/i;

/** Classifies an error thrown by a model call. Never throws. */
export function classifyProviderError(error: unknown): ProviderErrorClass {
  const e = error as any;
  const message = String(e?.message ?? error ?? "");
  const status = statusOf(e);

  if (e instanceof ModelTruncatedError) return { kind: "truncated", status, fallback: true };
  if (e instanceof ModelTimeoutError || e?.name === "AbortError" || e?.name === "TimeoutError" || /timed? ?out|ETIMEDOUT|deadline/i.test(message)) {
    return { kind: "timeout", status, fallback: true };
  }
  if (/GEMINI_API_KEY not configured/.test(message)) return { kind: "config", status, fallback: true };
  if (status === 429) return { kind: "rate_limit", status, fallback: true };
  if (status === 408) return { kind: "timeout", status, fallback: true };
  if (status !== null && status >= 500) return { kind: "server", status, fallback: true };
  if (status === 401 || status === 403) return { kind: "auth", status, fallback: true };
  if (status === 400 || status === 413 || status === 415 || status === 422) {
    if (status === 400 && PROVIDER_SIDE_400.test(message)) return { kind: "config", status, fallback: true };
    return { kind: "request", status, fallback: false };
  }
  if (status !== null && status >= 400) return { kind: "config", status, fallback: true };
  if (/fetch failed|network|ECONN|ENOTFOUND|socket/i.test(message)) return { kind: "network", status, fallback: true };
  return { kind: "unknown", status, fallback: true };
}

/** Per-request facts about the model calls, logged in engine_quality. */
export interface ModelRunInfo {
  finishReason: string | null;
  truncated: boolean;
  primaryFailure: ProviderErrorKind | null;
  fallbackSkipped: boolean;
}

export function newModelRunInfo(): ModelRunInfo {
  return { finishReason: null, truncated: false, primaryFailure: null, fallbackSkipped: false };
}

export function noteFinish(info: ModelRunInfo | undefined, finishReason: string | null | undefined): void {
  if (!info) return;
  info.finishReason = finishReason ?? null;
  info.truncated = isTruncationReason(finishReason);
}
