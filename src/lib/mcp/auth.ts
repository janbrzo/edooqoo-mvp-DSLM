// Bearer-token authenticator for Edooqoo MCP tools. Import-safe: no env reads
// at module top-level. Called only from tool handlers.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type McpAuthResult =
  | { ok: true; teacherId: string; tokenHash: string; supabase: SupabaseClient }
  | { ok: false; reason: string };

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readAuthHeader(ctx: unknown): string {
  // mcp-js ToolContext exposes the underlying Request; support both shapes.
  const anyCtx = ctx as { request?: Request; req?: Request; headers?: Headers };
  const req = anyCtx?.request ?? anyCtx?.req;
  const headers = req?.headers ?? anyCtx?.headers;
  if (!headers) return "";
  return headers.get("authorization") ?? headers.get("Authorization") ?? "";
}

export async function resolveTeacherFromRequest(ctx: unknown): Promise<McpAuthResult> {
  const authHeader = readAuthHeader(ctx);
  const match = authHeader.match(/^Bearer\s+(edq_mcp_[A-Za-z0-9]+)$/);
  if (!match) {
    return { ok: false, reason: "Missing or malformed Bearer token (expected `Authorization: Bearer edq_mcp_...`)." };
  }
  const token = match[1];
  const tokenHash = await sha256Hex(token);

  // deno-lint-ignore no-explicit-any
  const denoEnv = (globalThis as any).Deno?.env;
  const supabaseUrl = denoEnv?.get("SUPABASE_URL");
  const serviceKey = denoEnv?.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, reason: "MCP server misconfigured (missing Supabase service credentials)." };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("mcp_tokens")
    .select("teacher_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "Invalid or revoked MCP token." };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ok: false, reason: "MCP token expired." };
  }

  // Fire-and-forget last_used_at bump.
  void supabase
    .from("mcp_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  return { ok: true, teacherId: data.teacher_id, tokenHash, supabase };
}

export function unauthorized(reason: string) {
  return {
    content: [{ type: "text" as const, text: `Unauthorized: ${reason}` }],
    isError: true,
  };
}