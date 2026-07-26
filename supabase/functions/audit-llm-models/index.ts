// v6.9.27 — Daily LLM provider health audit.
// Pings a minimal set of models across Lovable Gateway, OpenAI and Google,
// persists results in `model_health_checks` and surfaces deprecations via
// the StatusPage banner (which reads from error_logs / get_active_model_issues).
// Triggered by pg_cron at 06:00 UTC. Header `x-cron-secret` must match the
// CRON_SECRET project secret.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";
import { getVertexAccessToken } from "../_shared/vertexAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type Provider = "lovable-gateway" | "openai" | "google" | "google-vertex";
interface Target {
  provider: Provider;
  model: string;
  endpoint: string;
  purpose: string;
  /** Probe kept for observability only — a non-2xx here is not an incident. */
  optional?: boolean;
  /** Non-2xx statuses that are the documented, expected state for an optional probe. */
  expectedFailureStatuses?: number[];
}

// v6.9.66 — Daily set covers every model in the live hot path.
// Lovable Gateway removed from daily after aiChat helper migrated to
// Google Generative Language direct.
const TARGETS_DAILY: Target[] = [
  // Google Generative Language direct (primary chat via aiChat helper).
  { provider: "google",          model: "gemini-2.5-flash",             endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash",
    purpose: "Primary chat (aiChat helper: classify, suggest-exercises, verify-open-answers, curriculum, timeline, welcome-test, extract-profile) + generate-image description" },
  { provider: "google",          model: "gemini-2.5-flash-lite",        endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite",
    purpose: "Lightweight chat (translate-flashcard) + image description fallback" },
  // OpenAI direct (fallback path + worksheet/welcome-test premium).
  { provider: "openai",          model: "gpt-4o-mini",                  endpoint: "https://api.openai.com/v1/models/gpt-4o-mini",
    purpose: "OpenAI fallback for aiChat helper + generate-audio chat step" },
  { provider: "openai",          model: "gpt-5-mini-2025-08-07",        endpoint: "https://api.openai.com/v1/models/gpt-5-mini-2025-08-07",
    purpose: "generateWorksheet JSON fallback + welcome-test scoring" },
  { provider: "openai",          model: "gpt-4.1-2025-04-14",           endpoint: "https://api.openai.com/v1/models/gpt-4.1-2025-04-14",
    purpose: "generate-media-exercises (reading/listening passages)" },
  { provider: "openai",          model: "whisper-1",                    endpoint: "https://api.openai.com/v1/models/whisper-1",
    purpose: "transcribe-audio (live session STT)" },
  { provider: "openai",          model: "gpt-4o-mini-tts",              endpoint: "https://api.openai.com/v1/models/gpt-4o-mini-tts",
    purpose: "TTS primary (generate-audio)" },
  { provider: "openai",          model: "tts-1",                        endpoint: "https://api.openai.com/v1/models/tts-1",
    purpose: "TTS for generate-welcome-test-audio + generate-audio fallback" },
  // Vertex AI image — switched to v1beta1 publisher metadata endpoint (no
  // project prefix). The previous projects/<id>/publishers/... GET path
  // returned 404 because Vertex does not expose project-scoped publisher
  // metadata via GET — only :generateContent is project-scoped.
  { provider: "google-vertex",   model: "gemini-2.5-flash-image",       endpoint: "https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google/models/gemini-2.5-flash-image",
    purpose: "Worksheet image generation (Vertex AI primary)" },
];

// Monthly set — full breadth, includes fallbacks and the now-cold Lovable
// Gateway probe (kept for re-activation if/when workspace credits return).
const TARGETS_MONTHLY: Target[] = [
  ...TARGETS_DAILY,
  { provider: "google-vertex",   model: "gemini-3.1-flash-image",       endpoint: "https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google/models/gemini-3.1-flash-image",
    purpose: "Vertex AI image fallback (Nano Banana 2)" },
  { provider: "lovable-gateway", model: "google/gemini-2.5-flash",       endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
    purpose: "Lovable Gateway probe — currently unused, kept for re-activation when credits return",
    optional: true, expectedFailureStatuses: [401, 402, 403] },
  { provider: "lovable-gateway", model: "google/gemini-3-flash-preview", endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
    purpose: "Lovable AI default catalog model (audit probe only)",
    optional: true, expectedFailureStatuses: [401, 402, 403] },
];

