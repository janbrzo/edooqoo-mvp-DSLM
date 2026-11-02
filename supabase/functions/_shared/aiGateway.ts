// Pillar 4, Stage 4.1: model-agnostic AI gateway for non-protected Edge Functions.
//
// Callers name a semantic role ("media-passages", "chat-primary", ...) instead of a
// provider SDK and a hardcoded model id. The model id and provider for a role come
// only from `MODEL_REGISTRY` (modelRegistry.ts); an optional per-role env override
// (`AI_GATEWAY_MODEL_<ROLE>`) swaps the model id inside the same provider; and the
// registry's `gatewayFallbackRole` names the role tried once when the primary
// provider fails transiently (402, 404, 429, 5xx, network error).
//
// Prompts are passed through untouched. The protected Worksheet Generation Engine
// (generateWorksheet, format-worksheet-prompt) never uses this module.
//
// No static remote imports: the module is unit-tested with Vitest. The default
// failure logger is loaded lazily and tests inject their own dependencies.
import { MODEL_REGISTRY, type ModelProvider, type ModelRegistryEntry } from "./modelRegistry.ts";

export type ModelSemanticRole =
  | "chat-primary"
  | "chat-lightweight"
  | "chat-fallback"
  | "media-passages";

export const GATEWAY_ROLES: readonly ModelSemanticRole[] = [
  "chat-primary",
  "chat-lightweight",
  "chat-fallback",
  "media-passages",
];

/** Providers this gateway can call for text chat. */
export type GatewayProvider = Extract<ModelProvider, "openai" | "google">;

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCallPayload {
  messages: AiChatMessage[];
  temperature?: number;
  /** Output cap; sent as `max_completion_tokens` (OpenAI) or `max_output_tokens` (Gemini). */
  maxOutputTokens?: number;
  /** Ask the provider for a JSON object response. */
  json?: boolean;
}

export interface AiGatewayResult {
  text: string;
  role: ModelSemanticRole;
  provider: GatewayProvider;
  model: string;
  usedFallback: boolean;
}

export interface FailureLogEntry {
  model: string;
  provider: string;
  status: number;
  endpoint: string;
  error: string;
  functionName: string;
}

export interface GatewayDeps {
  fetch: typeof fetch;
  getEnv: (name: string) => string | undefined;
  logFailure: (entry: FailureLogEntry) => Promise<void>;
}

export interface GatewayOptions {
  /** Caller Edge Function name, written to error_logs on provider failure. */
  functionName: string;
  /** Set false to disable the registry fallback role for this call. */
  allowFallback?: boolean;
  deps?: Partial<GatewayDeps>;
}

export class AiGatewayError extends Error {
  readonly status: number;
  readonly provider: GatewayProvider | null;
  readonly model: string | null;
  constructor(message: string, status: number, provider: GatewayProvider | null, model: string | null) {
    super(message);
    this.name = "AiGatewayError";
    this.status = status;
    this.provider = provider;
    this.model = model;
  }
}

export const OPENAI_CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
export const GOOGLE_GENERATE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const API_KEY_ENV: Record<GatewayProvider, string> = {
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
};

/** Env var that overrides the model id of a role, e.g. AI_GATEWAY_MODEL_MEDIA_PASSAGES. */
export function overrideEnvVar(role: ModelSemanticRole): string {
  return `AI_GATEWAY_MODEL_${role.toUpperCase().replace(/-/g, "_")}`;
}

/** Status codes that switch to the fallback role; every other failure is terminal. */
export function isFallbackStatus(status: number): boolean {
  return status === 402 || status === 404 || status === 429 || status >= 500;
}

export interface ResolvedTarget {
  role: ModelSemanticRole;
  provider: GatewayProvider;
  model: string;
  overridden: boolean;
}

function registryEntry(role: ModelSemanticRole): ModelRegistryEntry {
  const entry = MODEL_REGISTRY.find((e) => e.role === role);
  if (!entry) throw new AiGatewayError(`No registry model for role ${role}`, 500, null, null);
  if (entry.provider !== "openai" && entry.provider !== "google") {
    throw new AiGatewayError(`Role ${role} uses unsupported provider ${entry.provider}`, 500, null, entry.id);
  }
  return entry;
}

/** Resolves a role to its provider and model id (registry value or env override). */
export function resolveRole(role: ModelSemanticRole, getEnv: GatewayDeps["getEnv"]): ResolvedTarget {
  const entry = registryEntry(role);
  const raw = getEnv(overrideEnvVar(role))?.trim();
  const valid = !!raw && /^[A-Za-z0-9._-]{1,80}$/.test(raw);
  return {
    role,
    provider: entry.provider as GatewayProvider,
    model: valid ? raw! : entry.id,
    overridden: valid,
  };
}

/** The ordered targets tried for a role: primary, then at most one fallback role. */
export function resolveChain(
  role: ModelSemanticRole,
  getEnv: GatewayDeps["getEnv"],
  allowFallback = true,
): ResolvedTarget[] {
  const chain = [resolveRole(role, getEnv)];
  const fallbackRole = registryEntry(role).gatewayFallbackRole as ModelSemanticRole | undefined;
  if (allowFallback && fallbackRole && fallbackRole !== role && GATEWAY_ROLES.includes(fallbackRole)) {
    chain.push(resolveRole(fallbackRole, getEnv));
  }
  return chain;
}

