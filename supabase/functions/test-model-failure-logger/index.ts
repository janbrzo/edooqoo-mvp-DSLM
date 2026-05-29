// v6.9.29 — Debug-only smoke test for logModelFailure. Auth: x-cron-secret.
// Inserts a sentinel row into error_logs so we can verify the logger pipeline end-to-end.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await logModelFailure({
    model: "sentinel/test-model",
    provider: "lovable-gateway",
    status: 503,
    endpoint: "https://example.invalid/test",
    error: "synthetic smoke-test from test-model-failure-logger",
    functionName: "test-model-failure-logger",
  });

  return new Response(JSON.stringify({ ok: true, note: "sentinel row inserted; remember to delete it manually" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});