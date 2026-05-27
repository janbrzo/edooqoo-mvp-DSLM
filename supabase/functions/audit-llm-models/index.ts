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

const TARGETS: Target[] = [
  { provider: "lovable-gateway", model: "google/gemini-2.5-flash",      endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions" },
  { provider: "lovable-gateway", model: "google/gemini-2.5-flash-lite", endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions" },
  { provider: "lovable-gateway", model: "openai/gpt-5-mini",            endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions" },
  { provider: "openai",          model: "gpt-4o-mini",                  endpoint: "https://api.openai.com/v1/models/gpt-4o-mini" },
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
    // Lovable gateway: minimal chat completion
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return { status: -1, latency_ms: 0, error: "missing LOVABLE_API_KEY" };
    const r = await fetch(target.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: target.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
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

  const url = Deno.env.get("SUPABASE_URL")!;
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, srk);

  const results = [];
  for (const target of TARGETS) {
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

  return new Response(JSON.stringify({ ok: true, checked: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});