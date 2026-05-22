
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("x-real-ip") || "";

    if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return new Response(JSON.stringify({ country: "DEFAULT" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try geolocation_cache first
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: cached } = await sb
      .from("geolocation_cache")
      .select("country")
      .eq("ip", ip)
      .maybeSingle();

    if (cached?.country) {
      return new Response(JSON.stringify({ country: cached.country }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch from ipapi.co
    const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "edooqoo/1.0" },
    });

    if (!geoRes.ok) {
      return new Response(JSON.stringify({ country: "DEFAULT" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geoData = await geoRes.json();
    const country = geoData.country_code || "DEFAULT";

    // Cache it
    await sb.from("geolocation_cache").upsert(
      { ip, country, city: geoData.city || null },
      { onConflict: "ip" }
    );

    return new Response(JSON.stringify({ country }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-demo-locale error:", error);
    return new Response(JSON.stringify({ country: "DEFAULT" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
