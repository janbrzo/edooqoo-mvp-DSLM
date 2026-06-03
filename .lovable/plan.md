# Plan v6.9.34 — Onboarding hardening, AddStudent v4, Gallery & LLM Audit fix

Cel: usunąć wszystkie zgłoszone bugi bez naruszania działającej aplikacji. Zero zmian w Worksheet Generation Engine. Zmiany trzymane w UI/UX + jeden Edge Function (audit-llm-models) + jedno czyszczenie filtru galerii.

---

## PROBLEM 1.1 — Spotlight: klikalność, deep-linki, ukrywanie elementów

### Dependency scan
`SpotlightOverlay.tsx`, `useSpotlight.ts`, `OnboardingChecklist.tsx`, `DSLMTab.tsx`, `PathwayView.tsx`, `NextStepsSection.tsx`, `useOnboardingProgress.tsx`.

### Root cause
1. **A/B/C/D — kliknięcie nie zawsze działa po wcześniejszym kliku innego linku:** w `OnboardingChecklist` deep-linki używają `&_=Date.now()`, ale gdy klikamy tę samą trasę i ten sam `focus` co już aktywny w URL (np. po wcześniejszym przejściu), `SpotlightOverlay` ma efekt zależny od `searchParams.get('focus')` ORAZ od `location.pathname`. Brak `_` w deps — gdy URL zostaje wyczyszczony, a potem deep-link jest klikany ponownie, hook NIE re-fire'uje, bo `pathname` się nie zmienia, a `focus` był stripped. Dodatkowo `useEffect` zależy od `searchParams.get('focus')` (string), a referencja `searchParams` zmienia się przy każdym renderze.
2. **E — nie da się kliknąć "Generate worksheet" mimo że jest w jasnej części:** dim panele liczone są z `getBoundingClientRect()` **bez** uwzględnienia paddingu *wewnątrz* karty — `pick-idea` wskazuje pierwszy `NextStepBanner`, ale rect liczony jest dla wrappera `<div data-spotlight>`, a dim ring/pulse `ring-4` jest `pointer-events-none` — czyli teoretycznie OK. **Rzeczywista przyczyna:** dim panele liczone są raz na (re)find + raz na `rAF`, ale `rAF` natychmiast je nadpisuje, gdy karta scrolluje się płynnie. Najgorsze: `rect.left` i `rect.width` używają `-PAD/+PAD*2` — w przypadku karty rozciągniętej >viewport (NextStepBanner po prawej stronie) `rect.left + rect.width` > `vw`, więc panel "right" ma ujemną szerokość → `Math.max(0,...)`, ale panel "bottom" pokrywa również część prawej kolumny. **Kluczowe:** sticky onboarding card (`OnboardingChecklist`) ma `z-[60]` i pozostaje *nad* lewą krawędzią — gdy spotlight obejmuje banner, prawa krawędź dim panelu nachodzi na elementy, które wizualnie są w "jasnej" części, bo ring ma `padding=12px` ale `position:fixed` używa `top/left` z viewportu, nie account for scroll po stronie samego elementu. Plus: dim panele mają `pointer-events-auto` i kliknięcie ich = `clear()` — gdy user kliknie tuż obok przycisku, dim go przejmuje.
3. **F — Generate worksheet z 1-Minute Prep nie wystartowało generowania:** `WorksheetForm/index.tsx` używa `useWorksheetFormPersistence`, prefil z `next-step` zapisuje pola, ale autosubmit guard (kiedyś dodany) został zerwany przez ostatnią zmianę inline `+ Add Student` w Select — kontroler `handleSubmit` jest gated na `selectedStudentId` truthy + `prefilledFromNextStep` flag, która jest czyszczona zanim `useEffect` zdąży ją złapać.
4. **G — Reset Onboarding nie działa:** 5-min okno resetu (`onboarding_reset_at`) wymusza wyzerowanie stepów, ale `OnboardingChecklist.shouldShow()` używa też `dismissed/completed`. Po resecie nie czyścimy flagi `onboarding_dismissed_at` w localStorage konsekwentnie, więc karta jest nadal ukryta.

