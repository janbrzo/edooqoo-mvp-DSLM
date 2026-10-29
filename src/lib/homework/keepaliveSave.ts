/**
 * The write sent when the student closes or reloads the tab: a keepalive fetch survives the
 * page, an ordinary request is cancelled. Browsers cap a keepalive body at 64 KB (all keepalive
 * requests of the page together), so an oversized body is not sent; the answers stay in the
 * local state and the normal queue.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const KEEPALIVE_BODY_LIMIT = 60_000;

export interface KeepaliveRequest { url: string; init: RequestInit }

export function buildKeepaliveSaveRequest(rpcName: string, args: Record<string, unknown>): KeepaliveRequest | null {
  const body = JSON.stringify(args);
  if (body.length > KEEPALIVE_BODY_LIMIT) return null;
  return {
    url: `${SUPABASE_URL}/rest/v1/rpc/${rpcName}`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        Prefer: 'return=minimal',
      },
      body,
      keepalive: true,
    },
  };
}
