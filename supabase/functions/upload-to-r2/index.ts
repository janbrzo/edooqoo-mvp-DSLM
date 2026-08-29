import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logError, formatErr } from "../_shared/logError.ts";

/** Service-role client used only for error telemetry. */
function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: Convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: SHA256 hash using Web Crypto API
async function sha256(data: string | Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer as any);
  return bufferToHex(hashBuffer);
}

// Helper: HMAC-SHA256 using Web Crypto API
async function hmacSha256(key: Uint8Array | string, data: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw' as any,
    keyData as any,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return new Uint8Array(signature);
}

// AWS Signature V4 signing helper for R2/S3 compatibility
async function signAwsRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Uint8Array,
  accessKeyId: string,
  secretAccessKey: string,
  region: string = "auto"
) {
  const urlObj = new URL(url);
  const host = urlObj.hostname;
  const path = urlObj.pathname;
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = date.slice(0, 8);

  const payloadHash = await sha256(body);
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${date}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalRequestHash = await sha256(canonicalRequest);
  const stringToSign = `${algorithm}\n${date}\n${credentialScope}\n${canonicalRequestHash}`;

  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");

  const signatureBytes = await hmacSha256(kSigning, stringToSign);
  const signature = bufferToHex(signatureBytes.buffer as ArrayBuffer);

  const authHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...headers,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": date,
    "Authorization": authHeader,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── AUTH CHECK: allow service_role OR authenticated user ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    // Allow service role key (used by other edge functions like generate-image, generate-audio)
    const isServiceRole = token === serviceRoleKey;
    // Allow anon key (used by unauthenticated students in welcome test / homework speaking)
    const isAnonKey = token === anonKey;
    
    if (!isServiceRole && !isAnonKey) {
      // Validate as user JWT
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log(`[UPLOAD-TO-R2] Authenticated user: ${user.id}`);
    } else if (isAnonKey) {
      console.log(`[UPLOAD-TO-R2] Anon key access (unauthenticated student upload)`);
    } else {
      console.log(`[UPLOAD-TO-R2] Service role access`);
    }
    // ── END AUTH CHECK ──

    const { base64Image, base64Data, filename, contentType = "image/png" } = await req.json();

    if ((!base64Image && !base64Data) || !filename) {
      return new Response(
        JSON.stringify({ error: "Missing base64Image or filename" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get R2 credentials from environment
    const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT");
    const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME) {
      console.error("[UPLOAD-TO-R2] Missing R2 credentials");
      const admin = adminClient();
      if (admin) {
        await logError(admin, {
          source_name: "upload-to-r2",
          component: "storage",
          message: "R2 credentials not configured",
          error_code: "R2_CONFIG_MISSING",
        });
      }
      return new Response(
        JSON.stringify({ error: "R2 credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    console.log(`[UPLOAD-TO-R2] Starting upload: ${filename} to bucket: ${R2_BUCKET_NAME}`);

    // Convert base64 to binary
    const rawBase64 = (base64Image || base64Data || "").replace(/^data:[^;]+;base64,/, "");
    const binaryString = atob(rawBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Construct upload URL
    const uploadUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${filename}`;
    console.log(`[UPLOAD-TO-R2] Upload URL: ${uploadUrl}`);

    // Sign request with AWS Signature V4
    const signedHeaders = await signAwsRequest(
      "PUT",
      uploadUrl,
      {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
      bytes,
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY
    );

    // Upload to R2
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: signedHeaders,
      body: bytes,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[UPLOAD-TO-R2] Upload failed: ${response.status}`, errorText);
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const CUSTOM_DOMAIN = Deno.env.get("R2_CUSTOM_DOMAIN");
    const PUBLIC_DEV_URL = Deno.env.get("R2_PUBLIC_URL") || "https://pub-1b974ada9ae240948229c52d927980ee.r2.dev";
    
    const publicUrl = CUSTOM_DOMAIN 
      ? `https://${CUSTOM_DOMAIN}/${filename}`
      : `${PUBLIC_DEV_URL}/${filename}`;
    
    console.log(`[UPLOAD-TO-R2] ✅ Upload successful: ${publicUrl}`);
    console.log(`[UPLOAD-TO-R2] File size: ${Math.round(bytes.length / 1024)}KB`);

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        filename,
        size: bytes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[UPLOAD-TO-R2] Error:", error);
    const admin = adminClient();
    if (admin) {
      const e = formatErr(error);
      await logError(admin, {
        source_name: "upload-to-r2",
        component: "storage",
        message: e.message,
        error_code: e.code ?? "R2_UPLOAD_FAILED",
        stack: e.stack,
      });
    }
    return new Response(
      JSON.stringify({
        error: (error as Error)?.message || "Upload failed",
        details: "Failed to upload file to R2",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

});
