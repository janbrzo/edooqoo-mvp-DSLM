
# Plan v6.9.31 — Onboarding + Gallery Backfill + Brain-Reset Games + WT Translations

## Kontekst i diagnoza

Zweryfikowałem w bazie i kodzie:

- **Onboarding** (`src/components/OnboardingChecklist.tsx` + `src/hooks/useOnboardingProgress.tsx`) ma dziś 4 kroki: `add_student → generate_worksheet → share_worksheet → create_homework`. Nie pokrywa się z Twoim flow „Setup (Add student → Welcome Test → Goals → Roadmap) + Weekly 1-Minute Prep (Next Lesson Ideas → wybór → worksheet)".
- **Gallery** (`/gallery`, edge `publish-worksheet`, `regenerate-gallery-sitemap`) działa, ale tylko **5/927** worksheetów jest `is_public=true`. Kandydatów z tytułem ≥3 znaków i `ai_response` jest **922**. Część `ai_response` ma niepoprawny JSON — bulk publisher musi to obsłużyć (skip + log).
- **Brain Reset Game** to dziś jeden komponent `BrainResetGame.tsx` (memory pairs). Trzeba dorzucić 1–2 dodatkowe gry i pozwolić użytkownikowi przełączać.
- **Tłumaczenia** — w `src/data/welcomeTestTranslations.ts` 5 dodatkowych pytań profilujących (`wt_q3c, wt_q5c, wt_q7b, wt_q13c, wt_q39`) jest dziś **tylko w POLISH**. Pozostałe 24 języki (Spanish, German, French, Portuguese, Italian, Turkish, Russian, Czech, Ukrainian, Dutch, Japanese, Korean, Chinese, Arabic, Hungarian, Romanian, Greek, Croatian, Swedish, Hindi, Vietnamese, Thai, Norwegian, Danish) wpadają w fallback do angielskiego. Trzeba dodać te 5 pytań we wszystkich 24 językach (skill items `wt_q18–wt_q35, wt_q37, wt_q38` zostają po angielsku — to nie podlega tłumaczeniu zgodnie z istniejącą zasadą).

Sanctity rule: **nie ruszamy promptu generacji worksheetów** ani logiki engine — wszystkie zmiany są w UI, edge functions, danych statycznych i RAG.

---

## Część 1 — Nowy Onboarding Checklist (7 kroków, 2 sekcje)

### 1.1 Nowy model danych

Rozszerzamy `OnboardingStep` w `src/hooks/useOnboardingProgress.tsx`. Zachowujemy stare klucze, aby nie zepsuć istniejących userów (mają zapisany `onboarding_progress` w `profiles`).

```ts
interface OnboardingStep {
  // Setup section
  add_student: boolean;            // existing — keep
  send_welcome_test: boolean;      // NEW
  add_goals: boolean;              // NEW
  generate_roadmap: boolean;       // NEW
  // Weekly 1-Minute Prep section
  generate_next_ideas: boolean;    // NEW
  pick_idea: boolean;              // NEW
  generate_worksheet: boolean;     // existing — keep (was step 2; teraz część prep flow)
  // DEPRECATED — ukryte w UI ale zostają w typie dla wstecznej kompatybilności:
  share_worksheet?: boolean;
  create_homework?: boolean;
}
```

`defaultProgress.steps` dostaje wszystkie nowe pola = `false`. Stary stan z DB (4 pola) zostaje zmergowany z domyślnym przez `{ ...defaultProgress.steps, ...savedProgress.steps }` w obu miejscach gdzie czytamy (`useEffect` na profile + `useEffect` na localStorage). To gwarantuje brak `undefined` errors u istniejących userów.

`getCompletionPercentage()` liczy tylko klucze widoczne w UI (7 nowych); deprecated nie wliczają się. Robimy to przez `const ACTIVE_KEYS = ['add_student','send_welcome_test','add_goals','generate_roadmap','generate_next_ideas','pick_idea','generate_worksheet']` i iterujemy po tym.

