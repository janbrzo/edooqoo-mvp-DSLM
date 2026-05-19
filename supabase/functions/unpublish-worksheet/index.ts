// unpublish-worksheet
// Sprint 3 / Plan v6.9.20 — toggles worksheets.is_public=false but keeps
// public_slug so the old URL can return 410-style "removed" instead of 404.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const sbUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await sbUser.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const body = await req.json().catch(() => ({}));
    const worksheetId: string | undefined = body.worksheet_id;
    if (!worksheetId) return json({ error: "worksheet_id required" }, 400);
    const sbAdmin = createClient(supabaseUrl, serviceKey);
    const { data: ws } = await sbAdmin.from("worksheets").select("teacher_id, user_id").eq("id", worksheetId).maybeSingle();
    if (!ws) return json({ error: "Not found" }, 404);
    if ((ws.teacher_id || ws.user_id) !== u.user.id) return json({ error: "Forbidden" }, 403);
    const { error } = await sbAdmin.from("worksheets").update({ is_public: false }).eq("id", worksheetId);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}