export const NEWSLETTER_CONSENT_VERSION = '2026-06-15';
export const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;
export const CONFIRMATION_RESEND_DELAY_MS = 15 * 60 * 1000;

export function normalizeNewsletterEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidNewsletterEmail(value) {
  const email = normalizeNewsletterEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeNewsletterSource(value) {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9:_-]/g, '-').slice(0, 80);
  return normalized || 'unknown';
}

export function planNewsletterSubscription(existing, nowMs = Date.now()) {
  if (!existing) return { shouldSendConfirmation: true, reason: 'new' };
  if (existing.status === 'active') return { shouldSendConfirmation: false, reason: 'active' };

  const sentAt = existing.confirmation_sent_at
    ? new Date(existing.confirmation_sent_at).getTime()
    : 0;
  const expiresAt = existing.confirmation_expires_at
    ? new Date(existing.confirmation_expires_at).getTime()
    : 0;
  const recentlySent = sentAt > 0 && nowMs - sentAt < CONFIRMATION_RESEND_DELAY_MS;
  const tokenStillValid = expiresAt > nowMs;

  if (existing.status === 'pending' && recentlySent && tokenStillValid) {
    return { shouldSendConfirmation: false, reason: 'pending' };
  }

  return {
    shouldSendConfirmation: true,
    reason: existing.status === 'unsubscribed' ? 'resubscribe' : 'refresh',
  };
}

export function transitionNewsletterConfirmation(existing, nowMs = Date.now()) {
  if (!existing) return { ok: false, status: 'invalid' };
  if (existing.status === 'active') return { ok: true, status: 'already-active', nextStatus: 'active' };
  if (existing.status !== 'pending') return { ok: false, status: 'invalid' };

  const expiresAt = existing.confirmation_expires_at
    ? new Date(existing.confirmation_expires_at).getTime()
    : 0;
  if (!expiresAt || expiresAt <= nowMs) return { ok: false, status: 'expired' };

  return { ok: true, status: 'confirmed', nextStatus: 'active' };
}

export function transitionNewsletterUnsubscribe(existing) {
  if (!existing) return { ok: false, status: 'invalid' };
  if (existing.status === 'unsubscribed') {
    return { ok: true, status: 'already-unsubscribed', nextStatus: 'unsubscribed' };
  }
  return { ok: true, status: 'unsubscribed', nextStatus: 'unsubscribed' };
}

export function isAllowedNewsletterCanonical(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://edooqoo.com') return false;
    return url.pathname.startsWith('/blog/')
      || (url.pathname.startsWith('/what-to-teach-next/') && url.pathname !== '/what-to-teach-next/');
  } catch {
    return false;
  }
}

