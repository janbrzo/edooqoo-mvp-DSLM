// v6.9.27 — Daily LLM provider health audit.
// Pings a minimal set of models across Lovable Gateway, OpenAI and Google,
// persists results in `model_health_checks` and surfaces deprecations via
// the StatusPage banner (which reads from error_logs / get_active_model_issues).
// Triggered by pg_cron at 06:00 UTC. Header `x-cron-secret` must match the
// CRON_SECRET project secret.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type Provider = "lovable-gateway" | "openai" | "google";
interface Target { provider: Provider; model: string; endpoint: string; }

// Daily set — cheap, fast, covers the hottest paths.
const TARGETS_DAILY: Target[] = [
  { provider: "lovable-gateway", model: "google/gemini-2.5-flash",      endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions" },
  { provider: "lovable-gateway", model: "google/gemini-2.5-flash-lite", endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions" },
  { provider: "lovable-gateway", model: "openai/gpt-5-mini",            endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions" },
  { provider: "openai",          model: "gpt-4o-mini",                  endpoint: "https://api.openai.com/v1/models/gpt-4o-mini" },
];

// Monthly set — full breadth. When adding a new model anywhere in the app,
// append it here. See docs/closed-loops/LLM_MODEL_INVENTORY.md (when present).
const TARGETS_MONTHLY: Target[] = [
  ...TARGETS_DAILY,
  { provider: "openai",          model: "gpt-4o-mini",                  endpoint: "https://api.openai.com/v1/models/gpt-4o-mini" },
  { provider: "openai",          model: "gpt-4o-mini-tts",              endpoint: "https://api.openai.com/v1/models/gpt-4o-mini-tts" },
  { provider: "openai",          model: "gpt-4.1-2025-04-14",           endpoint: "https://api.openai.com/v1/models/gpt-4.1-2025-04-14" },
  { provider: "openai",          model: "gpt-5-mini-2025-08-07",        endpoint: "https://api.openai.com/v1/models/gpt-5-mini-2025-08-07" },
  // v6.9.34 — `google/gemini-2.0-flash` was removed from Lovable AI Gateway.
  // Replaced with current default preview model.
  { provider: "lovable-gateway", model: "google/gemini-3-flash-preview", endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions" },
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
        [tokenField]: 1,
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
  const results: Array<Target & { status: number; latency_ms: number; error: string | null; ok: boolean }> = [];
  for (const target of targets) {
    const r = await ping(target);
    const ok = r.status >= 200 && r.status < 300;
    results.push({ ...target, ...r, ok });
    await sb.from("model_health_checks").insert({
      provider: target.provider,
      model: target.model,
      status: r.status,
      latency_ms: r.latency_ms,
      ok,
      error: r.error,
    });
    // Critical (deprecation 404/410) or 5xx → also log to error_logs so the
    // StatusPage banner picks it up immediately.
    if (!ok && (r.status === 404 || r.status === 410 || r.status >= 500)) {
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

  // Monthly mode → fire-and-forget email report.
  if (mode === "monthly") {
    try {
      const okCount = results.filter(r => r.ok).length;
      const failedCount = results.length - okCount;
      const rows = results.map(r => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${r.provider}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;"><code>${r.model}</code></td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.status}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.latency_ms} ms</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:${r.ok ? '#16a34a' : '#dc2626'};">${r.ok ? 'OK' : 'FAIL'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280;">${(r.error || '').slice(0, 120)}</td>
        </tr>`).join("");
      const reportHtml = `
        <table style="border-collapse:collapse;width:100%;font-size:13px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:6px 10px;text-align:left;">Provider</th>
            <th style="padding:6px 10px;text-align:left;">Model</th>
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
          summary: { total: results.length, ok: okCount, failed: failedCount },
          generatedAt: new Date().toISOString(),
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
      console.error("[audit-llm-models] monthly email build failed", e);
    }
  }

  return new Response(JSON.stringify({ ok: true, mode, checked: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});