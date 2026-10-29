/**
 * Validates a `returnTo` value taken from the URL so it can only ever be a
 * same-origin relative path. Anything else (absolute URLs, protocol-relative
 * URLs, javascript:/data:/vbscript: schemes, control characters, backslashes)
 * resolves to the fallback, because the value is user-controlled input that
 * flows into navigation.
 */

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const DANGEROUS_SCHEME_PATTERN = /(?:javascript|data|vbscript)\s*:/i;

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function isSafeRelativePath(value: string): boolean {
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;
  if (value.includes('\\')) return false;
  if (hasControlChars(value)) return false;
  if (DANGEROUS_SCHEME_PATTERN.test(value)) return false;
  return true;
}

export function safeReturnTo(raw: string | null | undefined, fallback: string): string {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  if (!isSafeRelativePath(raw)) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (decoded !== raw) {
    if (!isSafeRelativePath(decoded)) return fallback;
    if (SCHEME_PATTERN.test(decoded)) return fallback;
  }
  return raw;
}