### 1.2 Detekcja stanu kroków w `checkSteps()`

Dodajemy do istniejącego `checkSteps` kolejne zapytania do Supabase (równolegle przez `Promise.all`, żeby nie zwiększać latencji):

| Krok | Detekcja |
|---|---|
| `add_student` | bez zmian: `students` po `teacher_id` |
| `send_welcome_test` | `select id from student_tests where teacher_id=? and test_type='welcome' limit 1` (status nieistotny — wystarczy że nauczyciel wysłał) |
| `add_goals` | `select id from student_goals where teacher_id=? limit 1` (jeśli tabela istnieje; jeśli inna nazwa — zweryfikuję w implementacji po `src/components/dslm/GoalsView.tsx`) |
| `generate_roadmap` | `select id from curriculum_phases where teacher_id=? limit 1` (hook `useCurriculumPhases` już używa tej tabeli) |
| `generate_next_ideas` | `select id from student_knowledge_entries where teacher_id=? and category='Next Lesson Ideas' and deleted_at is null limit 1` |
| `pick_idea` | `select id from student_knowledge_entries where teacher_id=? and category='Next Lesson Ideas' and (used_in_worksheet_id is not null or archived_at is not null) limit 1` |
| `generate_worksheet` | bez zmian: `worksheets` |

Jeżeli któreś query zwróci błąd (np. brakuje kolumny), traktujemy jako `false` i zapisujemy w `devLog` — nigdy nie blokujemy checklistu.

Real-time subskrypcje (`postgres_changes`) rozszerzamy o tabele `student_tests`, `curriculum_phases`, `student_knowledge_entries` (insert + update) z filtrem `teacher_id=eq.${profile.id}`. Każdy event → `setTimeout(checkSteps, 500)`.

### 1.3 UI w `src/components/OnboardingChecklist.tsx`

Zmiany czysto prezentacyjne:

- Tytuł karty: `Get started with Edooqoo 🚀` zostaje.
- Dodajemy 2 separatory sekcji wewnątrz listy kroków:
  - Nagłówek **"1. One-time student setup"** (text-xs uppercase, muted) nad krokami: Add student / Send Welcome Test / Add goals / Generate Learning Roadmap.
  - Nagłówek **"2. Weekly 1-Minute Prep"** nad: Generate Next Lesson Ideas / Pick one idea / Create a worksheet.
- Pod nagłówkami krótki, jednoliniowy opis muted-text (po angielsku, bo cała apka jest po angielsku):
  - Setup: *"Teach Edooqoo about your student — one-time."*
  - Prep: *"Your weekly lesson prep flow — under a minute."*
- Każdy krok ma swoją ikonę i akcję:

| Klucz | Label | Ikona (lucide) | Action (button click) |
|---|---|---|---|
| `add_student` | `Add your first real student` | `User` | otwiera `AddStudentDialog` (jak dziś) |
| `send_welcome_test` | `Send Welcome Test` | `ClipboardCheck` | `navigate('/dashboard')` (banner `WelcomeTestSuggestion` już istnieje); jeśli student jest w `useStudents()` jeden — `navigate('/student/${id}?tab=tests')` |
| `add_goals` | `Add learning goals` | `Target` | jeśli 1 student → `navigate('/student/${id}?tab=dslm&section=goals')`, w przeciwnym razie `/dashboard` |
| `generate_roadmap` | `Generate Learning Roadmap` | `Map` | `navigate('/student/${id}?tab=dslm&section=phases')` (PathwayView/GoalsView) |
| `generate_next_ideas` | `Generate Next Lesson Ideas` | `Lightbulb` | `navigate('/student/${id}?tab=dslm&section=next-steps')` |
| `pick_idea` | `Pick one idea` | `MousePointerClick` | jak wyżej, opisowo wskazuje na sekcję |
| `generate_worksheet` | `Create a worksheet` | `FileText` | `navigate('/')` (WorksheetForm — `NextStepsPresetBanner` automatycznie podpowie) |