export function buildOpenAiBody(model: string, payload: AiCallPayload): Record<string, unknown> {
  const body: Record<string, unknown> = { model, messages: payload.messages };
  if (typeof payload.temperature === "number") body.temperature = payload.temperature;
  if (typeof payload.maxOutputTokens === "number") body.max_completion_tokens = payload.maxOutputTokens;
  if (payload.json) body.response_format = { type: "json_object" };
  return body;
}

export function buildGeminiBody(payload: AiCallPayload): Record<string, unknown> {
  const system = payload.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = payload.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const generation_config: Record<string, unknown> = {};
  if (typeof payload.temperature === "number") generation_config.temperature = payload.temperature;
  if (typeof payload.maxOutputTokens === "number") generation_config.max_output_tokens = payload.maxOutputTokens;
  if (payload.json) generation_config.response_mime_type = "application/json";
  const body: Record<string, unknown> = { contents, generation_config };
  if (system) body.system_instruction = { parts: [{ text: system }] };
  return body;
}

function extractText(provider: GatewayProvider, json: any): string {
  if (provider === "openai") {
    const content = json?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
  }
  const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => typeof p?.text === "string" && !p?.thought).map((p) => p.text).join("");
}

function defaultGetEnv(name: string): string | undefined {
  const deno = (globalThis as { Deno?: { env: { get(n: string): string | undefined } } }).Deno;
  return deno?.env.get(name);
}

async function defaultLogFailure(entry: FailureLogEntry): Promise<void> {
  // Non-literal specifier keeps the remote-importing logger out of browser/Vitest type graphs.
  const loggerPath = "./modelFailureLogger.ts";
  const mod = await import(/* @vite-ignore */ loggerPath);
  await mod.logModelFailure(entry);
}

type Attempt =
  | { ok: true; text: string }
  | { ok: false; status: number; message: string; retryable: boolean };

async function attempt(target: ResolvedTarget, payload: AiCallPayload, deps: GatewayDeps, functionName: string): Promise<Attempt> {
  const key = deps.getEnv(API_KEY_ENV[target.provider]);
  if (!key) return { ok: false, status: 503, message: `${API_KEY_ENV[target.provider]} not configured`, retryable: true };

  const endpoint = target.provider === "openai"
    ? OPENAI_CHAT_ENDPOINT
    : `${GOOGLE_GENERATE_BASE}/${target.model}:generateContent`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (target.provider === "openai") headers.Authorization = `Bearer ${key}`;
  else headers["x-goog-api-key"] = key;
  const body = target.provider === "openai" ? buildOpenAiBody(target.model, payload) : buildGeminiBody(payload);

  let res: Response;
  try {
    res = await deps.fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    return { ok: false, status: 503, message: `network error: ${(e as Error).message}`, retryable: true };
  }

  if (!res.ok) {
    const errText = (await res.text().catch(() => "")).slice(0, 500);
    await deps.logFailure({
      model: target.model,
      provider: target.provider,
      status: res.status,
      endpoint: target.provider === "openai" ? OPENAI_CHAT_ENDPOINT : GOOGLE_GENERATE_BASE,
      error: errText,
      functionName,
    }).catch(() => undefined);
    return { ok: false, status: res.status, message: `${target.provider} ${target.model} HTTP ${res.status}`, retryable: isFallbackStatus(res.status) };
  }

  const json = await res.json().catch(() => null);
  const text = extractText(target.provider, json).trim();
  if (!text) return { ok: false, status: 502, message: `${target.provider} ${target.model} returned no text`, retryable: false };
  return { ok: true, text };
}

/**
 * Runs one chat call for a semantic role. Tries the role's registry model, then
 * (on a transient failure only) the registry fallback role once. Never retries
 * the same target and never changes the prompt.
 */
export async function executeAiCall(
  role: ModelSemanticRole,
  payload: AiCallPayload,
  options: GatewayOptions,
): Promise<AiGatewayResult> {
  if (!GATEWAY_ROLES.includes(role)) throw new AiGatewayError(`Unknown gateway role ${role}`, 500, null, null);
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new AiGatewayError("Gateway call needs at least one message", 400, null, null);
  }
  const deps: GatewayDeps = {
    fetch: options.deps?.fetch ?? fetch,
    getEnv: options.deps?.getEnv ?? defaultGetEnv,
    logFailure: options.deps?.logFailure ?? defaultLogFailure,
  };
  const chain = resolveChain(role, deps.getEnv, options.allowFallback !== false);

  let last: { status: number; message: string; target: ResolvedTarget } | null = null;
  for (let i = 0; i < chain.length; i++) {
    const target = chain[i];
    const result = await attempt(target, payload, deps, options.functionName);
    if (result.ok === true) {
      return { text: result.text, role, provider: target.provider, model: target.model, usedFallback: i > 0 };
    }
    last = { status: result.status, message: result.message, target };
    if (!result.retryable) break;
  }
  throw new AiGatewayError(last!.message, last!.status, last!.target.provider, last!.target.model);
}