async function ping(target: Target): Promise<{ status: number; latency_ms: number; error: string | null }> {
  const t0 = Date.now();
  try {
    if (target.provider === "openai") {
      const key = Deno.env.get("OPENAI_API_KEY");
      if (!key) return { status: -1, latency_ms: 0, error: "missing OPENAI_API_KEY" };
      const r = await fetch(target.endpoint, { headers: { Authorization: `Bearer ${key}` } });
      const err = r.ok ? null : (await r.text()).slice(0, 500);
      return { status: r.status, latency_ms: Date.now() - t0, error: err };
    }
    if (target.provider === "google") {
      const key = Deno.env.get("GEMINI_API_KEY");
      if (!key) return { status: -1, latency_ms: 0, error: "missing GEMINI_API_KEY" };
      // Generative Language models.get returns metadata if the key has access
      // — no inference cost, no token spend.
      const r = await fetch(`${target.endpoint}?key=${key}`);
      const err = r.ok ? null : (await r.text()).slice(0, 500);
      return { status: r.status, latency_ms: Date.now() - t0, error: err };
    }
    if (target.provider === "google-vertex") {
      const sa = Deno.env.get("GEMINI_VERTEX_API_KEY");
      if (!sa) return { status: -1, latency_ms: 0, error: "missing GEMINI_VERTEX_API_KEY" };
      try {
        const accessToken = await getVertexAccessToken(sa);
        // v6.9.66 — Vertex publisher metadata lives under v1beta1/publishers/google/models/<id>
        // (no project prefix). GET on the project-scoped path 404s by design.
        const r = await fetch(target.endpoint, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const err = r.ok ? null : (await r.text()).slice(0, 500);
        return { status: r.status, latency_ms: Date.now() - t0, error: err };
      } catch (e) {
        return { status: 0, latency_ms: Date.now() - t0, error: String((e as Error).message || e).slice(0, 500) };
      }
    }
    // Lovable gateway: minimal chat completion.
    // GPT-5 family rejects `max_tokens`; requires `max_completion_tokens` instead.
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return { status: -1, latency_ms: 0, error: "missing LOVABLE_API_KEY" };
    const isGpt5Family = target.model.startsWith("openai/gpt-5");
    const tokenField = isGpt5Family ? "max_completion_tokens" : "max_tokens";
    const r = await fetch(target.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: target.model,
        messages: [{ role: "user", content: "ping" }],
        // v6.9.35 — GPT-5 family burns reasoning tokens before any output.
        // 16 was still tripping the cap; 128 leaves room for a short ping.
        [tokenField]: isGpt5Family ? 128 : 1,
      }),
    });
    const err = r.ok ? null : (await r.text()).slice(0, 500);
    return { status: r.status, latency_ms: Date.now() - t0, error: err };
  } catch (e) {
    return { status: 0, latency_ms: Date.now() - t0, error: String((e as Error).message || e).slice(0, 500) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // In-code auth: require CRON_SECRET (since config.toml sets verify_jwt=false by default).
  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (expected && provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let mode: "daily" | "monthly" = "daily";
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.mode === "monthly") mode = "monthly";
    }
  } catch { /* ignore */ }

  const url = Deno.env.get("SUPABASE_URL")!;
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, srk);

  const targets = mode === "monthly" ? TARGETS_MONTHLY : TARGETS_DAILY;
  const results: Array<Target & { status: number; latency_ms: number; error: string | null; ok: boolean; expected: boolean }> = [];
  for (const target of targets) {
    const r = await ping(target);
    const ok = r.status >= 200 && r.status < 300;
    // v6.9.81 — three-state classification. An `optional` probe returning one of
    // its documented statuses (e.g. Lovable Gateway 402 while the workspace has
    // no credits) is EXPECTED, not a failure: it must not inflate the failed
    // count, must not colour the email red, and must never hit logModelFailure.
    const expected = !ok && target.optional === true &&
      (target.expectedFailureStatuses ?? []).includes(r.status);
    results.push({ ...target, ...r, ok, expected });
    await sb.from("model_health_checks").insert({
      provider: target.provider,
      model: target.model,
      status: r.status,
      latency_ms: r.latency_ms,
      ok,
      expected,
      error: r.error,
      purpose: target.purpose,
    });
    // Critical (deprecation 404/410) or 5xx → also log to error_logs so the
    // StatusPage banner picks it up immediately.
    if (!ok && !expected && (r.status === 404 || r.status === 410 || r.status >= 500)) {
      await logModelFailure({
        model: target.model,
        provider: target.provider,
        status: r.status,
        endpoint: target.endpoint,
        error: r.error ?? `HTTP ${r.status}`,
        functionName: "audit-llm-models",
      });
    }
  }

  // v6.9.37 — fire-and-forget email report in BOTH daily and monthly modes.
  // Subject is prefixed by mode in send-model-audit-email.
  {
    try {
      const okCount = results.filter(r => r.ok).length;
      const expectedCount = results.filter(r => r.expected).length;
      const failedCount = results.length - okCount - expectedCount;
      const rows = results.map(r => {
        const label = r.ok ? 'OK' : r.expected ? 'EXPECTED' : 'FAIL';
        const colour = r.ok ? '#16a34a' : r.expected ? '#b45309' : '#dc2626';
        const errorText = r.expected
          ? `probe only — intentionally unused, ${(r.error || '').slice(0, 80)}`
          : (r.error || '').slice(0, 120);
        return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${r.provider}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;"><code>${r.model}</code></td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${(r as any).purpose || ''}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.status}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.latency_ms} ms</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:${colour};">${label}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280;">${errorText}</td>
        </tr>`;
      }).join("");
      // v6.9.38 — explicit cadence banner so daily and monthly reports are
      // visually distinguishable in the inbox even when the model counts
      // happen to overlap.
      const modeBannerHtml = mode === 'monthly'
        ? `<div style="padding:10px 14px;border-radius:6px;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;font-size:13px;margin:0 0 12px;">
             <b>Monthly LLM Audit</b> — full inventory (${results.length} models, including TTS and legacy fallbacks). Runs on the 1st of each month.
           </div>`
        : `<div style="padding:10px 14px;border-radius:6px;background:#ecfeff;border:1px solid #a5f3fc;color:#155e75;font-size:13px;margin:0 0 12px;">
             <b>Daily LLM Audit</b> — hot-path subset (${results.length} models powering live worksheet generation, classification, OpenAI fallback). Runs daily at 06:00 UTC.
           </div>`;
      const reportHtml = `${modeBannerHtml}
        <table style="border-collapse:collapse;width:100%;font-size:13px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:6px 10px;text-align:left;">Provider</th>
            <th style="padding:6px 10px;text-align:left;">Model</th>
            <th style="padding:6px 10px;text-align:left;">Used for</th>
            <th style="padding:6px 10px;text-align:right;">HTTP</th>
            <th style="padding:6px 10px;text-align:right;">Latency</th>
            <th style="padding:6px 10px;text-align:left;">Status</th>
            <th style="padding:6px 10px;text-align:left;">Error</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      const emailPromise = fetch(`${url}/functions/v1/send-model-audit-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-call": expected || "",
        },
        body: JSON.stringify({
          reportHtml,
          summary: { total: results.length, ok: okCount, expected: expectedCount, failed: failedCount },
          generatedAt: new Date().toISOString(),
          mode,
        }),
      })
        .then(async (r) => console.log("[audit-llm-models] email dispatch status", r.status, (await r.text()).slice(0, 300)))
        .catch((e) => console.error("[audit-llm-models] email dispatch failed", e));
      // @ts-ignore EdgeRuntime is provided by Supabase Edge runtime
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(emailPromise);
      } else {
        await emailPromise;
      }
    } catch (e) {
      console.error("[audit-llm-models] email build failed", e);
    }
  }

  return new Response(JSON.stringify({ ok: true, mode, checked: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});