Każdy "Start" guzik tylko gdy `!completed`. Treści po angielsku, bo cała aplikacja jest po angielsku.

- `progress.completed` triggeruje istniejące confetti — pozostawiamy.

### 1.4 Pomocnicze

- Wersjonowanie kompatybilności: w `useOnboardingProgress` przy migracji ze starego stanu (4-pola → 7+ pól), jeżeli `add_student && generate_worksheet` to ustawiamy `generate_worksheet=true` (i tak go zachowujemy), ale **nie** zaznaczamy nowych kroków jako wykonanych — niech się sprawdzą w pierwszym `checkSteps()` (Supabase i tak je zweryfikuje).

---

## Część 2 — Bulk publish 922 worksheetów do `/gallery`

### 2.1 Nowa edge function `bulk-publish-worksheets`

Plik: `supabase/functions/bulk-publish-worksheets/index.ts`. Wzór: `backfill-welcome-test-auto-apply` (verify_jwt=false + `x-cron-secret` w nagłówku, identyczny pattern co w naszym memie `infrastructure/edge-function-cors-pattern.md`).

Logika:

1. CORS + walidacja `x-cron-secret` (env `CRON_SECRET`).
2. Parse body: `{ limit?: number = 1000, dry_run?: boolean = false, only_teacher_id?: string }`. Zwraca też `cursor` (UUID) dla paginacji.
3. Query batch:
   ```sql
   select id, title, teacher_id, user_id, form_data, ai_response, public_slug
   from public.worksheets
   where deleted_at is null
     and is_public is not true
     and ai_response is not null
     and length(coalesce(title,'')) >= 3
   order by id
   limit $limit;
   ```
4. Dla każdego rekordu w pętli (sekwencyjnie po 50 na batch wewnątrz funkcji, żeby nie zatkać Supabase):
   - Parse `ai_response` w `try/catch`. Jeżeli błąd parse → skip (zaloguj w `skipped_invalid_json++`).
   - Wymuszamy **wszystkie** wymagania zgodne z `publish-worksheet`:
     - `exerciseCount = exercises.length`. Jeśli `< 6` → skip (`skipped_too_short++`).
     - PII regex (`/(\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b|\+?\d[\d\s().-]{7,}\d)/`) na `form_data.additionalInformation`. Jeśli wykryje → skip (`skipped_pii++`).
   - Denormalizacja `public_topic`, `public_level`, `public_exercise_types` — kod 1:1 z `publish-worksheet`.
   - Slug: jeśli `public_slug` istnieje, reuse; inaczej `rpc('generate_public_slug', {p_title, p_id})`.
   - `update` z `is_public=true, public_slug, published_at=now(), public_topic, public_level, public_exercise_types`.
   - Liczniki: `published++`, `errors[]` (max 100 ostatnich).
5. Po pętli: best-effort `fetch(... regenerate-gallery-sitemap)` raz na całość (nie per worksheet).
6. Response JSON: `{ ok: true, scanned, published, skipped_invalid_json, skipped_too_short, skipped_pii, errors: [...] }`.

User wykona ręcznie w SQL Editorze (analogicznie do backfill auto-apply):

```sql
select net.http_post(
  url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/bulk-publish-worksheets',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
  body    := '{"limit": 1000}'::jsonb
);
```

Funkcja jest **idempotentna**: kolejne wywołania pomijają już opublikowane (`is_public is not true` filter). Można uruchamiać wielokrotnie.

### 2.2 Konfig

- `supabase/config.toml`: dodać sekcję `[functions.bulk-publish-worksheets]` z `verify_jwt = false`.
- Sekret `CRON_SECRET` już istnieje (używany przez `audit-llm-models`, `backfill-welcome-test-auto-apply`) — nie tworzymy nowego.

### 2.3 Walidacja po wykonaniu

Po requeście instruuję Cię, byś sprawdził:
```sql
select count(*) from public.worksheets where is_public=true;
-- oczekiwane ~900+ (z 922 kandydatów odpadną przypadki invalid_json / <6 exercises / PII)
```
Następnie wizualne sprawdzenie `https://edooqoo.com/gallery` (paginacja 24/strona).

