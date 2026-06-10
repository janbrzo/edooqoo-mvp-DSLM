---
name: v6.9.52 format-worksheet-prompt dual-auth
description: Edge function accepts user JWT or Supabase anon key so anonymous public worksheet generator no longer 401s.
type: feature
---

## What changed

- `supabase/functions/format-worksheet-prompt/index.ts` now supports two auth modes:
  1. Authenticated teacher: `Authorization: Bearer <user JWT>`, validated via `supabase.auth.getUser(token)`. Rate-limit key = `user:<uid>`.
  2. Anonymous public generator: request must present the project `SUPABASE_ANON_KEY` on either `Authorization: Bearer <anon>` or `apikey: <anon>`. Rate-limit key = `anon:<ip>`.
- Invalid/missing credentials still return 401.
- `src/utils/promptFormatter.ts` falls back to `VITE_SUPABASE_PUBLISHABLE_KEY` then `VITE_SUPABASE_ANON_KEY`, throws if both missing, otherwise sends Authorization (session token or anon) plus `apikey: anonKey`.

## Sanctity

No Worksheet Generation Engine prompt/logic change. `generateWorksheet` untouched.
