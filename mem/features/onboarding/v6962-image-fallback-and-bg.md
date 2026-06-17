---
name: Vertex image fallback chain + default Waves background
description: v6.9.62 — generate-image walks GEMINI_IMAGE_MODEL → gemini-2.5-flash-image → gemini-3.1-flash-image-preview on 404/NOT_FOUND; AppBackground migration v2 defaults authenticated teachers to waves.
type: feature
---
- `supabase/functions/generate-image/index.ts` MODEL_CHAIN ordering: `Deno.env.get('GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-image'` first, then unique fallbacks. Fallback ONLY on 404 / NOT_FOUND / "is not found" / "does not exist" / "unsupported" — never on 5xx (that would hide real provider failures).
- Each model attempt logs via `logModelFailure(model, provider='google-vertex', status, endpoint, error, functionName='generate-image')`.
- `src/components/ui/AppBackground.tsx` uses `MIGRATION_KEY_V2 = 'edooqoo-bg-pattern-migrated-v2'`. Migration runs once: authenticated → 'waves', anonymous → 'particles'. After v2 the manual `BackgroundPatternSwitcher` selection persists.
