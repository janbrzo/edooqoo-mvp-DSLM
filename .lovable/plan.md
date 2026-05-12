# Plan: Bulk-restore 63 Edge Functions z `supabase.rar` do repo

## Walidacja Twojego archiwum (PASS)

```
supabase/
├── .temp/                   ← ignoruję (CLI metadata)
└── functions/
    ├── deno.json            ← ignoruję (mamy zinline'owane w funkcjach)
    ├── _shared/
    │   ├── dslmPromptCore.ts
    │   ├── exerciseTaxonomy.ts
    │   ├── logError.ts
    │   └── email-templates/
    │       ├── homework-notification.tsx
    │       ├── homework-reminder.tsx
    │       ├── homework-submission.tsx
    │       └── worksheet-notification.tsx
    └── <63 katalogów funkcji>/
        └── index.ts (+ czasem podpliki)
```

**Status:**
- 63 funkcje obecne, każda ma `index.ts` ✓
- 2 funkcje mają dodatkowe podpliki (kopiuję cały katalog):
  - `create-export-payment/` (security.ts, stripe-service.ts, validation.ts)
  - `submitFeedback/` (database.ts, rateLimiter.ts, validation.ts)
- `_shared/` ma 4 elementy — wszystkie idą do `supabase/functions/_shared/`
- Brak konfliktów z 4 funkcjami już w repo (`classify-knowledge-entry`, `format-worksheet-prompt`, `generate-curriculum-phases`, `send-welcome-email`) — Twój eksport ich nie zawiera, zgodnie z planem
- Brak `config.toml` w archiwum — zachowujemy istniejący `supabase/config.toml` w repo nietknięty
- Total 690 KB — daleko poniżej limitów

## Implementacja (jeden krok)

1. **Skopiuj `supabase/functions/_shared/`** z `/tmp/sb/supabase/functions/_shared/` → `supabase/functions/_shared/` (rekurencyjnie, łącznie z `email-templates/`)
2. **Skopiuj 63 katalogi funkcji** z `/tmp/sb/supabase/functions/<name>/` → `supabase/functions/<name>/` (cały katalog, łącznie z podplikami dla `create-export-payment` i `submitFeedback`)
3. **Pomiń:** `.temp/`, `functions/deno.json` (per-folder w stylu CLI — w naszym repo każda funkcja jest samowystarczalna; brak tego pliku nie szkodzi Lovable deploymentom)
4. **Nie tykam:** `supabase/config.toml`, 4 istniejące funkcje, `generateWorksheet` (nieobecna w archiwum — Sanctity zachowana)

## Zerowe modyfikacje kodu

- Bez zmian w wordingu promptów, importach, CORS, secrets, logowaniu
- Bez normalizacji line-endings (CLI eksportuje już LF)
- Bez „przy okazji fixów"
- Cel: bit-perfect copy → repo i deploy = no-op funkcjonalne

## Weryfikacja po kopiowaniu

- `ls supabase/functions/` → 67 katalogów (4 stare + 63 nowe + `_shared`)
- Spot-check 3 losowych funkcji: pierwsze 5 linii `index.ts` zaczynają się od `import`/`Deno.serve`
- Raport: lista skopiowanych funkcji + lista plików w `_shared/`

## Auto-deploy

Lovable wykryje nowe pliki i automatycznie zdeployuje. Ponieważ kod = 1:1 z tym co w Supabase, to no-op funkcjonalne (tylko bump deployment count). Jeśli któryś deploy padnie — łapię w logach, raportuję, próbujemy `supabase--deploy_edge_functions` ręcznie.

## Świadomie odłożone (osobne iteracje)

- Governance / 4-warstwowa polityka Sanctity
- Plan v6.9.15 (Problemy 1-4: timeline 500, banner row, renumbering, info-boxes)
- Procedure A/B/C audit
- Update `docs/llm-context.md` + `llms.txt` (zrobimy razem z v6.9.15a)

## Deliverable

Po zatwierdzeniu — jednorazowa operacja kopiowania, raport, koniec. Czas: ~2 min.
