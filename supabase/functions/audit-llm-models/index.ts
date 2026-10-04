// v6.9.90 — LLM model audit (daily health + monthly optimisation).
//
// Daily  (pg_cron 06:00 UTC, body {}):          does every production model still work?
//   - one probe per model from _shared/modelRegistry.ts (minimal inference for
//     text/TTS models, metadata GET for STT/image models),
//   - urgent (<=30 days) shutdown alerts from the registry.
// Monthly (pg_cron 1st of month, body {"mode":"monthly"}): is every model still the best fit?
//   - everything from daily, plus the full shutdown countdown,
//   - a scan of the official provider deprecation pages for dates the registry
//     does not know yet,
//   - an LLM advisor (newest Gemini Flash + Google Search grounding) that reads
//     live provider model lists and pricing pages and suggests a switch when a
//     model is better & cheaper, better at the same price, or slightly more
//     expensive with clearly better results.
// Monthly work runs in the background (EdgeRuntime.waitUntil) unless the body
// contains {"sync": true}.
//
// Results: model_health_checks (one row per probe), model_audit_reports (one
// row per run), error_logs (failures + scheduled shutdowns) and an email via
// send-model-audit-email. Auth: header `x-cron-secret` must equal CRON_SECRET.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";
import { getVertexAccessToken } from "../_shared/vertexAuth.ts";
import {
  DEPRECATION_PAGES,
  MODEL_ENV_OVERRIDES,
  MODEL_REGISTRY,
  PRICING_PAGES,
  type ModelProvider,
  type ModelRegistryEntry,
  type ProbeKind,
} from "../_shared/modelRegistry.ts";
import {
  type AdvisorReport,
  type AuditReportInput,
  type DeprecationScanRow,
  type LifecycleRow,
  type ProbeResultRow,
  PRICING_KEYWORDS,
  buildAdvisorSystemPrompt,
  buildAdvisorUserPrompt,
  classifyLifecycle,
  classifyProbeStatus,
  extractJsonObject,
  extractRelevantText,
  normaliseModelIds,
  pickAdvisorModel,
  renderAuditReportHtml,
  scanDeprecationText,
  shouldLogProbeFailure,
  stripHtml,
  summariseAudit,
  validateAdvisorRecommendations,
} from "../_shared/modelAudit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const PROVIDERS: ModelProvider[] = ["openai", "google", "google-vertex"];
const FETCH_TIMEOUT_MS = 20_000;
const ADVISOR_TIMEOUT_MS = 90_000;
const ADVISOR_FALLBACK_MODEL = "gemini-2.5-flash";
const PRICING_EXCERPT_MAX_CHARS = 60_000;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const VERTEX_PUBLISHER_BASE = "https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google/models";

interface Target {
  provider: ModelProvider;
  model: string;
  role: string;
  purpose: string;
  probe: ProbeKind;
  entry: ModelRegistryEntry | null;
}