---

## Część 3 — 2 nowe gry w „pause" Welcome Testu

### 3.1 Architektura — selektor gier

Tworzymy nowy komponent **`src/components/welcome-test/BrainResetGames.tsx`** (orchestrator). Zachowuje API obecnego `BrainResetGame` (drop-in replacement w `WelcomeTestPage.tsx`).

```tsx
type GameKey = 'memory' | 'reaction' | 'sequence';
```

UI: na górze 3 pigułki (Tabs / SegmentedControl z shadcn — `Tabs` jest już używany w aplikacji), pod spodem aktywna gra. Domyślnie losowo wybrana spośród 3, żeby user nie zawsze widział to samo.

Renderuje:
- `'memory'` → istniejący `BrainResetGame` (zostawiamy bez zmian).
- `'reaction'` → **`BrainResetReactionGame.tsx`** (nowa).
- `'sequence'` → **`BrainResetSequenceGame.tsx`** (nowa).

W `WelcomeTestPage.tsx` zamieniamy `<BrainResetGame />` na `<BrainResetGames />` — jedna jednoliniowa zmiana.

### 3.2 Gra 2 — Reaction Tap (`BrainResetReactionGame.tsx`)

Zasada: na ekranie pojawia się 1 świecące koło w losowej pozycji w siatce 4×4 po losowym opóźnieniu 600–1800 ms. User klika jak najszybciej. Mierzymy średni czas reakcji z 10 prób.

Implementacja:
- Stan: `round (0–10)`, `target (idx 0–15 | null)`, `startAt (number)`, `times: number[]`.
- `useEffect` po każdym zresetowaniu `target=null` → `setTimeout(losowo, 600–1800)` ustawia target i startAt = performance.now().
- Klik w kafelek: jeśli `idx===target` → `times.push(now-startAt)`, `target=null`, `round++`. Jeśli zły kafelek → ignoruj (lub mała kara +200ms).
- Po round===10 → ekran wyników: `Avg: 412 ms` + przycisk `Play again`.
- 100% wizualne, brak języka. Używa semantic tokens (`bg-primary`, `bg-muted`).

### 3.3 Gra 3 — Color Sequence (`BrainResetSequenceGame.tsx`)

Klasyczny Simon Says — 4 kolorowe pady (primary, secondary, accent, muted-foreground). System pokazuje sekwencję migająć padami (po 500 ms + 200 ms przerwy), user powtarza klikając. Po sukcesie sekwencja rośnie o 1.

- Stan: `sequence: number[]`, `playerIndex`, `mode: 'watch'|'input'|'gameover'`, `round`.
- Start: `sequence=[random()]`.
- `watch` mode: iterujemy z `setTimeout` po sequence, podświetlając kolejny pad.
- `input` mode: każdy klik porównujemy z `sequence[playerIndex]`. Match → `playerIndex++`; jeśli `playerIndex===sequence.length` → `sequence.push(random())`, wracamy do `watch`. Mismatch → `gameover` + final round.
- Wynik: `You reached round X` + `Try again`.
- Zero języka. Pełna zgodność z design system.

### 3.4 Copy w `BrainResetGames.tsx`

Header: `Quick brain reset · Pick a game` (po angielsku, bez tłumaczeń — krótkie i neutralne). Pod selektorem: `No English required — just relax for a minute.`

---

## Część 4 — Tłumaczenia 5 pytań profilujących na 24 języki

### 4.1 Zakres

Dodajemy do **każdego** z 24 setów (`SPANISH`, `GERMAN`, `FRENCH`, `PORTUGUESE`, `ITALIAN`, `TURKISH`, `RUSSIAN`, `CZECH`, `UKRAINIAN`, `DUTCH`, `JAPANESE`, `KOREAN`, `CHINESE`, `ARABIC`, `HUNGARIAN`, `ROMANIAN`, `GREEK`, `CROATIAN`, `SWEDISH`, `HINDI`, `VIETNAMESE`, `THAI`, `NORWEGIAN`, `DANISH`) klucze:

