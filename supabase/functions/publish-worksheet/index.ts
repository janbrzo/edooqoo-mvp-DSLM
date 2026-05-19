// publish-worksheet
// Sprint 3 / Plan v6.9.20 — toggles worksheets.is_public=true, generates SEO
// slug, denormalizes topic/level/exercise_types for fast public listing.
// Caller: authenticated teacher who owns the worksheet.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://edooqoo.com";
const PII_REGEX = /(\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\+?\d[\d\s().-]{7,}\d)/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized" }, 401);
    }
    const sbUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await sbUser.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const worksheetId: string | undefined = body.worksheet_id;
    if (!worksheetId || typeof worksheetId !== "string") {
      return json({ error: "worksheet_id required" }, 400);
    }

    const sbAdmin = createClient(supabaseUrl, serviceKey);
    const { data: ws, error: fetchErr } = await sbAdmin
      .from("worksheets")
      .select("id, title, teacher_id, user_id, form_data, ai_response, public_slug")
      .eq("id", worksheetId)
      .maybeSingle();
    if (fetchErr || !ws) return json({ error: "Worksheet not found" }, 404);
    const owner = ws.teacher_id || ws.user_id;
    if (owner !== userId) return json({ error: "Forbidden — not your worksheet" }, 403);

    // Validation
    if (!ws.title || ws.title.trim().length < 3) {
      return json({ error: "Worksheet needs a meaningful title before publishing." }, 400);
    }
    let exerciseCount = 0;
    try {
      const parsed = ws.ai_response ? JSON.parse(ws.ai_response) : null;
      exerciseCount = Array.isArray(parsed?.exercises) ? parsed.exercises.length : 0;
    } catch (_) { /* keep 0 */ }
    if (exerciseCount < 6) {
      return json({ error: `Need at least 6 exercises (found ${exerciseCount}).` }, 400);
    }
    const additional = String((ws.form_data as any)?.additionalInformation || "");
    if (PII_REGEX.test(additional)) {
      return json({ error: "Remove emails/phone numbers from Additional Information before publishing." }, 400);
    }

    // Denormalize fields for filtering
    const fd = (ws.form_data || {}) as Record<string, any>;
    const publicTopic = String(fd.topic || "general").slice(0, 120);
    const publicLevel = String(fd.englishLevel || fd.cefr || "B1").slice(0, 20);
    let exerciseTypes: string[] = [];
    try {
      const parsed = ws.ai_response ? JSON.parse(ws.ai_response) : null;
      exerciseTypes = Array.isArray(parsed?.exercises)
        ? Array.from(new Set(parsed.exercises.map((e: any) => String(e?.type || "")).filter(Boolean))).slice(0, 12)
        : [];
    } catch (_) { /* keep [] */ }

    // Slug — reuse existing if already set, else generate
    let slug = ws.public_slug;
    if (!slug) {
      const { data: slugData, error: slugErr } = await sbAdmin.rpc("generate_public_slug", {
        p_title: ws.title,
        p_id: ws.id,
      });
      if (slugErr || !slugData) {
        return json({ error: `Slug generation failed: ${slugErr?.message || "unknown"}` }, 500);
      }
      slug = String(slugData);
    }

    const { error: updErr } = await sbAdmin
      .from("worksheets")
      .update({
        is_public: true,
        public_slug: slug,
        published_at: new Date().toISOString(),
        public_topic: publicTopic,
        public_level: publicLevel,
        public_exercise_types: exerciseTypes,
      })
      .eq("id", worksheetId);
    if (updErr) return json({ error: `Update failed: ${updErr.message}` }, 500);

    // Best-effort sitemap refresh (do not block response)
    try {
      fetch(`${supabaseUrl}/functions/v1/regenerate-gallery-sitemap`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}` },
      }).catch(() => {});
    } catch (_) { /* ignore */ }

    return json({
      ok: true,
      slug,
      public_url: `${APP_BASE_URL}/gallery/${slug}`,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}