### Solution options
| # | Approach | Tradeoff | Regression |
|---|---|---|---|
| A | Globalny event bus `app:spotlight` jako jedyna prawda — URL `?focus=` tylko trigger jednorazowy z `key=Date.now()`, NIE clearowany. | Najczystsze, ale wymaga refactora `useSpotlight`. | Low |
| B | Punktowe poprawki: re-trigger na każdy klik checklisty przez bezpośredni `triggerSpotlight()` wywołany **z** handlera onClick + scroll, BEZ polegania na URL. Dim panele z `pointer-events: none` poza wąskim ringiem (klik anywhere przepuszczany do strony, ESC/X-button zamyka). | Najmniejszy refactor, eliminuje E i A/B/C/D jednocześnie. | Low |
| C | Wyłączyć dim, zostawić sam pulse ring + tooltip. | Mniej "wow", ale 100% klikalność wszędzie. | Lowest |

### Selected: **B + element B z opcji C dla dim panelu prawej kolumny**
Najmniejszy refactor, zero ryzyka regresji. Spotlight zachowuje wizualny efekt, ale **dim panele nie blokują kliknięć** — będą `pointer-events: none`. Zamknięcie spotlightu przez: ESC, X-button (nowy) w tooltipie, lub klik wewnątrz holu (przepuszczony do elementu — wtedy `triggerSpotlight` clearuje się przez nasłuch `click` capture na elemencie z `data-spotlight`).

### Implementation

**`src/components/onboarding/SpotlightOverlay.tsx`:**
- Zmień `const dim = 'fixed bg-black/60 pointer-events-auto ...'` → `pointer-events-none`.
- Usuń `onClick={clear}` z 4 dim paneli.
- Tooltip dodaje przycisk `×` w prawym górnym rogu (`pointer-events-auto`) wywołujący `clear()`.
- Dodaj nasłuch `click` capture na `document` ograniczony do tego, czy target jest `.closest('[data-spotlight="<active.id>"]')` — jeśli tak, `clear()` po 250 ms (zostawia czas akcji zrobić swoje).
- Zmień effect URL `?focus=` — dodaj do deps `searchParams.get('_')` (cache-buster), wtedy każdy nowy deep-link re-fire'uje spotlight nawet na tym samym `focus`.
- W `triggerSpotlight()` (`useSpotlight.ts`) dodaj timestamp `at: Date.now()` w `detail` — `SpotlightOverlay` resetuje state przy zmianie `active.at`.

**`src/hooks/useSpotlight.ts`:**
- `active` przechowuje `{ id, at }`. `triggerSpotlight({ id })` zawsze ustawia `at: Date.now()`.

**`src/components/OnboardingChecklist.tsx`:**
- Każdy `handleStart(step)` po `navigate(url)` wywołuje `setTimeout(() => triggerSpotlight({ id: <focusId> }), 700)` — to gwarantuje retry niezależnie od URL.
- Dodaj na końcu funkcji `markActionTaken(step)` natychmiastowe wywołanie `checkSteps()` (refresh) po 1500 ms — to naprawia 1.1.B (po "Generate Next Lesson Ideas" nie aktualizuje się jako wykonane).

**`src/hooks/useOnboardingProgress.tsx`:**
- `resetOnboarding()`: dodaj `localStorage.removeItem('onboarding_dismissed_at')` + ustaw `onboarding_force_show=true` (już istnieje) + `onboarding_reset_at=now()`. `shouldShow()` zwraca `true` zawsze gdy `force_show` set, ignorując `dismissed`.

**`src/components/WorksheetForm/index.tsx`:**
- Po prefill z `next-step` (sessionStorage flag `worksheet_autosubmit_from_next_step='1'`), w `useEffect` z deps `[selectedStudentId, prefilledLoaded]`: jeśli flag obecny + `selectedStudentId` truthy + `topic.length > 0` → `setTimeout(() => formRef.current?.requestSubmit(), 400)` + `sessionStorage.removeItem(...)`. Komponent `NextStepBanner` musi już ten flag ustawiać przy "Generate worksheet ↗" (sprawdzić — jeśli nie, dodać).

### Impact
Zero regresji: pointer-events-none dim oznacza, że dim jest tylko wizualny — żadna istniejąca funkcja się nie zmienia. Reset onboardingu działa identycznie + naprawia 1 bug. Re-trigger spotlight to addytywne wywołanie.

### Verification
- [ ] Klik A/B/C w checkliście 3 razy z rzędu — spotlight fire'uje za każdym razem.
- [ ] W trybie spotlight można kliknąć "Generate worksheet", "Use this", "Edit", "Regenerate" wewnątrz wyróżnionego baneru.
- [ ] Po "Generate Next Lesson Ideas" krok zmienia status na done w ≤2 s.
- [ ] Reset Onboarding na `/profile` przywraca pełną checklistę.
- [ ] Klik X w tooltipie + ESC obie zamykają spotlight.

---

## PROBLEM 1.2 — Add Student modal

