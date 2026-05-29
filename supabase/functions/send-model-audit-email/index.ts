// v6.9.29 — Sends monthly LLM audit report to edooqoo@gmail.com via Resend.
// Called only by audit-llm-models when mode === 'monthly'. Auth: x-internal-call == CRON_SECRET.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-call",
};

const RESEND_URL = "https://api.resend.com/emails";
const RECIPIENT = "edooqoo@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-internal-call");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { reportHtml, summary, generatedAt } = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "missing RESEND_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dateStr = (generatedAt || new Date().toISOString()).slice(0, 10);
    const total = summary?.total ?? 0;
    const failed = summary?.failed ?? 0;
    const subject = `[Edooqoo] Monthly LLM Audit — ${dateStr} — ${failed}/${total} failed`;

    const html = `
<div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="margin: 0 0 8px;">Monthly LLM Audit — ${dateStr}</h2>
  <p style="color:#374151;">Checked: <strong>${total}</strong> · OK: <strong>${(summary?.ok ?? 0)}</strong> · Failed: <strong style="color:${failed > 0 ? '#dc2626' : '#16a34a'};">${failed}</strong></p>
  ${reportHtml || "<p>No report body.</p>"}
  <p style="color:#6b7280; font-size:12px; margin-top: 24px;">Source: audit-llm-models (mode=monthly). Inspect model_health_checks for raw rows.</p>
</div>`.trim();

    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Edooqoo Monitoring <hello@edooqoo.com>",
        to: [RECIPIENT],
        subject,
        html,
      }),
    });
    const body = await r.text();

    return new Response(JSON.stringify({ ok: r.ok, status: r.status, body: body.slice(0, 300) }), {
      status: r.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});