interface ProbeOutcome {
  status: number;
  latency_ms: number;
  error: string | null;
  endpoint: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timedFetch(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

async function errorText(r: Response): Promise<string | null> {
  if (r.ok) {
    await r.body?.cancel();
    return null;
  }
  return (await r.text()).slice(0, 500);
}

function metadataEndpoint(provider: ModelProvider, model: string): string {
  if (provider === "openai") return `https://api.openai.com/v1/models/${model}`;
  if (provider === "google") return `${GEMINI_BASE}/models/${model}`;
  return `${VERTEX_PUBLISHER_BASE}/${model}`;
}

// One Vertex access token per invocation.
let vertexTokenPromise: Promise<string> | null = null;
function vertexToken(): Promise<string> {
  const sa = Deno.env.get("GEMINI_VERTEX_API_KEY");
  if (!sa) return Promise.reject(new Error("missing GEMINI_VERTEX_API_KEY"));
  vertexTokenPromise ??= getVertexAccessToken(sa);
  return vertexTokenPromise;
}

async function probe(target: Target): Promise<ProbeOutcome> {
  const t0 = Date.now();
  const done = (status: number, error: string | null, endpoint: string): ProbeOutcome => ({
    status,
    latency_ms: Date.now() - t0,
    error,
    endpoint,
  });

  try {
    if (target.provider === "openai") {
      const key = Deno.env.get("OPENAI_API_KEY");
      if (!key) return done(-1, "missing OPENAI_API_KEY", "");
      const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

      if (target.probe === "openai-chat" || target.probe === "openai-chat-reasoning") {
        const endpoint = "https://api.openai.com/v1/chat/completions";
        const body = target.probe === "openai-chat"
          ? { model: target.model, messages: [{ role: "user", content: "Return OK." }], max_tokens: 3 }
          // Reasoning models reject max_tokens; keep the probe minimal.
          : { model: target.model, messages: [{ role: "user", content: "Return OK." }], max_completion_tokens: 16, reasoning_effort: "minimal" };
        const r = await timedFetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
        return done(r.status, await errorText(r), endpoint);
      }
      if (target.probe === "openai-tts") {
        const endpoint = "https://api.openai.com/v1/audio/speech";
        const r = await timedFetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ model: target.model, input: "OK", voice: "alloy", response_format: "mp3" }),
        });
        return done(r.status, await errorText(r), endpoint);
      }
      const endpoint = metadataEndpoint("openai", target.model);
      const r = await timedFetch(endpoint, { headers: { Authorization: `Bearer ${key}` } });
      return done(r.status, await errorText(r), endpoint);
    }

    if (target.provider === "google") {
      const key = Deno.env.get("GEMINI_API_KEY");
      if (!key) return done(-1, "missing GEMINI_API_KEY", "");
      if (target.probe === "gemini-generate") {
        const endpoint = `${GEMINI_BASE}/models/${target.model}:generateContent`;
        const r = await timedFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Return OK." }] }],
            generationConfig: { maxOutputTokens: 3, temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
          }),
        });
        return done(r.status, await errorText(r), endpoint);
      }
      // models.get returns metadata if the key has access — no token spend.
      const endpoint = metadataEndpoint("google", target.model);
      const r = await timedFetch(endpoint, { headers: { "x-goog-api-key": key } });
      return done(r.status, await errorText(r), endpoint);
    }

    // google-vertex: publisher metadata lives under v1beta1/publishers/google/models/<id>
    // (no project prefix). GET on the project-scoped path 404s by design.
    const endpoint = metadataEndpoint("google-vertex", target.model);
    let token: string;
    try {
      token = await vertexToken();
    } catch (e) {
      const msg = String((e as Error).message || e).slice(0, 500);
      return done(msg.startsWith("missing") ? -1 : 0, msg, endpoint);
    }
    const r = await timedFetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    return done(r.status, await errorText(r), endpoint);
  } catch (e) {
    return done(0, String((e as Error).message || e).slice(0, 500), "");
  }
}

function buildTargets(unregistered: string[]): Target[] {
  const targets: Target[] = MODEL_REGISTRY.map((entry) => ({
    provider: entry.provider,
    model: entry.id,
    role: entry.role,
    purpose: entry.useCase,
    probe: entry.probe,
    entry,
  }));
  for (const o of MODEL_ENV_OVERRIDES) {
    const value = Deno.env.get(o.envVar)?.trim();
    if (!value || o.ignoredValues?.includes(value)) continue;
    if (MODEL_REGISTRY.some((e) => e.id === value && e.provider === o.provider)) continue;
    unregistered.push(`${value} (${o.envVar})`);
    targets.push({
      provider: o.provider,
      model: value,
      role: o.role,
      purpose: `Runtime override from secret ${o.envVar} — not in modelRegistry.ts`,
      probe: "metadata",
      entry: null,
    });
  }
  return targets;
}

