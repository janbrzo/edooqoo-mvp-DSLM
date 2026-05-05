---
name: Welcome Email Pipeline (v6.9.7 part 2)
description: Resend-based post-signup welcome email triggered by auth.users email confirmation, idempotent via email_send_log
type: feature
---

## Architecture
- **Trigger:** `public.handle_email_confirmed()` on `auth.users` AFTER UPDATE OF `email_confirmed_at` (NULL → NOT NULL guard). Fires for both email-link confirmation and Google OAuth first login.
- **Transport:** `pg_net.http_post` (async, non-blocking) → `send-welcome-email` edge function.
- **Auth:** shared secret in `public.app_internal_config.welcome_email_secret`, sent as `x-internal-secret` header. Trigger reads via SECURITY DEFINER; edge function reads via service_role.
- **Provider:** Resend REST API, `from: Edooqoo <hello@edooqoo.com>` (verified domain `edooqoo.com`).
- **Idempotency:** `email_send_log` row with `template_name='welcome_email'` + `status='sent'` blocks re-send. Edge function returns `{ ok: true, skipped: true }` on duplicate.
- **Source split:** `signupSource` derived from `raw_app_meta_data->>'provider'` (`'google'` | `'email'`) — different opening line, no timing delay for OAuth.

## Invariants (DO NOT REGRESS)
- Welcome email is sent ONLY by the DB trigger. Never invoke `send-welcome-email` from client code.
- `email_send_log` is the source of idempotency truth — never DELETE/TRUNCATE.
- `app_internal_config` has RLS enabled with NO policies — only service_role can read. Don't add anon/authenticated policies.
- Resend `from` must remain `hello@edooqoo.com` — only verified mailbox.
- Trigger guard `OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL` must stay — otherwise resends on every profile update.
- Use `APP_BASE_URL` for all links in template — never hardcode `edooqoo.com` or `lovable.app`.

## Files
- `supabase/functions/send-welcome-email/index.ts` — edge function, `verify_jwt=false`, in-code shared-secret auth.
- DB: `public.handle_email_confirmed()`, trigger `on_user_email_confirmed` on `auth.users`.
- Tables: `public.email_send_log`, `public.app_internal_config`.

## Operations
- Rotate secret: `UPDATE public.app_internal_config SET value=encode(gen_random_bytes(24),'hex'), updated_at=now() WHERE key='welcome_email_secret';` — both trigger and edge function read live, no redeploy needed.
- Resend on demand: `DELETE FROM public.email_send_log WHERE recipient_email=$1 AND template_name='welcome_email';` then re-trigger via `UPDATE auth.users SET updated_at=now() WHERE id=$1` — but only if `email_confirmed_at` was reset (it won't be in normal flow). For ad-hoc resend, call edge function directly with valid secret.
- Failure debugging: `SELECT * FROM public.email_send_log WHERE template_name='welcome_email' AND status='failed' ORDER BY created_at DESC;`