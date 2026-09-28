// hubSession — short-lived proof that a Student Hub visitor already supplied
// the correct hub password for (teacherId, email).
//
// Before this, `get-student-hub-data`'s `check_password_required` /
// `verify_password` actions gated only the frontend UI: the data-returning
// default action, and the `set_password` / `remove_password` /
// `get_gcal_status` / `disconnect_gcal` / `update_gcal_settings` /
// `sync_all_lessons_gcal` actions, accepted just `{ token, email }` — the
// same public token + email pair that gets a student INTO the password
// screen in the first place. So a password on a Hub protected nothing once
// the request went straight to the API: any caller who knew (or guessed) a
// token + email could read the full hub data, or remove/replace the
// password, without ever supplying it.
//
// Fix: `verify_password` now returns a signed token proving the caller
// already supplied the correct password for this (teacherId, email). Every
// other action on a student who HAS a password set must include a valid,
// unexpired token for that exact (teacherId, email) pair, or is refused.
// Students with no password set are unaffected (nothing to prove yet).
//
// Signed with SUPABASE_SERVICE_ROLE_KEY (already private to these
// functions, never sent to the client) via a domain-separated HMAC key, so
// no new secret needs provisioning. HMAC output does not reveal the signing
// key, so deriving a key from it here does not weaken the service role key.

const encoder = new TextEncoder();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — a generous single Hub visit

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(`hub-session-v1:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Issue a session token for (teacherId, normalizedEmail), valid for SESSION_TTL_MS. */
export async function signHubSession(teacherId: string, normalizedEmail: string): Promise<string> {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${teacherId}:${normalizedEmail}:${exp}`;
  const key = await hmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${btoa(payload)}.${toHex(sig)}`;
}

/** Verify a session token was issued for exactly this (teacherId, normalizedEmail) and has not expired. */
export async function verifyHubSession(
  token: unknown,
  teacherId: string,
  normalizedEmail: string,
): Promise<boolean> {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [encodedPayload, sigHex] = token.split('.');
  if (!sigHex) return false;

  let payload: string;
  try {
    payload = atob(encodedPayload);
  } catch {
    return false;
  }

  const parts = payload.split(':');
  if (parts.length !== 3) return false;
  const [tid, tokenEmail, expStr] = parts;
  const exp = Number(expStr);
  if (tid !== teacherId || tokenEmail !== normalizedEmail || !Number.isFinite(exp) || Date.now() > exp) {
    return false;
  }

  const key = await hmacKey();
  const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return timingSafeEqualHex(toHex(expectedSig), sigHex);
}
