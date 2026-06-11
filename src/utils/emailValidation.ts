/**
 * Shared email validation used by anonymous-facing surfaces such as the
 * Welcome Test student modal. Intentionally permissive enough for real
 * adult-learner addresses but strict enough to reject the typical bypass
 * inputs we have seen in production (`asdf`, `a@b`, trailing dots, etc.).
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}