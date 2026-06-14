// sitemap-xml serves the canonical public sitemap with application/xml MIME type.
// The payload is generated from public/sitemap.xml during build:seo.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SITEMAP_XML } from "./sitemap.generated.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  return new Response(SITEMAP_XML, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex',
    },
  });
});