- `wt_q3c` — scenariusz „budzisz się za 2 lata" (5 opcji + description).
- `wt_q5c` — „środa wieczór, ciężki dzień" (5 opcji, bez description).
- `wt_q7b` — „korekta po błędzie mówienia" (5 opcji, bez description).
- `wt_q13c` — „6 miesięcy nauki bez postępów" (5 opcji, bez description).
- `wt_q39` — „spóźnienie na spotkanie" (4 opcje, bez description) — **uwaga**: opcje to tłumaczone formuły grzecznościowe. To NIE jest klasyczny test skillu gramatycznego/słownikowego — to scenariusz pragmatyki. Tłumaczymy.

Wzorzec tekstu polskiego (linie 85–89) służy jako prawda źródłowa do tłumaczenia. Tłumaczenia wykonywane ręcznie (przeze mnie w build mode) zgodnie z tonalnością istniejących już tłumaczeń w danym secie (sprawdzę 2–3 sąsiednie klucze, by zachować rejestr).

### 4.2 Lokalizacja zmian

Plik: `src/data/welcomeTestTranslations.ts`. Po ostatnim kluczu w każdym secie (przed `};`) dorzucamy 5 nowych wpisów. To czysto addytywna zmiana — żadnych modyfikacji istniejących kluczy.

### 4.3 Sanity check

Nie ma `wt_q39` w polskim secie po `wt_q5b/q13b/q17b/q41b` ułożone tematycznie — ale obecna struktura traktuje je jako mapę kluczy, kolejność nie ma znaczenia (lookup po ID). Po wdrożeniu uruchomimy:

```bash
node -e "const t=require('./src/data/welcomeTestTranslations.ts'); ..."
```
(albo prościej — `rg "wt_q39'" src/data/welcomeTestTranslations.ts | wc -l` musi dać **25** = Polish + 24 nowe).

---

## Część 5 — RAG: aktualizacja `docs/llm-context.md` i `llms.txt`

Dodajemy 4 sekcje w formacie *Problem → Edooqoo Solution → Technical Mechanics → RAG Keywords*:

1. **Onboarding Checklist v2 — Setup + 1-Minute Prep**  
   Tech: `useOnboardingProgress.tsx` rozszerzony o 5 nowych kroków, real-time subscriptions do `student_tests`, `curriculum_phases`, `student_knowledge_entries`. Zachowanie backward-compat dla starych stanów w `profiles.onboarding_progress`. Keywords: onboarding, checklist, weekly prep, welcome test step, learning roadmap step, next lesson ideas step.

2. **Bulk Gallery Publish Backfill**  
   Tech: `bulk-publish-worksheets` edge function (verify_jwt=false + x-cron-secret), reużywa walidacji z `publish-worksheet`, idempotentna, paginowana. Sitemap odświeżany raz po batchu. Keywords: gallery backfill, bulk publish, is_public, public_slug, mass publish worksheets, gallery seeding.

3. **Welcome Test Brain Reset Games (3 minigames)**  
   Tech: `BrainResetGames.tsx` orchestrator z 3 grami (memory pairs, reaction tap, color sequence). Wszystkie language-free, zero persistence, zero impact na test scoring. Keywords: brain reset, paused test, minigame, reaction game, simon says, memory pairs.

4. **Welcome Test Translations Coverage (5 profiling Qs × 25 langs)**  
   Tech: `welcomeTestTranslations.ts` — dodane `wt_q3c, wt_q5c, wt_q7b, wt_q13c, wt_q39` we wszystkich 24 nie-polskich setach. Skill items (`wt_q18–wt_q35, wt_q37, wt_q38`) celowo pozostają po angielsku — tłumaczenie zaburzyłoby pomiar znajomości języka. Keywords: welcome test translations, profiling questions, multi-language, skill items english-only, fallback policy.

