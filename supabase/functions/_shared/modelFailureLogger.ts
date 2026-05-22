// v6.9.21 — Centralized provider-failure logger.
// Inserts a row into public.error_logs whenever an LLM/TTS provider returns
// 404/410 (deprecation) or 5xx (transient failure). Surfaces to /admin/error-logs
// and powers the StatusPage "Active model issues" banner.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function logModelFailure(opts: {
  model: string;
  provider: "openai" | "google" | "anthropic" | "elevenlabs" | "lovable-gateway" | string;
  status: number;
  endpoint: string;
  error: string;
  functionName: string;
}) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const sb = createClient(url, key);
    const severity =
      opts.status === 404 || opts.status === 410 ? "critical"
      : opts.status >= 500 ? "warning"
      : "info";
    const errorCode =
      opts.status === 404 || opts.status === 410 ? "model_deprecation" : "model_failure";
    await sb.from("error_logs").insert({
      severity,
      source: "edge-function",
      source_name: opts.functionName,
      component: opts.provider,
      error_code: errorCode,
      message: `${opts.provider} ${opts.model} → HTTP ${opts.status}`,
      context: {
        model: opts.model,
        provider: opts.provider,
        endpoint: opts.endpoint,
        status: opts.status,
        error: String(opts.error).slice(0, 1000),
      },
    });
  } catch (e) {
    console.error("[logModelFailure] insert failed:", e);
  }
}
