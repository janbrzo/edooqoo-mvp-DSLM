// v6.9.30 — One-shot backfill of Welcome Test auto-apply.
// Targets historical tests with status='completed' (created before v6.9.29
// auto-apply was introduced). Reads existing test_skill_results, copies
// suggested_rating into student_learning_elements, and flips status to
// 'reviewed'. Safe to call repeatedly: only touches rows where
// test_skill_results.applied_at IS NULL.
//
// Auth: header `x-cron-secret` must match CRON_SECRET env.
// Body (optional): { "limit": number, "testId"?: string }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { limit?: number; testId?: string } = {};
  try { body = await req.json(); } catch { /* allow empty body */ }
  const limit = Math.min(Math.max(body.limit ?? 100, 1), 500);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Select candidate tests
  let q = sb
    .from("student_tests")
    .select("id, student_id, teacher_id")
    .eq("test_type", "welcome")
    .eq("status", "completed")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (body.testId) q = q.eq("id", body.testId);

  const { data: tests, error: testsErr } = await q;
  if (testsErr) {
    return new Response(JSON.stringify({ error: testsErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ testId: string; applied: number; status: string; error?: string }> = [];

  for (const t of tests ?? []) {
    try {
      const { data: skillResults, error: srErr } = await sb
        .from("test_skill_results")
        .select("id, applied_to_element_id, suggested_rating")
        .eq("student_test_id", t.id)
        .is("applied_at", null);
      if (srErr) throw srErr;

      if (!skillResults || skillResults.length === 0) {
        results.push({ testId: t.id, applied: 0, status: "no_skill_results" });
        // Still promote to 'reviewed' so the misleading banner disappears.
        await sb.from("student_tests")
          .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
          .eq("id", t.id);
        continue;
      }

      let appliedCount = 0;
      for (const r of skillResults) {
        if (r.applied_to_element_id && r.suggested_rating != null) {
          await sb.from("student_learning_elements")
            .update({ current_rating: r.suggested_rating, last_rated_at: new Date().toISOString() })
            .eq("id", r.applied_to_element_id);
          appliedCount++;
        }
      }
      await sb.from("test_skill_results")
        .update({ applied_at: new Date().toISOString() })
        .in("id", skillResults.map((r: any) => r.id));
      await sb.from("student_tests")
        .update({ status: "reviewed", reviewed_at: new Date().toISOString() })
        .eq("id", t.id);

      results.push({ testId: t.id, applied: appliedCount, status: "reviewed" });
    } catch (err) {
      const msg = String((err as Error)?.message || err);
      results.push({ testId: t.id, applied: 0, status: "error", error: msg.slice(0, 300) });
      await sb.from("error_logs").insert({
        severity: "warning", source: "edge-function",
        source_name: "backfill-welcome-test-auto-apply",
        component: "welcome-test-auto-apply", error_code: "backfill_failed",
        message: `backfill failed for test ${t.id}`,
        context: { testId: t.id, error: msg.slice(0, 500) },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});