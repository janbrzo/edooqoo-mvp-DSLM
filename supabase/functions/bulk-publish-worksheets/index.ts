// bulk-publish-worksheets
// Plan v6.9.31 — one-shot backfill that flips eligible private worksheets to
// is_public=true in the gallery. Mirrors the validation logic from
// `publish-worksheet` so individual records still must pass: title length >= 3,
// >= 6 exercises in ai_response, no PII in form_data.additionalInformation.
// Idempotent — re-runs simply skip already-public rows.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PII_REGEX = /(\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\+?\d[\d\s().-]{7,}\d)/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: x-cron-secret header
  const expected = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  let limit = 500;
  let dryRun = false;
  let onlyTeacherId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.limit === "number") limit = Math.max(1, Math.min(2000, body.limit));
    if (typeof body?.dry_run === "boolean") dryRun = body.dry_run;
    if (typeof body?.only_teacher_id === "string") onlyTeacherId = body.only_teacher_id;
  } catch (_) { /* ignore — defaults */ }

  let q = sb
    .from("worksheets")
    .select("id, title, teacher_id, user_id, form_data, ai_response, public_slug")
    .is("deleted_at", null)
    .not("ai_response", "is", null)
    .or("is_public.is.null,is_public.eq.false")
    .order("id", { ascending: true })
    .limit(limit);
  if (onlyTeacherId) q = q.eq("teacher_id", onlyTeacherId);

  const { data: rows, error: fetchErr } = await q;
  if (fetchErr) return json({ error: `Fetch failed: ${fetchErr.message}` }, 500);

  const stats = {
    scanned: rows?.length || 0,
    published: 0,
    skipped_no_title: 0,
    skipped_invalid_json: 0,
    skipped_too_short: 0,
    skipped_pii: 0,
    errors: [] as Array<{ id: string; error: string }>,
  };

  for (const ws of rows || []) {
    try {
      if (!ws.title || ws.title.trim().length < 3) {
        stats.skipped_no_title++;
        continue;
      }
      let parsed: any = null;
      try {
        parsed = ws.ai_response ? JSON.parse(ws.ai_response as unknown as string) : null;
      } catch (_) {
        stats.skipped_invalid_json++;
        continue;
      }
      const exercises = Array.isArray(parsed?.exercises) ? parsed.exercises : [];
      if (exercises.length < 6) {
        stats.skipped_too_short++;
        continue;
      }
      const additional = String((ws.form_data as any)?.additionalInformation || "");
      if (PII_REGEX.test(additional)) {
        stats.skipped_pii++;
        continue;
      }

      const fd = (ws.form_data || {}) as Record<string, any>;
      const publicTopic = String(fd.topic || "general").slice(0, 120);
      const publicLevel = String(fd.englishLevel || fd.cefr || "B1").slice(0, 20);
      const exerciseTypes = Array.from(
        new Set(exercises.map((e: any) => String(e?.type || "")).filter(Boolean)),
      ).slice(0, 12);

      let slug = ws.public_slug;
      if (!slug) {
        const { data: slugData, error: slugErr } = await sb.rpc("generate_public_slug", {
          p_title: ws.title,
          p_id: ws.id,
        });
        if (slugErr || !slugData) {
          stats.errors.push({ id: ws.id, error: `slug: ${slugErr?.message || "unknown"}` });
          continue;
        }
        slug = String(slugData);
      }

      if (dryRun) {
        stats.published++;
        continue;
      }

      const { error: updErr } = await sb
        .from("worksheets")
        .update({
          is_public: true,
          public_slug: slug,
          published_at: new Date().toISOString(),
          public_topic: publicTopic,
          public_level: publicLevel,
          public_exercise_types: exerciseTypes,
        })
        .eq("id", ws.id);

      if (updErr) {
        stats.errors.push({ id: ws.id, error: updErr.message });
        if (stats.errors.length > 100) stats.errors.length = 100;
        continue;
      }
      stats.published++;
    } catch (err) {
      stats.errors.push({
        id: ws.id,
        error: err instanceof Error ? err.message : "unknown",
      });
      if (stats.errors.length > 100) stats.errors.length = 100;
    }
  }

  // Best-effort: refresh sitemap once after the batch
  if (!dryRun && stats.published > 0) {
    try {
      fetch(`${supabaseUrl}/functions/v1/regenerate-gallery-sitemap`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}` },
      }).catch(() => {});
    } catch (_) { /* ignore */ }
  }

  return json({ ok: true, dryRun, ...stats });
});