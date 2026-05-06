---
name: Signup Email Flow (two-step)
description: Two emails after signup — Supabase confirm + branded Edooqoo welcome
type: feature
---
# Signup Email Flow

## Sequence
1. User submits Signup form → `supabase.auth.signUp` → Supabase sends DEFAULT confirmation email (no-reply@supabase) with activation link.
2. User clicks link → `auth.users.email_confirmed_at` flips NULL → NOT NULL.
3. Trigger `on_user_email_confirmed` → `pg_net.http_post` → `send-welcome-email` edge function → Resend sends branded welcome from `hello@edooqoo.com`.
4. Google OAuth: skips step 1; trigger fires on first OAuth callback (Supabase auto-sets `email_confirmed_at`).

## Why two emails (do not "fix" by removing one)
- Step 1 is REQUIRED by Supabase Auth — cannot be disabled without breaking JWT issuance.
- Step 2 is OUR brand touchpoint with onboarding CTAs.
- Both are explained to users in `EmailConfirmationModal` and `/how-it-works` FAQ.

## UI copy locations
- `src/components/EmailConfirmationModal.tsx` — "What's next" ordered list.
- `src/pages/HowItWorks.tsx` — `faqItems` entry "What emails will I receive after signing up?".

## Invariants
- Do NOT remove the welcome-email FAQ entry or the modal explanation until Supabase confirmation step is removed (it is not planned).
- Do NOT add a third email here without RAG doc update.
