#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  CONFIRMATION_RESEND_DELAY_MS,
  isAllowedNewsletterCanonical,
  isValidNewsletterEmail,
  normalizeNewsletterEmail,
  normalizeNewsletterSource,
  planNewsletterSubscription,
  transitionNewsletterConfirmation,
  transitionNewsletterUnsubscribe,
} from '../../supabase/functions/_shared/newsletter-core.mjs';

const now = Date.parse('2026-06-15T12:00:00Z');

assert.equal(normalizeNewsletterEmail(' Tutor@Example.COM '), 'tutor@example.com');
assert.equal(isValidNewsletterEmail('tutor@example.com'), true);
assert.equal(isValidNewsletterEmail('not-an-email'), false);
assert.equal(normalizeNewsletterSource('Worked Example: Sales / Call'), 'worked-example:-sales---call');

assert.deepEqual(planNewsletterSubscription(null, now), {
  shouldSendConfirmation: true,
  reason: 'new',
});
assert.deepEqual(planNewsletterSubscription({ status: 'active' }, now), {
  shouldSendConfirmation: false,
  reason: 'active',
});
assert.deepEqual(planNewsletterSubscription({
  status: 'pending',
  confirmation_sent_at: new Date(now - CONFIRMATION_RESEND_DELAY_MS + 1000).toISOString(),
  confirmation_expires_at: new Date(now + 60_000).toISOString(),
}, now), {
  shouldSendConfirmation: false,
  reason: 'pending',
});
assert.deepEqual(planNewsletterSubscription({
  status: 'unsubscribed',
  confirmation_sent_at: null,
  confirmation_expires_at: null,
}, now), {
  shouldSendConfirmation: true,
  reason: 'resubscribe',
});

assert.deepEqual(transitionNewsletterConfirmation({
  status: 'pending',
  confirmation_expires_at: new Date(now + 60_000).toISOString(),
}, now), {
  ok: true,
  status: 'confirmed',
  nextStatus: 'active',
});
assert.deepEqual(transitionNewsletterConfirmation({
  status: 'active',
  confirmation_expires_at: new Date(now + 60_000).toISOString(),
}, now), {
  ok: true,
  status: 'already-active',
  nextStatus: 'active',
});
assert.equal(transitionNewsletterConfirmation({
  status: 'pending',
  confirmation_expires_at: new Date(now - 1).toISOString(),
}, now).status, 'expired');

assert.deepEqual(transitionNewsletterUnsubscribe({ status: 'active' }), {
  ok: true,
  status: 'unsubscribed',
  nextStatus: 'unsubscribed',
});
assert.deepEqual(transitionNewsletterUnsubscribe({ status: 'unsubscribed' }), {
  ok: true,
  status: 'already-unsubscribed',
  nextStatus: 'unsubscribed',
});

assert.equal(isAllowedNewsletterCanonical('https://edooqoo.com/blog/teaching-english-one-to-one.html'), true);
assert.equal(isAllowedNewsletterCanonical('https://edooqoo.com/what-to-teach-next/project-manager-status-update'), true);
assert.equal(isAllowedNewsletterCanonical('https://edooqoo.com/tools/what-should-i-teach-next'), false);
assert.equal(isAllowedNewsletterCanonical('https://example.com/blog/fake'), false);

console.log('[newsletter-test] PASS subscription, duplicate, confirmation, unsubscribe, and canonical campaign rules.');

