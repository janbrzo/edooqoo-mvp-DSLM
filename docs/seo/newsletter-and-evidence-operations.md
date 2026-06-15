# Newsletter and Evidence Operations

## Weekly Newsletter

1. Select one published article under `/blog/` or one worked example under `/what-to-teach-next/`.
2. Use that page as `canonicalUrl`. The email contains a summary and must not duplicate the full resource.
3. Call `send-next-lesson-newsletter` with `x-internal-call: CRON_SECRET` and:
   - `campaignKey`: stable ASCII identifier, for example `2026-06-18-project-status-repair`.
   - `title`: email subject and heading.
   - `summary`: bounded plain-text summary.
   - `canonicalUrl`: absolute `https://edooqoo.com` article or worked-example URL.
4. The function sends only to `newsletter_subscribers.status = active`, uses Resend batches of at most 100 messages, records delivery attempts in `email_send_log`, and includes a signed unsubscribe URL.
5. Reusing a `campaignKey` skips recipients already logged as sent.

## Consent and Subscriber States

- `pending`: confirmation requested but not completed.
- `active`: confirmation token accepted before expiry.
- `unsubscribed`: signed unsubscribe link accepted.
- Existing Edooqoo users are not added automatically.
- Public forms require explicit newsletter consent and use a honeypot.
- Rate-limit keys are hashed; email addresses are not sent in analytics events.
- Email links open noindex confirmation pages; confirmation and visible unsubscribe changes occur only after a POST action, preventing mail link scanners from changing consent state.
- Campaign emails include `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- Hub, worked-example, decision-tool, and strategic-article forms emit `newsletter_submit` with controlled source and status values only.
- Confirmation status pages emit `newsletter_confirm` without an email address or confirmation token.

## Evidence Publication

`docs/seo/evidence-registry.json` is the release gate.

Each case requires:

- `writtenConsent: true`
- a measurable `baseline`
- a measurable `outcome`
- a documented `methodology`

`/evidence` must remain absent from application routes and sitemap until at least three valid cases exist. The annual report must remain absent until at least 100 valid survey responses exist and survey methodology is documented. `npm run seo:audit-evidence` enforces both thresholds.