async function insertHealthRows(sb: SupabaseClient, rows: Record<string, unknown>[]) {
  const { error } = await sb.from("model_health_checks").insert(rows);
  if (!error) return;
  // Backward compatibility: the lifecycle columns arrive with migration
  // 20261004120000; keep recording health rows if it is not applied yet.
  console.error("[audit-llm-models] health insert failed, retrying without lifecycle columns:", error.message);
  const legacy = rows.map(({ check_kind: _c, shutdown_date: _s, days_to_shutdown: _d, ...rest }) => rest);
  const retry = await sb.from("model_health_checks").insert(legacy);
  if (retry.error) console.error("[audit-llm-models] legacy health insert failed:", retry.error.message);
}

async function logScheduledShutdowns(sb: SupabaseClient, rows: LifecycleRow[], mode: "daily" | "monthly") {
  const due = rows.filter((l) =>
    l.status.level === "crit" || l.status.level === "past" || (mode === "monthly" && l.status.level === "warn")
  );
  if (!due.length) return;
  // error_code 'model_shutdown_scheduled' is deliberately NOT read by
  // get_active_model_issues, so the public StatusPage banner stays quiet
  // until a model actually fails; admins see it in error_logs.
  const { error } = await sb.from("error_logs").insert(due.map((l) => ({
    severity: l.status.level === "warn" ? "warning" : "critical",
    source: "edge_function",
    source_name: "audit-llm-models",
    component: l.provider,
    error_code: "model_shutdown_scheduled",
    message: `${l.provider} ${l.model} shuts down on ${l.shutdownDate} (${l.status.daysToShutdown} days)`,
    context: {
      model: l.model,
      provider: l.provider,
      role: l.role,
      shutdown_date: l.shutdownDate,
      days_to_shutdown: l.status.daysToShutdown,
      replacement: l.replacement,
      protected_engine: l.protectedEngine,
    },
  })));
  if (error) console.error("[audit-llm-models] shutdown log insert failed:", error.message);
}

async function fetchPageText(url: string): Promise<string> {
  const r = await timedFetch(url, { headers: { "User-Agent": "EdooqooModelAudit/1.0", Accept: "text/html" } });
  if (!r.ok) {
    await r.body?.cancel();
    throw new Error(`HTTP ${r.status}`);
  }
  return stripHtml(await r.text());
}

async function runDeprecationScan(now: Date): Promise<DeprecationScanRow[]> {
  const pages = await Promise.all(PROVIDERS.map(async (p) => {
    try {
      return { provider: p, text: await fetchPageText(DEPRECATION_PAGES[p]), error: null as string | null };
    } catch (e) {
      return { provider: p, text: "", error: String((e as Error).message || e).slice(0, 200) };
    }
  }));
  const byProvider = new Map(pages.map((p) => [p.provider, p]));
  return MODEL_REGISTRY.map((entry) => {
    const page = byProvider.get(entry.provider)!;
    return {
      provider: entry.provider,
      model: entry.id,
      pageError: page.error,
      result: page.error
        ? { status: "not_scanned" as const, mentioned: false, futureDates: [], unacknowledgedDates: [], registryDateFound: null, snippet: null }
        : scanDeprecationText(page.text, entry, now),
    };
  });
}