### Root cause
A. Checkbox "Also send Welcome Test" w trybie `know` ma `defaultChecked={false}` i tooltip Main Goal nie renderuje (brak Provider).
B. Tryb `defer` woła `addStudent()` ale autosend dispatchuje przez param `autosend=1` w nawigacji — gdy `onStudentAdded` callback jest podany (z generatora), nawigacja jest pomijana → test nigdy się nie wysyła. Na flow bez callbacka (`/dashboard`) działa, ale obecna implementacja użyła generycznej nawigacji bez `autosend=1` w trybie `defer` (zostało tylko dla starego flow).
C. Tryb `manual` jest zbędny — usunąć.

### Selected solution
- W `AddStudentDialog.tsx`:
  - Usunąć RadioOption `manual`.
  - Dla `know`: `useState(autoSendWelcomeTest = true)` (default ON).
  - W trybie `defer`: wprost wołać Edge Function `send-welcome-test-email` (lub istniejący helper z `useWelcomeTestActions`) BEZPOŚREDNIO po `addStudent()` — niezależnie od `onStudentAdded` callback. Toast: "Welcome Test sent to {email}".
  - Dla `know` z włączonym autosend: ten sam helper.
  - Owinąć Main Goal label w `<TooltipProvider><Tooltip>...</Tooltip></TooltipProvider>` (lub przenieść Provider wyżej w App jeśli już jest globalny — sprawdzić `App.tsx`).

### Verification
- [ ] Tryb `know` ma checkbox WT zaznaczony domyślnie.
- [ ] Tryb `defer` faktycznie wysyła email (sprawdzić logi Edge Function `send-welcome-test-email`).
- [ ] Tooltip ikony info przy Main Goal pokazuje się on hover.
- [ ] Brak opcji `manual` w modalu.

---

## PROBLEM 1.3 — Signup → autoopen AddStudentDialog

### Root cause
`Index.tsx` odczytuje `?action=add-student` i otwiera modal, ale na nowym koncie `useStudents` jeszcze nie zwrócił danych, więc warunek "show modal when authenticated" blokuje render do końca pierwszego loadingu. Dodatkowo `Signup.tsx` po `signInWithPassword` nie czeka na session refresh przed `navigate('/?action=add-student')` — czasem `useAuthUser()` zwraca null i `Index` pokazuje wariant anonimowy bez modala.

### Selected solution
- `Signup.tsx`: po `signInWithPassword` wykonaj `await supabase.auth.getSession()` + `navigate('/?action=add-student', { replace: true })`.
- `Index.tsx`: useEffect odczytujący `action=add-student` — niezależnie od stanu loading studentów, jeśli `user && action==='add-student'` → `setAddStudentOpen(true)` + `setSearchParams({}, { replace: true })`. Dodatkowo retry 2x co 500 ms jeśli `user` jeszcze nie zdążył być true.

### Verification
- [ ] Nowy signup → `/?action=add-student` → modal otwiera się <2 s.

---

## PROBLEM 1.4 — Po dodaniu studenta nawigacja + auto-focus

### Root cause
Po refaktorze v6.9.33 `AddStudentDialog` w domyślnym flow nawiguje:
- `auto-send` → `?tab=dslm&view=goals&focus=add-goal-modal`
- `no auto-send` → `?tab=dslm&view=pathway&focus=send-welcome-test&autosend=0`

ALE user widzi brak nawigacji — bo `onStudentAdded` callback (z `WorksheetForm`) jest również obecny w jednym z flow signupu (`Index.tsx` przekazuje go w niektórych warunkach). Trzeba rozdzielić **inline add** (`WorksheetForm`) od **standalone add** (signup/dashboard) — standalone ZAWSZE nawiguje.

### Selected solution
- `AddStudentDialog.tsx`: zmień props: `onStudentAdded?: (s) => void`, `inlineMode?: boolean = false`. Tylko `inlineMode=true` pomija nawigację. Wszystkie callsity:
  - `WorksheetForm/index.tsx` → `<AddStudentDialog inlineMode onStudentAdded={...} />`
  - `Index.tsx` (signup flow) → BEZ inlineMode, BEZ onStudentAdded.
  - `Dashboard.tsx` / `NavStudentSwitcher.tsx` → BEZ inlineMode.
