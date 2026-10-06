// Shared check for pg_cron / server-to-server callers that authenticate with the
// project CRON_SECRET sent in the `x-cron-secret` header.
//
// Pure (no Deno APIs) so it can be unit-tested with Vitest. Fails closed: when
// the secret is not configured or the header is missing, nothing is accepted.
export function hasValidCronSecret(headerValue: string | null | undefined, expected: string | null | undefined): boolean {
  return !!expected && !!headerValue && headerValue === expected;
}