Update `mem/index.md` — dopisać do sekcji `## Memories` jeden link do zaktualizowanego `mem/features/welcome-test/auto-apply-and-brain-reset.md` (do tego pliku dopiszemy sekcję o 3 grach i pełnym pokryciu tłumaczeń) oraz nowy `mem/features/onboarding/checklist-v2.md` opisujący 7 kroków, 2 sekcje, backward-compat.

---

## Lista plików (zmienianych / tworzonych)

**Nowe:**
- `supabase/functions/bulk-publish-worksheets/index.ts`
- `src/components/welcome-test/BrainResetGames.tsx`
- `src/components/welcome-test/BrainResetReactionGame.tsx`
- `src/components/welcome-test/BrainResetSequenceGame.tsx`
- `mem/features/onboarding/checklist-v2.md`

**Edytowane:**
- `src/hooks/useOnboardingProgress.tsx` (rozszerzony typ + nowe queries + nowe subskrypcje + ACTIVE_KEYS w %).
- `src/components/OnboardingChecklist.tsx` (2 sekcje, 7 kroków, nowe akcje + ikony).
- `src/data/welcomeTestTranslations.ts` (24 × 5 nowych wpisów).
- `src/pages/WelcomeTestPage.tsx` (`<BrainResetGame />` → `<BrainResetGames />`).
- `supabase/config.toml` (nowa sekcja `[functions.bulk-publish-worksheets]`).
- `docs/llm-context.md`, `llms.txt` (4 nowe sekcje RAG).
- `mem/index.md` (2 nowe linki).
- `mem/features/welcome-test/auto-apply-and-brain-reset.md` (sekcja o 3 grach + pełne pokrycie tłumaczeń).

**Nieruszane:**
- Wszystkie prompty generacji worksheetów (engine sanctity).
- `publish-worksheet/index.ts` (zostaje per-worksheet flow z UI).
- Stary `BrainResetGame.tsx` (pozostaje, tylko opakowany).

---

## Akcje wymagające Twojego udziału po implementacji

1. **Uruchom bulk publish** (jednorazowo, w SQL Editorze Supabase):
   ```sql
   select net.http_post(
     url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/bulk-publish-worksheets',
     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<TWÓJ_CRON_SECRET>'),
     body    := '{"limit": 1000}'::jsonb
   );
   ```
   Funkcja zwróci `{ scanned, published, skipped_* }`. Jeśli `scanned == limit`, uruchom ponownie (idempotentna).

2. **Werifikacja**: `select count(*) from worksheets where is_public=true;` (oczekiwane ~900).

3. **Test gier** w trakcie pause Welcome Testu — sprawdź wszystkie 3 zakładki.

---

## Ryzyka i mitygacje

| Ryzyko | Mitygacja |
|---|---|
| Stary `onboarding_progress` w `profiles` ma 4 pola — nowe komponenty mogą crashnąć na `undefined` | Merge `{ ...defaultProgress.steps, ...savedProgress.steps }` w obu setterach + ACTIVE_KEYS-based %. |
| Bulk publish trafi worksheet z corrupt JSON | try/catch + `skipped_invalid_json` licznik; nigdy nie rzuca. |
| Real-time subskrypcje × 5 tabel zwiększają liczbę kanałów | Zostawiamy istniejący throttling (3s debounce, 30s error backoff) — to wystarczy. |
| Bulk publish wygeneruje 900× hit do `regenerate-gallery-sitemap` | Sitemap regenerujemy **raz** na końcu batcha, nie per worksheet. |
| `wt_q39` jako „pragmatyka" mogłaby być zaliczona do skill — tłumaczenie wpłynie na pomiar | Opcje to formuły grzecznościowe (rejestr formal/informal), nie test gramatyki — pragmatyka skaluje się przez kulturę → tłumaczenie jest poprawne andragogicznie. |

Po Twoim ack przechodzę do implementacji w jednym ciągu (najpierw migracja edge function + UI hook, potem komponenty UI/games, na końcu masowe tłumaczenia + RAG).
