// Pure logic for the `audit-llm-models` Edge Function: probe classification,
// lifecycle countdown, provider deprecation-page scanning, the monthly model
// advisor (prompt + response validation) and email report rendering.
//
// No Deno APIs and no remote imports so it can be unit-tested with Vitest
// (src/lib/__tests__/modelAudit.test.ts).

import type { ModelLifecycle, ModelProvider, ModelRegistryEntry } from "./modelRegistry.ts";

export const LIFECYCLE_WARN_DAYS = 120;
export const LIFECYCLE_CRIT_DAYS = 30;
/** A suggested model may cost at most this much more when quality is clearly better. */
export const ADVISOR_MAX_PRICE_INCREASE_PCT = 30;

const DAY_MS = 86_400_000;

// ── Probe classification ───────────────────────────────────────────────────

export type ProbeCategory =
  | "ok"
  | "deprecated" // 404 / 410 — model removed or renamed
  | "auth" // 401 / 403 — key revoked, billing or permission problem
  | "rate_limited" // 429 — quota exhausted
  | "server" // 5xx
  | "client" // other 4xx (usually a malformed probe request)
  | "missing_key" // status -1: secret not configured
  | "network"; // status 0: fetch threw

export function classifyProbeStatus(status: number): ProbeCategory {
  if (status >= 200 && status < 300) return "ok";
  if (status === 404 || status === 410) return "deprecated";
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  if (status >= 400) return "client";
  if (status === -1) return "missing_key";
  return "network";
}

/**
 * Categories that break live teacher workflows and must reach `error_logs`
 * (and therefore the public StatusPage banner via get_active_model_issues).
 */
export function shouldLogProbeFailure(category: ProbeCategory): boolean {
  return category === "deprecated" || category === "auth" || category === "rate_limited" || category === "server";
}

// ── Lifecycle countdown ────────────────────────────────────────────────────

export type LifecycleLevel = "none" | "ok" | "warn" | "crit" | "past";

export interface LifecycleStatus {
  level: LifecycleLevel;
  daysToShutdown: number | null;
}

function utcDayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole days from `now` (UTC day) to an ISO date; negative when in the past. */
export function daysUntil(isoDate: string, now: Date): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - utcDayStart(now)) / DAY_MS);
}

export function classifyLifecycle(lifecycle: ModelLifecycle, now: Date): LifecycleStatus {
  if (!lifecycle.shutdownDate) return { level: "none", daysToShutdown: null };
  const days = daysUntil(lifecycle.shutdownDate, now);
  const level: LifecycleLevel =
    days < 0 ? "past" : days <= LIFECYCLE_CRIT_DAYS ? "crit" : days <= LIFECYCLE_WARN_DAYS ? "warn" : "ok";
  return { level, daysToShutdown: days };
}

// ── HTML → text ────────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&rsquo;|&lsquo;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Date extraction ────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const DATE_RE =
  /\b(?:(\d{4})-(\d{2})-(\d{2})|(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4}))\b/g;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Extracts ISO dates from "2026-12-11", "Dec 11, 2026" and "December 11th, 2026" forms. */
export function extractDates(text: string): string[] {
  const out: string[] = [];
  DATE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DATE_RE.exec(text)) !== null) {
    if (m[1]) {
      out.push(`${m[1]}-${m[2]}-${m[3]}`);
    } else {
      const month = MONTHS[m[4].toLowerCase().slice(0, m[4].toLowerCase().startsWith("sept") ? 4 : 3)];
      if (month) out.push(`${m[6]}-${pad(month)}-${pad(Number(m[5]))}`);
    }
  }
  return out;
}

// ── Deprecation page scan ──────────────────────────────────────────────────

/** Any model-like token; used to cut a mention's context at the neighbouring rows. */
const MODEL_TOKEN_RE =
  /(?<![A-Za-z0-9._-])(?:gpt-|gemini-|gemma-|whisper-|tts-|dall-e-|chatgpt-|text-embedding-|textembedding-|imagen-|veo-|sora-|codex-|computer-use-|babbage-|davinci-|o[1-9]-|o[1-9](?![A-Za-z0-9._-]))[A-Za-z0-9._-]*/g;

const SNAPSHOT_SUFFIX_RE = /^-\d{4}-\d{2}-\d{2}/;

interface Span {
  start: number;
  end: number;
}

