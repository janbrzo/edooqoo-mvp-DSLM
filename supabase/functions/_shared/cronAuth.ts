// Shared check for pg_cron / server-to-server callers that authenticate with the
// project CRON_SECRET sent in the `x-cron-secret` header.
//
// Pure (no Deno APIs) so it can be unit-tested with Vitest. Fails closed: when
// the secret is not configured or the header is missing, nothing is accepted.
export function hasValidCronSecret(headerValue: string | null | undefined, expected: string | null | undefined): boolean {
  return !!expected && !!headerValue && headerValue === expected;
}

/**
 * True when the request comes from pg_cron (x-cron-secret) or another server
 * holding the service role key. The public anon key is never accepted.
 */
export function isTrustedServerRequest(req: Request): boolean {
  const env = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env;
  if (hasValidCronSecret(req.headers.get('x-cron-secret'), env?.get('CRON_SECRET'))) return true;
  const serviceKey = env?.get('SUPABASE_SERVICE_ROLE_KEY');
  const header = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  return !!serviceKey && header === `Bearer ${serviceKey}`;
}