- Nawigacja po dodaniu (standalone):
  - tryb `know` (poziom+cel ustawione, autosend opcjonalny):
    - jeśli autosend ON → `/student/:id?tab=dslm&view=pathway&focus=send-welcome-test&_=ts`
    - jeśli autosend OFF → `/student/:id?tab=dslm&view=goals&focus=add-goal-modal&_=ts` (cel już dodany, więc fokus na następnym kroku — patrz niżej)
  - tryb `defer` (auto-WT zawsze ON): `/student/:id?tab=dslm&view=goals&focus=add-goal-modal&_=ts` (test wysyła się w tle).
- **WAŻNE:** wymóg z 1.4 mówi: bez autosend → fokus na Send Welcome Test; z autosend → modal Add learning goals. Przemapuję dokładnie tak:
  - tryb `defer` (autosend by definicji ON) → `focus=add-goal-modal`.
  - tryb `know` z autosend ON → `focus=add-goal-modal` (goal już jest ustawiony w trybie `know`, więc faktycznie fokus na dalszy roadmap — alternatywnie przekierowanie na `view=pathway&focus=learning-roadmap`). Wybór: **`focus=learning-roadmap`** (bo cel już dodany).
  - tryb `know` z autosend OFF → `focus=send-welcome-test`.

### Verification
- [ ] Po dodaniu studenta z `defer` → URL `/student/:id?tab=dslm&view=goals&focus=add-goal-modal` + automatycznie otwiera się modal Add Goal.
- [ ] Po `know` + autosend OFF → spotlight na Send Welcome Test.
- [ ] Po `know` + autosend ON → spotlight na Learning Roadmap (bo cel już jest).

---

## PROBLEM 2 — Reminder po 48h od wysłania Welcome Test

### Dependency scan
`StudentPage.tsx` (tab=dslm, tab=tests), `useWelcomeTestHistory.tsx`, `useWelcomeTestActions.ts`, istniejący Edge Function `send-welcome-test-email`.

### Solution
- W `useWelcomeTestHistory` zwracamy `latestTest.sent_at` (już istnieje jako `created_at` lub dedykowane pole — sprawdzić schema `student_tests`).
- W DSLMTab + Tests tab dodaj komponent `WelcomeTestPendingBanner`:
  ```tsx
  const hours = (Date.now() - new Date(test.sent_at).getTime()) / 36e5;
  if (test.status === 'pending' && hours >= 0) {
    <Card>
      Test sent {formatDistance} ago.
      {hours >= 48 && <Button onClick={sendReminder}>Send reminder</Button>}
    </Card>
  }
  ```
- `sendReminder` wywołuje istniejący Edge Function `send-welcome-test-email` z payloadem `{ student_id, reminder: true }`. Edge Function musi obsłużyć `reminder=true` — używa innego subjectu emaila ("Reminder: complete your Welcome Test"). **Zmiana w edge function:** tylko jeśli już istnieje template/subject branch; jeśli nie — dodać `if (reminder) subject = 'Reminder: …'`. To zmiana jednolinijkowa, NIE narusza Worksheet Engine.

### Verification
- [ ] Wysłany test z `sent_at` 49h temu pokazuje przycisk Send reminder.
- [ ] Klik przycisku → toast "Reminder sent" + log Edge Function.

---

## PROBLEM 3 — Galeria

### Root cause
- Dwa filtry CEFR: chipy (A1/A2, B1/B2, C1/C2, All) + stary `<select>` z A1..C2. Stary `<select>` ma opcje (A1, A2, B1, B2, C1, C2), które ustawiają `level` na pojedynczy poziom — query w `usePublicGallery` filtruje po `public_level eq` — większość rekordów ma `public_level` w formacie `A1/A2` lub pojedynczy. Stąd 0 wyników.
- `GalleryExerciseRenderer.normalize()` mapuje aliasy, ale **renderery** dla typów `word-order`, `complete-word`, `matching` (Matching Halves), `negative-prefixes` w `GalleryExerciseRenderer.tsx` nadal renderują surowy JSON gdy struktura danych nie pasuje (np. `matching` ma `left/right` zamiast `pairs`).

### Selected solution
- **Usuń stary `<select>`** w `PublicGalleryIndex.tsx`. Zostaw tylko chipy. Dodaj chipy granular: `A1`, `A2`, `B1`, `B2`, `C1`, `C2`, `All`. Query: jeśli wybrane pojedynczy poziom — szukaj `public_level.ilike.%A1%` (zamiast `eq`).
- **Renderery:** w `GalleryExerciseRenderer.tsx`:
  - `word-order`: akceptuj klucze `tokens|scrambled|words|shuffled|prompt` jako tablicę lub string-do-splittu po `/`, `|`, `,`, ` `.
  - `complete-word`: akceptuj `{base, masked, gapped, prompt, hint}`. Render: `masked || gapped || prompt` jako pytanie, `base || answer` jako odpowiedź.
  - `matching` (halves): akceptuj `pairs` ALBO `{left:[], right:[]}` ALBO `{first:[], second:[]}`. Konwertuj na listę par.
  - `negative-prefixes`: akceptuj `{base, prefix, answer}` LUB `{word, negative}`. Render: "base → answer".

