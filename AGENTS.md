# AGENTS.md — Technical Rules

One rule per entry, with a one-line why. Replace an existing rule instead of adding a second one on the same topic. Product/UX decisions live in project memory (`mem://`) and `docs/ux/*-spec.md`, not here.

Subdirectories `src/` and `supabase/` have their own `AGENTS.md`; read them before changing files there.

## Protected Systems

- The Worksheet Generation Engine (prompt wording, parameters, pipeline in `supabase/functions/generateWorksheet` and `format-worksheet-prompt`) is never modified without the literal instruction "update the Worksheet Generation Engine" — because it is the core product IP.

## Writing Style

- No em dashes (U+2014, `&mdash;`) in English user-facing, generated or SEO text; use a comma, colon, parentheses, period or a pipe in titles, and use `\u2014` escapes in regexes (enforced by `src/lib/__tests__/noEmDash.test.ts`) — because they read as AI-generated English. En dashes in numeric ranges (`1–6`) stay.

## Documentation & AI Resources

- DSLM preserves `skill_category -> micro_skill -> skill_name` as its three-tier hierarchy; `extract_micro_skill` extensions keep existing real-topic mappings stable and only backfill fallback topics, because renaming atomic evidence or moving established topics fragments learner history.

- `get_student_dslm_state_vector` is an owner/service-only, read-only projection of canonical metrics; its SQL decay helper is parity-tested against `forgetting.ts`, excludes duplicate card metrics and never replaces saved scores or automatically feeds the worksheet engine, because a portable state read must preserve evidence authority and the protected generation contract.

- Every sitemap URL is served `index,follow` with a self canonical to the clean URL (asserted by `scripts/seo/audit-seo-assets.mjs` and `audit-sitemap-integrity`); a page is de-indexed only through `noindex` in `scripts/seo/content-registry.mjs`, which also drops it from the sitemap and requires removing internal links — because sitemap+noindex conflicts triggered GSC indexing alerts.
- `public/llms.txt` and root `llms.txt` are generated only by `scripts/seo/generate-ai-resources.mjs` (`npm run seo:generate-ai`) and gated by `scripts/seo/audit-seo-assets.mjs`; never hand-edit them or append release notes, and change wording in the generator, not the output; generators stay deterministic (no `new Date()`; bump `RELEASE_DATE`/`VERSION`) and `npm run seo:sync-generated` must leave `git diff` clean — because CI runs `git diff --exit-code` after regenerating.
- `docs/llm-context.md` is updated only for architectural changes (new module, table, Edge Function, route contract) in the `PROBLEM -> EDOOQOO SOLUTION -> TECHNICAL MECHANICS -> RAG KEYWORDS` format — because per-fix changelog entries bloat agent context and go stale.
