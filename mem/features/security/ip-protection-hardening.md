---
name: IP Protection Hardening v6.9.7
description: Prompt formatting on backend, devLog mandatory, demo/mock lazy, sourcemaps off, debugger drop
type: feature
---

## v6.9.7 — IP Protection Rules

- **Prompt formatting** for worksheet generation lives ONLY in `supabase/functions/format-worksheet-prompt/index.ts`. Client wrapper `src/utils/promptFormatter.ts` is a thin async invoker. Never move language ladder, CEFR ladder or exercise specs back to the client.
- **Logging:** every new `console.log`/`console.warn` in `src/` MUST be replaced with `devLog`/`devWarn` from `@/utils/logger`. `console.error` is allowed (kept active in prod).
- **Demo/mock content** (`demoWorksheetContent.ts`, `mockNewExercisesData.ts`, `mockWorksheetData.ts`) MUST be `await import(...)`-ed lazily. `buildDemoData` is async — consumers must `.then()`/`await`.
- **Vite config** invariants in `vite.config.ts`: `sourcemap: mode === 'development'`, `manualChunks` isolating demo/mock, `esbuild.drop: ['debugger']`. Do not regress.
- **Worksheet Engine prompt** in `generate-worksheet` is sacred — never modified by this hardening.

**Why:** "Heart of Edooqoo" prompt scaffolding was visible in browser bundle (anyone could `view-source` the language style ladder). Console logs leaked user IDs/tokens/emails. Source maps allowed line-perfect reverse engineering. Demo content (~150 KiB) was scrapable from main chunk on first load.