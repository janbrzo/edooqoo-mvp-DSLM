// regenerate-gallery-sitemap
// Sprint 3 / Plan v6.9.20 — returns a fresh sitemap-gallery.xml for all
// public worksheets. Designed to be fetched by build tooling or a cron.
// Output is XML so external crawlers (Google Search Console) can ingest
// directly via Supabase URL or via a proxied /sitemap-gallery.xml route.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://edooqoo.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await sb
      .from("worksheets")
      .select("public_slug, published_at, last_modified_at")
      .eq("is_public", true)
      .order("published_at", { ascending: false })
      .limit(50000);
    if (error) throw error;
    const urls = (data || [])
      .filter((r) => r.public_slug)
      .map((r) => {
        const lastmod = (r.last_modified_at || r.published_at || new Date().toISOString()).slice(0, 10);
        return `  <url>\n    <loc>${APP_BASE_URL}/gallery/${escapeXml(r.public_slug!)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`;
      })
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
    return new Response(xml, {
      headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8" },
    });
  } catch (err) {
    return new Response(`<!-- error: ${err instanceof Error ? err.message : "unknown"} -->`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}