function modelTokenSpans(text: string): Span[] {
  const spans: Span[] = [];
  MODEL_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MODEL_TOKEN_RE.exec(text)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].replace(/\.$/, "").length });
  }
  return spans;
}

/**
 * Positions where `id` (or a dated snapshot of it, e.g. `gpt-4o-mini-2024-07-18`)
 * appears as a whole token. `gpt-4o-mini` does not match `gpt-4o-mini-tts`.
 */
export function findModelMentions(text: string, id: string): Span[] {
  const spans: Span[] = [];
  let from = 0;
  while (true) {
    const idx = text.indexOf(id, from);
    if (idx === -1) break;
    from = idx + id.length;
    const prev = idx > 0 ? text[idx - 1] : "";
    if (prev && /[A-Za-z0-9._-]/.test(prev)) continue;
    let end = idx + id.length;
    const snap = SNAPSHOT_SUFFIX_RE.exec(text.slice(end, end + 11));
    if (snap) end += snap[0].length;
    const next = text[end] ?? "";
    const afterNext = text[end + 1] ?? "";
    if (next && /[A-Za-z0-9_-]/.test(next)) continue;
    if (next === "." && /[A-Za-z0-9]/.test(afterNext)) continue;
    spans.push({ start: idx, end });
  }
  return spans;
}

export type DeprecationScanStatus = "clear" | "known" | "flag" | "not_scanned";

export interface DeprecationScanResult {
  status: DeprecationScanStatus;
  mentioned: boolean;
  /** Future dates found next to the model id. */
  futureDates: string[];
  /** Future dates that are neither the registry shutdownDate nor acknowledged. */
  unacknowledgedDates: string[];
  /** False when the registry has a shutdownDate that no longer appears on the page. */
  registryDateFound: boolean | null;
  snippet: string | null;
}

const BEFORE_WINDOW = 120;
const AFTER_WINDOW = 200;

/**
 * Where the shutdown date sits relative to the model id in a flattened table
 * row: OpenAI rows read "Dec 11, 2026 gpt-5-mini-2025-08-07 gpt-5.6-terra",
 * Gemini API / Vertex rows read "gemini-2.5-flash-image October 2, 2025 March 15, 2027 …".
 */
export const DEPRECATION_ROW_LAYOUT: Record<ModelProvider, "date-before-id" | "date-after-id"> = {
  openai: "date-before-id",
  google: "date-after-id",
  "google-vertex": "date-after-id",
};

/**
 * Heuristic scan of a provider deprecation page. Rows on the OpenAI, Gemini
 * API and Vertex pages are flattened text such as
 * "Dec 11, 2026 gpt-5-mini-2025-08-07 gpt-5.6-terra" or
 * "gemini-2.5-flash June 17, 2025 No shutdown date announced".
 * Only the side of the id where the provider puts the date is read, and it is
 * cut at the neighbouring model token so adjacent rows' dates are not
 * attributed to this model.
 */
export function scanDeprecationText(
  text: string,
  entry: ModelRegistryEntry,
  now: Date,
  layout: "date-before-id" | "date-after-id" = DEPRECATION_ROW_LAYOUT[entry.provider],
): DeprecationScanResult {
  const mentions = findModelMentions(text, entry.id);
  const tokens = modelTokenSpans(text);
  const today = utcDayStart(now);
  const isFuture = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d) > today;
  };

  const known = new Set<string>([
    ...(entry.lifecycle.shutdownDate ? [entry.lifecycle.shutdownDate] : []),
    ...(entry.lifecycle.acknowledgedDates ?? []),
  ]);

  const future = new Set<string>();
  const nearby = new Set<string>();
  let flaggedSnippet: string | null = null;
  let firstSnippet: string | null = null;

  for (const mention of mentions) {
    const prevToken = [...tokens].reverse().find((t) => t.end <= mention.start);
    const nextToken = tokens.find((t) => t.start >= mention.end);
    const context =
      layout === "date-before-id"
        ? text.slice(Math.max(prevToken ? prevToken.end : 0, mention.start - BEFORE_WINDOW), mention.start)
        : text.slice(mention.end, Math.min(nextToken ? nextToken.start : text.length, mention.end + AFTER_WINDOW));
    const dates = extractDates(context);
    dates.forEach((d) => nearby.add(d));
    const snippet = text.slice(Math.max(0, mention.start - 80), Math.min(text.length, mention.end + 160)).trim();
    firstSnippet ??= snippet;
    for (const d of dates.filter(isFuture)) {
      future.add(d);
      if (!known.has(d)) flaggedSnippet ??= snippet;
    }
  }

  const futureDates = [...future].sort();
  const unacknowledgedDates = futureDates.filter((d) => !known.has(d));
  const registryDateFound = entry.lifecycle.shutdownDate ? nearby.has(entry.lifecycle.shutdownDate) : null;

  let status: DeprecationScanStatus = "clear";
  if (unacknowledgedDates.length > 0 || registryDateFound === false) status = "flag";
  else if (futureDates.length > 0) status = "known";

  return {
    status,
    mentioned: mentions.length > 0,
    futureDates,
    unacknowledgedDates,
    registryDateFound,
    snippet: status === "flag" ? flaggedSnippet ?? firstSnippet : null,
  };
}

