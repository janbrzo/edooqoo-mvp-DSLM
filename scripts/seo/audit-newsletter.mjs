#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = (message) => {
  console.error(`[newsletter-audit] FAIL ${message}`);
  process.exitCode = 1;
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

const migration = read('supabase/migrations/20260615143000_newsletter_double_opt_in.sql');
const config = read('supabase/config.toml');
const subscriptionFunction = read('supabase/functions/newsletter-subscription/index.ts');
const campaignFunction = read('supabase/functions/send-next-lesson-newsletter/index.ts');
const app = read('src/App.tsx');
const component = read('src/components/newsletter/NewsletterSignup.tsx');
const eventTracking = read('src/hooks/useEventTracking.tsx');
const strategicGenerator = read('scripts/seo/generate-strategic-content.mjs');
const legacyGenerator = read('scripts/seo/generate-legacy-strategic-articles.mjs');
const newsletterEmbed = read('scripts/seo/newsletter-embed.mjs');

for (const required of [
  'CREATE TABLE IF NOT EXISTS public.newsletter_subscribers',
  "CHECK (status IN ('pending', 'active', 'unsubscribed'))",
  'ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY',
  'CREATE OR REPLACE FUNCTION public.consume_newsletter_rate_limit',
  'GRANT EXECUTE ON FUNCTION public.consume_newsletter_rate_limit',
]) {
  expect(migration.includes(required), `migration missing ${required}`);
}
expect(!/INSERT\s+INTO\s+public\.newsletter_subscribers[\s\S]+SELECT[\s\S]+auth\./i.test(migration),
  'migration must not import existing users');
expect(/\[functions\.newsletter-subscription\]\r?\nverify_jwt = false/.test(config),
  'newsletter-subscription must permit public double-opt-in requests');
expect(/\[functions\.send-next-lesson-newsletter\]\r?\nverify_jwt = false/.test(config),
  'campaign sender config missing');
expect(subscriptionFunction.includes("body?.consent !== true"), 'explicit marketing consent is not enforced');
expect(subscriptionFunction.includes('company.trim()'), 'honeypot is not enforced');
expect(subscriptionFunction.includes('consume_newsletter_rate_limit'), 'database-backed rate limiting is not used');
expect(subscriptionFunction.includes('confirmation_token_hash'), 'confirmation token is not stored as a hash');
expect(subscriptionFunction.includes("req.method === 'POST' && action === 'confirm'"),
  'confirmation must change state only on POST');
expect(subscriptionFunction.includes("req.method === 'POST' && action === 'unsubscribe'"),
  'unsubscribe must change state only on POST');
expect(campaignFunction.includes("req.headers.get('x-internal-call')"), 'campaign sender lacks internal authentication');
expect(campaignFunction.includes('isAllowedNewsletterCanonical'), 'campaign sender does not enforce article/case canonical URLs');
expect(campaignFunction.includes('List-Unsubscribe'), 'campaign email lacks unsubscribe header');
expect(campaignFunction.includes('List-Unsubscribe-Post'), 'campaign email lacks one-click unsubscribe contract');
expect(campaignFunction.includes('/emails/batch'), 'campaign sender does not use the Resend batch endpoint');

expect(app.includes('/newsletter/confirmed') && app.includes('/newsletter/unsubscribed'),
  'newsletter lifecycle routes missing');
expect(component.includes('consent: true'), 'React form does not send explicit consent');
expect(component.includes('company'), 'React form lacks honeypot');
expect(component.includes("eventType: 'newsletter_submit'"), 'React form lacks newsletter_submit analytics');
expect(!component.includes('eventData: { email'), 'email must not be included in analytics');
expect(eventTracking.includes("'newsletter_confirm'"), 'newsletter_confirm event contract missing');
expect(strategicGenerator.includes('renderNewsletterEmbed'), 'strategic article generator lacks newsletter form');
expect(legacyGenerator.includes('renderNewsletterEmbed'), 'legacy strategic article generator lacks newsletter form');
expect(newsletterEmbed.includes("eventType: 'newsletter_submit'"),
  'static article form lacks newsletter_submit analytics');
expect(!newsletterEmbed.includes("eventData: {\n                  email"),
  'static article analytics must not contain email');

for (const directory of ['public/blog']) {
  const generatedArticles = fs.readdirSync(path.join(ROOT, directory))
    .filter((file) => file.endsWith('.html'))
    .map((file) => path.join(directory, file));
  const newsletterArticles = generatedArticles.filter((relative) =>
    read(relative).includes('data-newsletter-form'));
  expect(newsletterArticles.length >= 24,
    `expected newsletter forms on all 24 strategic articles, found ${newsletterArticles.length}`);
}

if (!process.exitCode) {
  console.log('[newsletter-audit] PASS double opt-in, consent, rate limiting, canonical campaigns, unsubscribe, forms, and no-PII analytics.');
}