async function listAvailableModels(): Promise<Record<ModelProvider, string[] | null>> {
  const openai = (async () => {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return null;
    const r = await timedFetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return (await r.body?.cancel(), null);
    const data = await r.json();
    // Drop fine-tunes and org-scoped ids; they are never advisor candidates.
    return normaliseModelIds((data?.data ?? []).map((m: { id: string }) => m.id).filter((id: string) => !id.includes(":")));
  })();

  const google = (async () => {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return null;
    const names: string[] = [];
    let pageToken = "";
    for (let i = 0; i < 5; i++) {
      const r = await timedFetch(`${GEMINI_BASE}/models?pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ""}`, {
        headers: { "x-goog-api-key": key },
      });
      if (!r.ok) return (await r.body?.cancel(), names.length ? normaliseModelIds(names) : null);
      const data = await r.json();
      names.push(...(data?.models ?? []).map((m: { name: string }) => m.name));
      pageToken = data?.nextPageToken ?? "";
      if (!pageToken) break;
    }
    return normaliseModelIds(names);
  })();

  const vertex = (async () => {
    const token = await vertexToken();
    const r = await timedFetch(`${VERTEX_PUBLISHER_BASE}?pageSize=300`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return (await r.body?.cancel(), null);
    const data = await r.json();
    return normaliseModelIds((data?.publisherModels ?? []).map((m: { name: string }) => m.name));
  })();

  const settle = async (p: Promise<string[] | null>) => {
    try {
      return await p;
    } catch (e) {
      console.error("[audit-llm-models] model list failed:", (e as Error).message);
      return null;
    }
  };
  const [o, g, v] = await Promise.all([settle(openai), settle(google), settle(vertex)]);
  return { openai: o, google: g, "google-vertex": v };
}

async function fetchPricingExcerpts(): Promise<Partial<Record<ModelProvider, string>>> {
  const out: Partial<Record<ModelProvider, string>> = {};
  await Promise.all(PROVIDERS.map(async (p) => {
    try {
      out[p] = extractRelevantText(await fetchPageText(PRICING_PAGES[p]), PRICING_KEYWORDS[p], 400, PRICING_EXCERPT_MAX_CHARS);
    } catch (e) {
      console.error(`[audit-llm-models] pricing page ${p} failed:`, (e as Error).message);
      out[p] = "";
    }
  }));
  return out;
}

async function callGemini(model: string, system: string, user: string, withSearch: boolean): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("missing GEMINI_API_KEY");
  const r = await timedFetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      ...(withSearch ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: { temperature: 0.2, maxOutputTokens: 16384 },
    }),
  }, ADVISOR_TIMEOUT_MS);
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  const parts: Array<{ text?: string; thought?: boolean }> = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  if (!text) throw new Error(`empty response (finishReason=${data?.candidates?.[0]?.finishReason ?? "unknown"})`);
  return text;
}

async function runAdvisor(now: Date): Promise<AdvisorReport> {
  const [availableModels, pricingExcerpts] = await Promise.all([listAvailableModels(), fetchPricingExcerpts()]);
  const system = buildAdvisorSystemPrompt();
  const user = buildAdvisorUserPrompt({ entries: MODEL_REGISTRY, availableModels, pricingExcerpts, now });

  const preferred = Deno.env.get("MODEL_ADVISOR_MODEL")?.trim() ||
    pickAdvisorModel(availableModels.google ?? [], ADVISOR_FALLBACK_MODEL);
  const attempts: Array<{ model: string; search: boolean }> = [
    { model: preferred, search: true },
    { model: preferred, search: false },
    ...(preferred !== ADVISOR_FALLBACK_MODEL ? [{ model: ADVISOR_FALLBACK_MODEL, search: true }] : []),
  ];

  const errors: string[] = [];
  for (const a of attempts) {
    try {
      const text = await callGemini(a.model, system, user, a.search);
      const parsed = extractJsonObject(text);
      if (!parsed) throw new Error("response did not contain a JSON object");
      return {
        model: `${a.model}${a.search ? " + Google Search" : ""}`,
        error: null,
        recommendations: validateAdvisorRecommendations(parsed, MODEL_REGISTRY, availableModels),
      };
    } catch (e) {
      errors.push(`${a.model}${a.search ? "+search" : ""}: ${String((e as Error).message || e).slice(0, 200)}`);
    }
  }
  return {
    model: null,
    error: errors.join(" | "),
    recommendations: validateAdvisorRecommendations(null, MODEL_REGISTRY, availableModels),
  };
}

