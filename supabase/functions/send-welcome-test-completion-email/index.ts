// v6.9.29 — Sends a "thanks for completing" email to the student after Welcome Test.
// Idempotent via student_tests.completion_email_sent_at. Reply-To = teacher email.
// Resend direct API (RESEND_API_KEY). Matches send-welcome-email pattern.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { renderWelcomeTestCompletionEmail } from "../_shared/emailTemplates/welcomeTestCompletion.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_URL = "https://api.resend.com/emails";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // In-code auth: require service-role bearer (function is called from other edge functions).
  const auth = req.headers.get("Authorization") || "";
  const expected = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`;
  if (!auth || auth !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { testId, studentEmail, studentName, teacherName, teacherEmail } = await req.json();
    if (!testId || !studentEmail) {
      return new Response(JSON.stringify({ error: "missing testId or studentEmail" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Idempotency check
    const { data: row } = await sb
      .from("student_tests")
      .select("completion_email_sent_at")
      .eq("id", testId)
      .maybeSingle();
    if (row?.completion_email_sent_at) {
      return new Response(JSON.stringify({ skipped: true, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "missing RESEND_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html, text } = renderWelcomeTestCompletionEmail({
      studentName: studentName || "there",
      teacherName: teacherName || "your teacher",
    });

    const payload: Record<string, unknown> = {
      from: "Edooqoo <hello@edooqoo.com>",
      to: [studentEmail],
      subject,
      html,
      text,
    };
    if (teacherEmail) payload.reply_to = teacherEmail;

    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await r.text();

    if (!r.ok) {
      await sb.from("error_logs").insert({
        severity: "warning", source: "edge-function", source_name: "send-welcome-test-completion-email",
        component: "resend", error_code: "welcome_test_email_failed",
        message: `Resend ${r.status}`,
        context: { testId, status: r.status, body: body.slice(0, 500) },
      });
      return new Response(JSON.stringify({ ok: false, status: r.status, body }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb.from("student_tests")
      .update({ completion_email_sent_at: new Date().toISOString() })
      .eq("id", testId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});