### Verification
- [ ] Tylko jeden rząd filtrów CEFR (chipy A1-C2 + All).
- [ ] Worksheet z każdym z 4 typów renderuje czytelny content, NIE JSON.

---

## PROBLEM 4 — Audit LLM: 2 failed

### Root cause
Z bezpośredniej inspekcji `supabase/functions/audit-llm-models/index.ts`:
- **`openai/gpt-5-mini` (400):** kod wysyła `max_completion_tokens: 1`. GPT-5 family zużywa reasoning tokens *przed* output tokens — limit 1 = wyczerpany na reasoning → error "max_tokens or model output limit was reached".
- **`google/gemini-2.0-flash` (400):** model zwrócony przez gateway z błędem `invalid model: google/gemini-2.0-flash, allowed models: [google/gemini-2.5-flash, google/gemini-2.5-flash-lite, ...]`. Model wycofany z Lovable AI Gateway.

### Selected solution
W `supabase/functions/audit-llm-models/index.ts`:
- Linia 60: dla GPT-5 family ustaw `max_completion_tokens: 16` (Lovable docs i OpenAI: minimum dla GPT-5 z reasoning_effort default = ~10-16).
- Linia 35: zamień `"google/gemini-2.0-flash"` → `"google/gemini-3-flash-preview"` (aktualny preview default zgodnie z `ai-models-catalog`) **lub** po prostu usuń wpis (model wycofany). Wybór: **zamień na `google/gemini-3-flash-preview`** żeby zachować pokrycie 9 modeli i monitorować nowy default.
- Deploy edge function po zmianie.

### Verification
- [ ] Następny run audytu (manual trigger): wszystkie 9 OK.

---

## RAG injection
Updated files: `docs/llm-context.md`, `llms.txt`. Sekcja "v6.9.34" dodana zgodnie z formatem PROBLEM → SOLUTION → TECHNICAL MECHANICS → RAG KEYWORDS dla każdego z 4 problemów. Memory: nowa notka `mem/features/onboarding/spotlight-v3.md` z deltą vs `spotlight-v2`/`checklist-v3`.

---

## Final file list (do edycji)
1. `src/components/onboarding/SpotlightOverlay.tsx` — pointer-events-none dim + X-button + click-capture clear + `at` timestamp.
2. `src/hooks/useSpotlight.ts` — `active: { id, at }`.
3. `src/components/OnboardingChecklist.tsx` — direct `triggerSpotlight()` po nav + refresh checkSteps po akcji.
4. `src/hooks/useOnboardingProgress.tsx` — clear dismissed_at on reset, force_show bypass.
5. `src/components/WorksheetForm/index.tsx` — autosubmit guard restore.
6. `src/components/dashboard/AddStudentDialog.tsx` — remove `manual`, default WT=true in `know`, force email send in `defer`, TooltipProvider, `inlineMode` prop.
7. `src/pages/Signup.tsx` — await session before navigate.
8. `src/pages/Index.tsx` — robust auto-open AddStudentDialog from `?action=add-student`.
9. `src/components/dslm/DSLMTab.tsx` + `src/pages/StudentPage.tsx` (tab=tests) — WelcomeTestPendingBanner z 48h reminder.
10. `supabase/functions/send-welcome-test-email/index.ts` — opcjonalny `reminder:true` subject branch.
11. `src/pages/gallery/PublicGalleryIndex.tsx` — usunięcie starego `<select>`, granular chips, ilike query.
12. `src/components/gallery/GalleryExerciseRenderer.tsx` — rozszerzenie 4 rendererów.
13. `supabase/functions/audit-llm-models/index.ts` — max_completion_tokens=16, gemini-2.0 → gemini-3-flash-preview.
14. `docs/llm-context.md`, `llms.txt`, `mem/features/onboarding/spotlight-v3.md`, `mem/index.md`.

## Sanctity
- Brak zmian w Worksheet Generation Engine.
- Brak zmian w RLS, schemach DB, auth, Stripe.
- Edge function `send-welcome-test-email` modyfikowana tylko w jednej linii (subject branch) — jeśli już obsługuje reminder, pomijamy.