// ── Pricing excerpts ───────────────────────────────────────────────────────

/** Collects merged windows around keyword hits, capped at `maxChars`. */
export function extractRelevantText(text: string, keywords: string[], windowChars: number, maxChars: number): string {
  const spans: Span[] = [];
  for (const kw of keywords) {
    let from = 0;
    while (true) {
      const idx = text.indexOf(kw, from);
      if (idx === -1) break;
      spans.push({ start: Math.max(0, idx - windowChars), end: Math.min(text.length, idx + kw.length + windowChars) });
      from = idx + kw.length;
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  let out = "";
  for (const s of merged) {
    const piece = text.slice(s.start, s.end);
    if (out.length + piece.length + 5 > maxChars) {
      out += (out ? " … " : "") + piece.slice(0, Math.max(0, maxChars - out.length - 5));
      break;
    }
    out += (out ? " … " : "") + piece;
  }
  return out;
}

export const PRICING_KEYWORDS: Record<ModelProvider, string[]> = {
  openai: ["gpt-", "GPT-", "tts", "TTS", "transcribe", "Transcribe", "realtime", "Realtime", "whisper", "Whisper"],
  google: ["Gemini", "gemini-", "Flash"],
  "google-vertex": ["Image", "image"],
};

// ── Model list helpers ─────────────────────────────────────────────────────

/** Normalises provider model resource names ("models/x", "publishers/google/models/x") to bare ids. */
export function normaliseModelIds(names: string[]): string[] {
  return [...new Set(names.map((n) => n.replace(/^.*\/models\//, "").replace(/^models\//, "").trim()).filter(Boolean))];
}

/** Newest stable `gemini-<major>[.<minor>]-flash` id in the list, or `fallback`. */
export function pickAdvisorModel(available: string[], fallback: string): string {
  let best: { id: string; v: number } | null = null;
  for (const id of available) {
    const m = /^gemini-(\d+)(?:\.(\d+))?-flash$/.exec(id);
    if (!m) continue;
    const v = Number(m[1]) * 1000 + Number(m[2] ?? 0);
    if (!best || v > best.v) best = { id, v };
  }
  return best?.id ?? fallback;
}

// ── Advisor ────────────────────────────────────────────────────────────────

export type AdvisorVerdict = "keep" | "switch" | "evaluate";
export type MigrationEffort = "drop-in" | "params" | "api-change";
export type Confidence = "low" | "medium" | "high";

export interface AdvisorRecommendation {
  role: string;
  currentModel: string;
  verdict: AdvisorVerdict;
  suggestedModel: string | null;
  suggestedProvider: ModelProvider | null;
  reason: string;
  costComparison: string;
  qualityEvidence: string;
  migrationEffort: MigrationEffort | null;
  confidence: Confidence;
  /** Notes added by validation (never by the LLM). */
  validationNotes: string[];
}

export interface AdvisorPromptInput {
  entries: ModelRegistryEntry[];
  availableModels: Partial<Record<ModelProvider, string[] | null>>;
  pricingExcerpts: Partial<Record<ModelProvider, string>>;
  now: Date;
}

export function buildAdvisorSystemPrompt(): string {
  return [
    "You are a pragmatic ML platform engineer reviewing which AI models a production EdTech app (Edooqoo, ESL worksheet and tutoring platform) uses.",
    "For every registry role decide whether the current model is still the best fit for that use case.",
    "Decision rules:",
    "- verdict \"switch\" when a newer model available from a provider the app already uses is: (a) better and cheaper, or (b) better at the same price, or",
    `  (c) at most ${ADVISOR_MAX_PRICE_INCREASE_PCT}% more expensive for this workload but clearly and measurably better for this specific use case.`,
    "- verdict \"switch\" is also required when the current model has an announced shutdown date; pick the best replacement for the use case.",
    "- verdict \"evaluate\" when a candidate looks promising but evidence is thin, or the change needs an A/B quality test (e.g. long JSON generation).",
    "- verdict \"keep\" otherwise. Do not recommend change for its own sake.",
    "Constraints:",
    "- Only suggest model ids that appear in the AVAILABLE MODELS list for that provider. Prefer the same provider; a cross-provider switch is migrationEffort \"api-change\".",
    "- Respect the use case: latency for live paths, JSON mode and large output budgets for worksheet generation, audio endpoints for TTS/STT.",
    "- Never recommend preview, experimental or dated-preview ids for production.",
    "- Base prices on the PRICING EXCERPTS; use Google Search only for quality/benchmark evidence or missing prices, and say which.",
    "Return ONLY a JSON object, no prose, matching:",
    '{"recommendations":[{"role":string,"currentModel":string,"verdict":"keep"|"switch"|"evaluate","suggestedModel":string|null,"suggestedProvider":"openai"|"google"|"google-vertex"|null,"reason":string,"costComparison":string,"qualityEvidence":string,"migrationEffort":"drop-in"|"params"|"api-change"|null,"confidence":"low"|"medium"|"high"}]}',
    "Keep each text field under 300 characters. One recommendation per role.",
  ].join("\n");
}

export function buildAdvisorUserPrompt(input: AdvisorPromptInput): string {
  const today = new Date(utcDayStart(input.now)).toISOString().slice(0, 10);
  const roles = input.entries.map((e) => ({
    role: e.role,
    currentModel: e.id,
    provider: e.provider,
    useCase: e.useCase,
    consumers: e.consumers,
    shutdownDate: e.lifecycle.shutdownDate,
    providerRecommendedReplacement: e.lifecycle.replacement,
    lifecycleNote: e.lifecycle.note ?? null,
  }));
  const available = (Object.keys(input.availableModels) as ModelProvider[]).map((p) => {
    const ids = input.availableModels[p];
    return `${p}: ${ids && ids.length ? ids.join(", ") : "(list unavailable — mark suggestions as evaluate)"}`;
  });
  const pricing = (Object.keys(input.pricingExcerpts) as ModelProvider[]).map(
    (p) => `### ${p}\n${input.pricingExcerpts[p] || "(pricing page unavailable)"}`,
  );
  return [
    `TODAY: ${today}`,
    "",
    "REGISTRY ROLES (JSON):",
    JSON.stringify(roles, null, 1),
    "",
    "AVAILABLE MODELS (live provider model lists):",
    ...available,
    "",
    "PRICING EXCERPTS (text scraped from official pricing pages):",
    ...pricing,
  ].join("\n");
}

/** Extracts the first JSON object from an LLM response (handles ```json fences and prose). */
export function extractJsonObject(text: string): unknown | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

const VERDICTS = new Set(["keep", "switch", "evaluate"]);
const EFFORTS = new Set(["drop-in", "params", "api-change"]);
const CONFIDENCES = new Set(["low", "medium", "high"]);
const PROVIDERS = new Set(["openai", "google", "google-vertex"]);

function str(v: unknown, max = 400): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/**
 * Normalises the advisor output against the registry and the live model lists.
 * Guarantees exactly one recommendation per registry entry; a suggested id
 * that the provider does not list is downgraded to "evaluate".
 */
export function validateAdvisorRecommendations(
  raw: unknown,
  entries: ModelRegistryEntry[],
  availableModels: Partial<Record<ModelProvider, string[] | null>>,
): AdvisorRecommendation[] {
  const list: unknown[] =
    raw && typeof raw === "object" && Array.isArray((raw as { recommendations?: unknown }).recommendations)
      ? (raw as { recommendations: unknown[] }).recommendations
      : [];
  const byRole = new Map<string, Record<string, unknown>>();
  for (const item of list) {
    if (item && typeof item === "object") {
      const role = str((item as Record<string, unknown>).role, 80);
      if (role && !byRole.has(role)) byRole.set(role, item as Record<string, unknown>);
    }
  }

  return entries.map((entry) => {
    const item = byRole.get(entry.role);
    if (!item) {
      return {
        role: entry.role,
        currentModel: entry.id,
        verdict: "keep" as const,
        suggestedModel: null,
        suggestedProvider: null,
        reason: "",
        costComparison: "",
        qualityEvidence: "",
        migrationEffort: null,
        confidence: "low" as const,
        validationNotes: ["Advisor returned no recommendation for this role."],
      };
    }
    const notes: string[] = [];
    let verdict = (VERDICTS.has(item.verdict as string) ? item.verdict : "evaluate") as AdvisorVerdict;
    let suggestedModel = str(item.suggestedModel, 120) || null;
    const suggestedProvider = (PROVIDERS.has(item.suggestedProvider as string)
      ? item.suggestedProvider
      : suggestedModel ? entry.provider : null) as ModelProvider | null;

    if (suggestedModel === entry.id) {
      suggestedModel = null;
      if (verdict !== "keep") {
        notes.push("Suggested model equals the current model; treated as keep.");
        verdict = "keep";
      }
    }
    if (verdict !== "keep" && !suggestedModel) {
      notes.push("No suggested model given.");
      verdict = "evaluate";
    }
    if (suggestedModel && suggestedProvider) {
      const ids = availableModels[suggestedProvider];
      if (!ids || ids.length === 0) {
        notes.push(`Availability of ${suggestedModel} not verified (${suggestedProvider} model list unavailable).`);
      } else if (!ids.includes(suggestedModel)) {
        notes.push(`${suggestedModel} is not in the live ${suggestedProvider} model list for this key.`);
        if (verdict === "switch") verdict = "evaluate";
      }
      if (/preview|exp(erimental)?\b/i.test(suggestedModel)) {
        notes.push("Suggested id looks like a preview/experimental model.");
        if (verdict === "switch") verdict = "evaluate";
      }
    }
    if (entry.protectedEngine && verdict !== "keep") {
      notes.push('Touches the Worksheet Generation Engine: requires the instruction "update the Worksheet Generation Engine".');
    }

    return {
      role: entry.role,
      currentModel: entry.id,
      verdict,
      suggestedModel,
      suggestedProvider: suggestedModel ? suggestedProvider : null,
      reason: str(item.reason),
      costComparison: str(item.costComparison),
      qualityEvidence: str(item.qualityEvidence),
      migrationEffort: (EFFORTS.has(item.migrationEffort as string) ? item.migrationEffort : null) as MigrationEffort | null,
      confidence: (CONFIDENCES.has(item.confidence as string) ? item.confidence : "low") as Confidence,
      validationNotes: notes,
    };
  });
}

// ── Report rendering ───────────────────────────────────────────────────────

export interface ProbeResultRow {
  provider: string;
  model: string;
  role: string;
  purpose: string;
  probe: string;
  status: number;
  latency_ms: number;
  error: string | null;
  category: ProbeCategory;
  ok: boolean;
}

export interface LifecycleRow {
  provider: string;
  model: string;
  role: string;
  shutdownDate: string | null;
  replacement: string | null;
  note: string | null;
  status: LifecycleStatus;
  protectedEngine: boolean;
}

export interface DeprecationScanRow {
  provider: string;
  model: string;
  result: DeprecationScanResult;
  pageError: string | null;
}

export interface AdvisorReport {
  model: string | null;
  error: string | null;
  recommendations: AdvisorRecommendation[];
}

export interface AuditReportInput {
  mode: "daily" | "monthly";
  probes: ProbeResultRow[];
  lifecycle: LifecycleRow[];
  deprecationScan: DeprecationScanRow[] | null;
  advisor: AdvisorReport | null;
  unregistered: string[];
}

export interface AuditSummary {
  total: number;
  ok: number;
  failed: number;
  shutdownCrit: number;
  shutdownWarn: number;
  scanFlags: number;
  switchSuggestions: number;
  evaluateSuggestions: number;
}

export function summariseAudit(input: AuditReportInput): AuditSummary {
  return {
    total: input.probes.length,
    ok: input.probes.filter((p) => p.ok).length,
    failed: input.probes.filter((p) => !p.ok).length,
    shutdownCrit: input.lifecycle.filter((l) => l.status.level === "crit" || l.status.level === "past").length,
    shutdownWarn: input.lifecycle.filter((l) => l.status.level === "warn").length,
    scanFlags: (input.deprecationScan ?? []).filter((s) => s.result.status === "flag" || s.pageError).length,
    switchSuggestions: (input.advisor?.recommendations ?? []).filter((r) => r.verdict === "switch").length,
    evaluateSuggestions: (input.advisor?.recommendations ?? []).filter((r) => r.verdict === "evaluate").length,
  };
}

/**
 * Email policy: the monthly optimisation report is always sent; the daily
 * "does it work" run is silent unless at least one probe failed.
 */
export function shouldSendAuditEmail(mode: "daily" | "monthly", summary: Pick<AuditSummary, "failed">): boolean {
  return mode === "monthly" || summary.failed > 0;
}

const TD = 'style="padding:6px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;"';
const TH = 'style="padding:6px 10px;text-align:left;background:#f3f4f6;"';
const TABLE = 'style="border-collapse:collapse;width:100%;font-size:13px;margin:0 0 18px;"';

function badge(label: string, colour: string): string {
  return `<b style="color:${colour};">${escapeHtml(label)}</b>`;
}

function table(headers: string[], rows: string[][]): string {
  return `<table ${TABLE}><thead><tr>${headers.map((h) => `<th ${TH}>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td ${TD}>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

const CATEGORY_LABEL: Record<ProbeCategory, string> = {
  ok: "OK",
  deprecated: "FAIL · removed (404/410)",
  auth: "FAIL · auth/billing",
  rate_limited: "FAIL · quota (429)",
  server: "FAIL · provider 5xx",
  client: "FAIL · bad request",
  missing_key: "FAIL · secret missing",
  network: "FAIL · network",
};

/** Renders the email body. All dynamic values are HTML-escaped. */
export function renderAuditReportHtml(input: AuditReportInput): string {
  const s = summariseAudit(input);
  const parts: string[] = [];

  parts.push(
    input.mode === "monthly"
      ? `<div style="padding:10px 14px;border-radius:6px;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;font-size:13px;margin:0 0 14px;"><b>Monthly LLM Audit</b> — is every model still the best fit? Health probes, shutdown countdown, provider deprecation-page scan and model advisor.</div>`
      : `<div style="padding:10px 14px;border-radius:6px;background:#ecfeff;border:1px solid #a5f3fc;color:#155e75;font-size:13px;margin:0 0 14px;"><b>Daily LLM Audit</b> — does every model in production still work?</div>`,
  );

  // Advisor first in monthly mode: it is the actionable part.
  if (input.advisor) {
    parts.push(`<h3 style="margin:8px 0;">Model optimisation advice</h3>`);
    if (input.advisor.error) {
      parts.push(`<p style="color:#dc2626;">Advisor failed: ${escapeHtml(input.advisor.error)}</p>`);
    } else {
      parts.push(`<p style="color:#6b7280;font-size:12px;">Advisor model: <code>${escapeHtml(input.advisor.model)}</code>. Rule: switch only when better &amp; cheaper, better at the same price, or ≤${ADVISOR_MAX_PRICE_INCREASE_PCT}% more expensive with clearly better results.</p>`);
    }
    const order: Record<AdvisorVerdict, number> = { switch: 0, evaluate: 1, keep: 2 };
    const recs = [...input.advisor.recommendations].sort((a, b) => order[a.verdict] - order[b.verdict]);
    parts.push(
      table(
        ["Role", "Current", "Verdict", "Suggested", "Why", "Cost", "Quality evidence", "Effort / confidence"],
        recs.map((r) => [
          escapeHtml(r.role),
          `<code>${escapeHtml(r.currentModel)}</code>`,
          r.verdict === "switch" ? badge("SWITCH", "#dc2626") : r.verdict === "evaluate" ? badge("EVALUATE", "#b45309") : badge("KEEP", "#16a34a"),
          r.suggestedModel ? `<code>${escapeHtml(r.suggestedModel)}</code>${r.suggestedProvider ? ` <span style="color:#6b7280;">(${escapeHtml(r.suggestedProvider)})</span>` : ""}` : "—",
          escapeHtml(r.reason) + (r.validationNotes.length ? `<div style="color:#b45309;font-size:11px;margin-top:4px;">${r.validationNotes.map(escapeHtml).join("<br>")}</div>` : ""),
          escapeHtml(r.costComparison),
          escapeHtml(r.qualityEvidence),
          `${escapeHtml(r.migrationEffort ?? "—")} / ${escapeHtml(r.confidence)}`,
        ]),
      ),
    );
  }

  // Lifecycle: monthly shows everything, daily only urgent rows.
  const lifecycleRows = input.lifecycle.filter((l) =>
    input.mode === "monthly" ? l.status.level !== "none" : l.status.level === "crit" || l.status.level === "past",
  );
  if (lifecycleRows.length) {
    parts.push(`<h3 style="margin:8px 0;">Upcoming shutdowns</h3>`);
    parts.push(
      table(
        ["Model", "Role", "Shutdown", "Days left", "Replacement", "Note"],
        lifecycleRows
          .sort((a, b) => (a.status.daysToShutdown ?? 1e9) - (b.status.daysToShutdown ?? 1e9))
          .map((l) => {
            const colour = l.status.level === "ok" ? "#16a34a" : l.status.level === "warn" ? "#b45309" : "#dc2626";
            return [
              `<code>${escapeHtml(l.model)}</code> <span style="color:#6b7280;">(${escapeHtml(l.provider)})</span>`,
              escapeHtml(l.role) + (l.protectedEngine ? ' <span style="color:#7c3aed;font-size:11px;">[protected engine]</span>' : ""),
              escapeHtml(l.shutdownDate),
              badge(String(l.status.daysToShutdown), colour),
              l.replacement ? `<code>${escapeHtml(l.replacement)}</code>` : "—",
              escapeHtml(l.note ?? ""),
            ];
          }),
      ),
    );
  }

  if (input.deprecationScan) {
    const flagged = input.deprecationScan.filter((d) => d.result.status === "flag" || d.pageError);
    parts.push(`<h3 style="margin:8px 0;">Provider deprecation pages</h3>`);
    if (!flagged.length) {
      parts.push(`<p style="font-size:13px;color:#16a34a;">No new notices: every date found next to our model ids is already in the registry.</p>`);
    } else {
      parts.push(
        table(
          ["Model", "Finding", "Context"],
          flagged.map((d) => [
            `<code>${escapeHtml(d.model)}</code> <span style="color:#6b7280;">(${escapeHtml(d.provider)})</span>`,
            d.pageError
              ? badge(`Page fetch failed: ${d.pageError}`, "#b45309")
              : [
                  d.result.unacknowledgedDates.length ? badge(`New date(s): ${d.result.unacknowledgedDates.join(", ")}`, "#dc2626") : "",
                  d.result.registryDateFound === false ? badge("Registry shutdown date no longer on page", "#b45309") : "",
                ].filter(Boolean).join("<br>"),
            `<span style="font-size:11px;color:#6b7280;">${escapeHtml(d.result.snippet ?? "")}</span>`,
          ]),
        ),
      );
      parts.push(`<p style="font-size:12px;color:#6b7280;">Verify on the provider page, then update <code>supabase/functions/_shared/modelRegistry.ts</code>.</p>`);
    }
  }

  if (input.unregistered.length) {
    parts.push(`<p style="font-size:13px;color:#b45309;"><b>Not in registry:</b> ${input.unregistered.map((u) => `<code>${escapeHtml(u)}</code>`).join(", ")} — add to modelRegistry.ts.</p>`);
  }

  parts.push(`<h3 style="margin:8px 0;">Health probes (${s.ok}/${s.total} OK)</h3>`);
  parts.push(
    table(
      ["Provider", "Model", "Used for", "Probe", "HTTP", "Latency", "Status", "Error"],
      input.probes.map((p) => [
        escapeHtml(p.provider),
        `<code>${escapeHtml(p.model)}</code>`,
        escapeHtml(p.purpose),
        escapeHtml(p.probe),
        escapeHtml(p.status),
        `${escapeHtml(p.latency_ms)} ms`,
        badge(CATEGORY_LABEL[p.category], p.ok ? "#16a34a" : "#dc2626"),
        `<span style="font-size:11px;color:#6b7280;">${escapeHtml((p.error ?? "").slice(0, 160))}</span>`,
      ]),
    ),
  );

  return parts.join("\n");
}