async function runAudit(mode: "daily" | "monthly") {
  const now = new Date();
  vertexTokenPromise = null; // warm isolates are reused; never carry a token across runs
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const unregistered: string[] = [];
  const targets = buildTargets(unregistered);

  // ── Health probes (both modes) ──
  const outcomes = await Promise.all(targets.map(probe));
  const lifecycle: LifecycleRow[] = MODEL_REGISTRY.map((e) => ({
    provider: e.provider,
    model: e.id,
    role: e.role,
    shutdownDate: e.lifecycle.shutdownDate,
    replacement: e.lifecycle.replacement,
    note: e.lifecycle.note ?? null,
    status: classifyLifecycle(e.lifecycle, now),
    protectedEngine: !!e.protectedEngine,
  }));

  const probes: ProbeResultRow[] = targets.map((t, i) => {
    const o = outcomes[i];
    const category = classifyProbeStatus(o.status);
    return {
      provider: t.provider,
      model: t.model,
      role: t.role,
      purpose: t.purpose,
      probe: t.probe,
      status: o.status,
      latency_ms: o.latency_ms,
      error: o.error,
      category,
      ok: category === "ok",
    };
  });

  await insertHealthRows(sb, probes.map((p, i) => {
    const life = targets[i].entry ? classifyLifecycle(targets[i].entry!.lifecycle, now) : null;
    return {
      provider: p.provider,
      model: p.model,
      status: p.status,
      latency_ms: p.latency_ms,
      ok: p.ok,
      expected: false,
      error: p.error,
      purpose: p.purpose,
      check_kind: p.probe,
      shutdown_date: targets[i].entry?.lifecycle.shutdownDate ?? null,
      days_to_shutdown: life?.daysToShutdown ?? null,
    };
  }));

  // Failures that break live workflows → error_logs → StatusPage banner.
  await Promise.all(probes.map((p, i) =>
    shouldLogProbeFailure(p.category)
      ? logModelFailure({
        model: p.model,
        provider: p.provider,
        status: p.status,
        endpoint: outcomes[i].endpoint,
        error: p.error ?? `HTTP ${p.status}`,
        functionName: "audit-llm-models",
      })
      : Promise.resolve()
  ));
  await logScheduledShutdowns(sb, lifecycle, mode);

  // ── Monthly optimisation ──
  let deprecationScan: DeprecationScanRow[] | null = null;
  let advisor: AdvisorReport | null = null;
  if (mode === "monthly") {
    [deprecationScan, advisor] = await Promise.all([runDeprecationScan(now), runAdvisor(now)]);
  }

  const report: AuditReportInput = { mode, probes, lifecycle, deprecationScan, advisor, unregistered };
  const summary = summariseAudit(report);

  const stored = await sb.from("model_audit_reports").insert({
    mode,
    summary,
    probes,
    lifecycle,
    deprecation_scan: deprecationScan,
    advisor,
    unregistered,
  });
  if (stored.error) console.error("[audit-llm-models] report insert failed:", stored.error.message);

  try {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-model-audit-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-call": Deno.env.get("CRON_SECRET") ?? "" },
      body: JSON.stringify({ reportHtml: renderAuditReportHtml(report), summary, generatedAt: now.toISOString(), mode }),
    });
    console.log("[audit-llm-models] email dispatch status", r.status, (await r.text()).slice(0, 300));
  } catch (e) {
    console.error("[audit-llm-models] email dispatch failed", e);
  }

  return { ok: true, mode, checked: probes.length, summary, results: probes, lifecycle, deprecationScan, advisor, unregistered };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Fail closed: verify_jwt=false in config.toml, so the secret is the only gate.
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) return json({ error: "CRON_SECRET not configured" }, 503);
  if (req.headers.get("x-cron-secret") !== expected) return json({ error: "unauthorized" }, 401);

  let mode: "daily" | "monthly" = "daily";
  let sync = false;
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (body?.mode === "monthly") mode = "monthly";
    sync = body?.sync === true;
  }

  // Daily finishes in ~10 s and runs inline. Monthly (page scans + advisor)
  // runs in the background so pg_net's short HTTP timeout cannot cut it off.
  if (mode === "monthly" && !sync) {
    const task = runAudit(mode).catch((e) => console.error("[audit-llm-models] monthly run failed", e));
    // @ts-ignore EdgeRuntime is provided by the Supabase Edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(task);
      return json({ ok: true, mode, accepted: true, note: "Running in background; results arrive by email and in model_audit_reports." }, 202);
    }
    await task;
    return json({ ok: true, mode, accepted: true });
  }

  try {
    return json(await runAudit(mode));
  } catch (e) {
    console.error("[audit-llm-models] run failed", e);
    return json({ ok: false, mode, error: String((e as Error).message || e) }, 500);
  }
});
