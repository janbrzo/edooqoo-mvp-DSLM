---
name: Vertex image fallback chain + default Waves background
description: v6.9.62/v6.9.63 — generate-image defaults to accessible gemini-2.5-flash-image, normalizes legacy 3.1 preview override, and uses gemini-2.5-flash for image descriptions; AppBackground migration v2 defaults authenticated teachers to waves.
type: feature
---
- `supabase/functions/generate-image/index.ts` MODEL_CHAIN ordering after v6.9.63: `normalizeImageModel(Deno.env.get('GEMINI_IMAGE_MODEL'))` first, then `gemini-2.5-flash-image`, then `gemini-3.1-flash-image`. Empty env and legacy `gemini-3.1-flash-image-preview` normalize to `gemini-2.5-flash-image` because this GCP project returned Vertex 404 for 3.1 in `us-central1`. Fallback ONLY on 404 / NOT_FOUND / "is not found" / "does not exist" / "unsupported" — never on 5xx (that would hide real provider failures).
- The visual description step must not use deprecated `gemini-2.0-flash`; use `GEMINI_DESCRIPTION_MODEL || gemini-2.5-flash`, then `gemini-2.5-flash-lite` fallback.
- Each model attempt logs via `logModelFailure(model, provider='google-vertex', status, endpoint, error, functionName='generate-image')`.
- `src/components/ui/AppBackground.tsx` uses `MIGRATION_KEY_V2 = 'edooqoo-bg-pattern-migrated-v2'`. Migration runs once: authenticated → 'waves', anonymous → 'particles'. After v2 the manual `BackgroundPatternSwitcher` selection persists.
