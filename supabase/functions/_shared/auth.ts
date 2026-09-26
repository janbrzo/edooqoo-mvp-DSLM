/**
 * Caller identity for edge functions.
 *
 * The public anon key is itself a valid JWT, so the gateway's `verify_jwt`
 * check only proves "someone has the public key". Functions that act with the
 * service role must decide who the caller is from the token, never from ids in
 * the request body. `resolveCaller` returns one of:
 *   - service: another edge function / cron calling with the service role key
 *   - user:    a signed-in Supabase user (anonymous users included, flagged)
 *   - public:  anon key, missing or invalid token
 */
import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2';

export type Caller =
  | { kind: 'service' }
  | { kind: 'user'; user: User; isAnonymous: boolean }
  | { kind: 'public' };

function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token && token !== 'undefined' && token !== 'null' ? token : null;
}

export async function resolveCaller(req: Request): Promise<Caller> {
  const token = bearerToken(req);
  if (!token) return { kind: 'public' };

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && token === serviceKey) return { kind: 'service' };

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (anonKey && token === anonKey) return { kind: 'public' };

  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return { kind: 'public' };
    return { kind: 'user', user: data.user, isAnonymous: data.user.is_anonymous === true };
  } catch {
    return { kind: 'public' };
  }
}

/** Signed-in, non-anonymous user (a teacher account). */
export function teacherIdOf(caller: Caller): string | null {
  return caller.kind === 'user' && !caller.isAnonymous ? caller.user.id : null;
}

/**
 * Resolve the teacher a request may act for. Service callers are trusted with
 * the body value; users may only act for themselves. Returns null when the
 * request must be rejected.
 */
export function authorizedTeacherId(caller: Caller, requested: unknown): string | null {
  const requestedId = typeof requested === 'string' && requested ? requested : null;
  if (caller.kind === 'service') return requestedId;
  const own = teacherIdOf(caller);
  if (!own) return null;
  if (requestedId && requestedId !== own) return null;
  return own;
}

export function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns the URL when it is an absolute https URL (http only for localhost)
 * and, if `allowedHosts` is given, its host is on the list. Otherwise null.
 */
export function safeUrl(value: unknown, allowedHosts?: readonly string[]): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) return null;
    if (allowedHosts && !allowedHosts.includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Hosts the app itself is served from (links built by the app point here). */
export function appHosts(): string[] {
  const hosts = new Set<string>(['edooqoo.com', 'www.edooqoo.com']);
  const base = Deno.env.get('APP_BASE_URL');
  if (base) {
    try { hosts.add(new URL(base).hostname.toLowerCase()); } catch { /* ignore */ }
  }
  return Array.from(hosts);
}

// ---------------------------------------------------------------------------
// Signed tokens (OAuth `state`). HMAC-SHA256 over a base64url JSON payload.
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('OAUTH_STATE_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new Error('No signing secret configured');
  return crypto.subtle.importKey('raw', encoder.encode(`edooqoo-signed-state:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signPayload(payload: Record<string, unknown>, ttlMs: number): Promise<string> {
  const body = base64UrlEncode(encoder.encode(JSON.stringify({
    ...payload,
    nonce: crypto.randomUUID(),
    exp: Date.now() + ttlMs,
  })));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(body)));
  return `${body}.${base64UrlEncode(signature)}`;
}

/** Returns the payload when the signature is valid and not expired, else null. */
export async function verifyPayload<T extends Record<string, unknown>>(token: unknown): Promise<T | null> {
  if (typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(), base64UrlDecode(signature), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
    if (typeof payload?.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload as T;
  } catch {
    return null;
  }
}
