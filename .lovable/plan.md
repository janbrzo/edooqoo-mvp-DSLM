
# Plan v6.9.32 — Onboarding Spotlight + Add Student v2 + Gallery Backfill

## Kontekst diagnostyczny (co znalazłem)

1. **Deep-linki w `OnboardingChecklist.tsx` używają `?section=...`**, ale `DSLMTab.tsx` czyta `searchParams.get('view')` i jeszcze rozpoznaje sub-sekcje przez własny event `dslm:openSubsection`. Stąd "linkuje na górę" zamiast scrollować.
2. **Onboarding nie ma mechanizmu "spotlight"** — kliknięcie kroku tylko nawiguje, nie przyciąga uwagi do celu.
3. **`AddStudentDialog`** ma `max-h-[85vh] overflow-y-auto` — przy zwykłym laptopie pojawia się scroll. Pola CEFR i Main Goal są wymagane bez opcji "uzupełnię po teście".
4. **Po dodaniu ucznia** `handleSubmit` nawiguje na `?tab=overview` (linia 162) — chcemy `?tab=dslm` + spotlight albo auto-otwarcie Add Goals.
5. **`Reset Onboarding`** w `Profile.tsx` wywołuje `resetOnboarding()`, ale `checkSteps()` natychmiast wykrywa istniejące dane w DB i ponownie ustawia `completed=true` → checklist znika. Brakuje override flagi.
6. **`NavStudentSwitcher`** popover nie ma przycisku "Add Student" obok nagłówka "Switch to student".
7. **Bulk-publish galerii**: DB pokazuje 927 worksheetów (`deleted_at is null`), z czego tylko **5 jest publicznych**. Edge function `bulk-publish-worksheets` istnieje i jest poprawny, ale wymaga prawidłowego `x-cron-secret`. Wywołanie z dosłownym `<TWÓJ_CRON_SECRET>` zwróciło 401 → faktycznie nic nie zostało opublikowane. Musimy: (a) zweryfikować że secret istnieje, (b) wystawić bezpieczny, autoryzowany sposób uruchomienia (migracja SQL przez `service_role` zamiast HTTP), (c) wykonać batch z paginacją.

## Zakres pracy — pliki

```text
NOWE:
  src/components/onboarding/SpotlightOverlay.tsx
  src/hooks/useSpotlight.ts
  supabase/migrations/<ts>_bulk_publish_worksheets.sql   (idempotentna SQL)

EDYCJE:
  src/components/OnboardingChecklist.tsx       (deep-linki + spotlight params)
  src/components/dashboard/AddStudentDialog.tsx (compact layout + 2 nowe opcje + nawigacja)
  src/components/landing/NavStudentSwitcher.tsx (przycisk Add Student w popover)
  src/components/dslm/DSLMTab.tsx              (parsowanie ?focus= + dispatch spotlight)
  src/components/welcome-test/WelcomeTestPanel.tsx  (data-spotlight="send-welcome-test")
  src/components/dslm/PathwayView.tsx          (data-spotlight na "1-MINUTE PREP SUGGESTIONS")
  src/components/dslm/GoalsView.tsx            (data-spotlight + obsługa ?focus=add-goal -> otwórz modal)
  src/components/student-tests/WelcomeTestResults.tsx (Apply CEFR-from-test CTA gdy student nie ma poziomu)
  src/hooks/useOnboardingProgress.tsx          (shouldShow override + reset wymusza force-show)
  src/pages/StudentPage.tsx                    (po dodaniu ucznia: domyślny tab=dslm gdy ?focus jest w URL)
  src/constants/studentGoals.ts                (Custom Goal jako pierwsza opcja)
  docs/llm-context.md, llms.txt, mem/index.md, mem/features/onboarding/spotlight-v2.md (RAG)
```

Nie ruszamy: prompta worksheet generator, RLS, schemy DSLM, logiki testów (poza dodaniem przycisku Apply CEFR).

---

## 1. Spotlight Overlay — uniwersalny mechanizm "zwróć uwagę"

### 1.1 `useSpotlight.ts` (nowy)
Globalny hook + event-bus:

```ts
type SpotlightId = 'send-welcome-test' | 'next-lesson-ideas' | 'pick-idea' | 'add-goal-modal';

window.dispatchEvent(new CustomEvent('app:spotlight', { detail: { id, durationMs?: 8000 } }));
```

Hook: nasłuchuje eventu, zwraca `{ activeId, clear() }`. Auto-clear po `durationMs` lub na ESC / klik tła.

### 1.2 `SpotlightOverlay.tsx` (nowy, mount w `App.tsx`)
- Renderuje **portal** z półprzezroczystym `bg-black/60` na całym viewport.
- Znajduje element `[data-spotlight="${activeId}"]`, oblicza jego `getBoundingClientRect()`.
- Renderuje "okno" (radial mask SVG z dziurą) wokół elementu + obramowanie `ring-4 ring-primary animate-pulse` + tooltip "Click here to continue" pod elementem.
- Klik wewnątrz dziury przechodzi do elementu (pointer-events: none na masce nad dziurą).
- Auto-scroll do elementu: `el.scrollIntoView({ block: 'center', behavior: 'smooth' })`.
- Na resize/scroll: re-kalkulacja co `requestAnimationFrame`.
- Nasłuchuje URL param `?focus=<id>` (poprzez `useSearchParams`): po pojawieniu się, dispatch `app:spotlight`, następnie czyści `focus` z URL (`setSearchParams` bez param) żeby kolejne nawigacje nie reaktywowały.

**Dlaczego portal + URL param**: pozwala na wskazanie celu zarówno z `OnboardingChecklist` (przez nawigację `?focus=...`) jak i z lokalnych komponentów (po akcji w aplikacji, np. po wysłaniu Welcome Test).

### 1.3 Mount
W `src/App.tsx` (lub główny layout teacher-only) dodać `<SpotlightOverlay />` zaraz po `<Toaster />`.

---

## 2. Naprawa deep-linków w `OnboardingChecklist.tsx`

Zmiana wszystkich linków na `?tab=dslm&view=<ID>&focus=<spotlight>`:

| Krok                       | Nowy deep-link                                                       | Akcja dodatkowa                              |
|----------------------------|----------------------------------------------------------------------|----------------------------------------------|
| A. Add first real student  | otwiera `AddStudentDialog` (już działa — bez zmian)                  | sprawdź `triggerButton={false}`              |
| B. Send Welcome Test       | `/student/{id}?tab=overview&focus=send-welcome-test`                 | scroll + spotlight na panel Welcome Test     |
| C. Add learning goals      | `/student/{id}?tab=dslm&view=goals&focus=add-goal-modal`             | spotlight + auto-open Add Goal modal         |
| D. Generate Learning Roadmap | `/student/{id}?tab=dslm&view=pathway&focus=learning-roadmap`       | spotlight na sekcję "Learning Roadmap"       |
| E. Generate Next Lesson Ideas | `/student/{id}?tab=dslm&view=pathway&focus=next-lesson-ideas`     | spotlight na "1-MINUTE PREP SUGGESTIONS" generator |
| F. Pick one idea → przemianować na **"Use one suggestion"** | `/student/{id}?tab=dslm&view=pathway&focus=pick-idea` | spotlight na pierwszą kartę sugestii (zielony przycisk "Use this") |
| G. Create a worksheet      | `/` (bez zmian)                                                      | —                                            |

Etykieta F: `label: 'Use one Next Lesson suggestion'`, ikona bez zmian.

W `DSLMTab.tsx` w bloku "On mount, scroll to URL view param" dodać:
```ts
const focus = searchParams.get('focus');
if (focus) {
  // Daj DOM-owi czas na render i scroll
  setTimeout(() => window.dispatchEvent(new CustomEvent('app:spotlight', { detail: { id: focus } })), 600);
}
```

Targety `data-spotlight`:
- `send-welcome-test` → panel "Send a Welcome (placement) Test" na Overview tab.
- `learning-roadmap` → wrapper sekcji "Learning Roadmap" w `PathwayView.tsx`.
- `next-lesson-ideas` → blok "Generate 1-Minute Prep suggestions" (przycisk + heading) w `PathwayView.tsx`.
- `pick-idea` → pierwsza karta `1-MINUTE PREP SUGGESTION #1` (klasa już istnieje — atrybut na pierwszym elemencie listy).
- `add-goal-modal` → sekcja Goals header + auto-open modal Add Goal (GoalsView nasłuchuje na `focus=add-goal-modal` i klika own "Add Goal" trigger).

---

## 3. `AddStudentDialog` v2 — compact + 2 nowe opcje

### 3.1 Layout (mieści się na 1 ekranie)
- `DialogContent`: `sm:max-w-[480px]`, **usuń** `max-h-[85vh] overflow-y-auto`. Zostaw `max-h-[90vh] overflow-y-auto` tylko jako safety net dla bardzo małych ekranów.
- Zmniejsz odstępy: `space-y-4` → `space-y-3`, etykiety bez separacji `space-y-2` → `space-y-1`, removal of opisów pomocniczych pod polami (przenieść w tooltipy `?`).
- Zgrupuj `Native Language` i `Send overdue` jako dwa rzędy 2-kolumnowe (`grid grid-cols-2 gap-3`).

### 3.2 English Level — opcja "I'll fill after Welcome Test"
Pod selectem dodać:
```
[ ] I'll set level after Welcome Test
    ↳ when checked:
       - select disabled, value=''
       - pokazuje sub-checkbox: [x] Automatically send Welcome Test now
```

Validation: jeśli `deferLevel === true`, `englishLevel` nie jest wymagane. W payloadzie do `addStudent` przekazujemy `english_level: null` (DB pozwala — zweryfikuj NOT NULL; jeśli jest NOT NULL → migracja: `ALTER TABLE students ALTER COLUMN english_level DROP NOT NULL` w wpisie poniżej).

### 3.3 Main Goal — Custom pierwszy + deadline + "I'll fill later"
- W `src/constants/studentGoals.ts`: przenieść `{ value: 'custom', label: 'Custom goal…' }` na pozycję 0.
- Dodać checkbox `[ ] I'll set goal after Welcome Test` (analogicznie do CEFR).
- Dodać pole `Deadline (optional)` → `<Input type="date" />`. Zapisz jako `main_goal_deadline` (data) — kolumna musi istnieć; jeśli nie, migracja `ALTER TABLE students ADD COLUMN main_goal_deadline date`.
- Jeśli oba defery zaznaczone → ukryj sub-checkbox auto-send (wystarczy jedno).

### 3.4 Nawigacja po dodaniu (`handleSubmit`)
Logika decyzyjna:
```ts
const autoSend = deferLevel || deferGoal ? autoSendWelcomeTest : false;
if (autoSend) {
  await sendWelcomeTest(newStudent.id);  // istniejąca akcja (useWelcomeTestActions)
  navigate(`/student/${newStudent.id}?tab=dslm&view=goals&focus=add-goal-modal`);
} else {
  // student ma pełne dane → kieruj do DSLM i podświetl Welcome Test panel
  navigate(`/student/${newStudent.id}?tab=overview&focus=send-welcome-test`);
}
```

### 3.5 Brak CEFR — globalne podpowiedzi
W miejscach gdzie wyświetlamy `english_level` (np. `StudentDetails`, `NavStudentSwitcher` badge, `OnboardingProgressList`) dodać warunek:
```tsx
{student.english_level
  ? <Badge>{student.english_level}</Badge>
  : <Badge variant="outline" className="text-amber-600">Set level →</Badge>}
```
Klik w taki badge → `navigate(?tab=overview&focus=send-welcome-test)`.

### 3.6 `WelcomeTestResults.tsx` — przycisk "Apply suggested level"
Jeśli `student.english_level == null` lub różni się od wyniku testu, pokaż CTA:
```
Suggested CEFR from test: B1   [ Apply to student ]
```
Klik → `update students set english_level='B1' where id=...` + toast. Mechanika identyczna jak istniejący auto-apply (już w `mem://features/welcome-test/auto-apply-and-brain-reset`), tylko ręczny trigger.

---

## 4. Reset Onboarding — naprawdę działa

W `useOnboardingProgress.tsx`:

```ts
const resetOnboarding = async () => {
  localStorage.setItem('onboarding_force_show', '1');
  sessionStorage.removeItem('onboarding-temp-dismissed');
  const newProgress: OnboardingProgress = { ...defaultProgress, dismissed: false, completed: false };
  setProgress(newProgress);
  await saveProgress(newProgress);
};

const shouldShow = () => {
  if (isDemoMode || isAnonymousUser) return false;
  const isAnonymous = !profile?.email || profile.email === '';
  if (isAnonymous || !profile?.id) return false;
  if (localStorage.getItem('onboarding_force_show') === '1') return true;   // ← override
  return !progress.dismissed && !progress.completed;
};
```

Klik "Dismiss checklist" usuwa `onboarding_force_show`. Klik "X" (temp dismiss) zostawia override (znika do końca sesji). Po wykonaniu wszystkich kroków: jeśli `force_show` aktywne i `completed=true`, pokaż gratulacje + przycisk "Hide" który usuwa flagę.

---

## 5. `NavStudentSwitcher` — przycisk "+ Add" w popover

Edytuj nagłówek popover:

```tsx
<div className="flex items-center justify-between px-3 py-2 border-b">
  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
    Switch to student
  </span>
  <Button size="sm" variant="ghost" className="h-6 px-2 gap-1 text-xs"
          onClick={() => { setOpen(false); setAddOpen(true); }}>
    <Plus className="h-3 w-3" /> Add
  </Button>
</div>
…
<AddStudentDialog triggerButton={false} open={addOpen} onOpenChange={setAddOpen} />
```

Zmień warunek `if (!loading && sorted.length === 0) return null;` na: zawsze renderuj (potrzebny przycisk Add nawet gdy 0 studentów) — komponent jest już używany tylko dla zalogowanych nauczycieli.

---

## 6. Gallery — dokończenie bulk-publish (927 → ~900 public)

### 6.1 Diagnoza: dlaczego dotychczas tylko 5
Wywołanie z literalnym `<TWÓJ_CRON_SECRET>` w SQL zwróciło 401. Edge function nigdy nie przetworzyła rekordów.

### 6.2 Rozwiązanie — migracja SQL idempotentna (zero zależności od CRON_SECRET)

Tworzymy migrację SQL która replikuje walidację:

```sql
-- Backfill: publish all eligible worksheets (>= 6 exercises, valid JSON, no PII)
WITH eligible AS (
  SELECT
    w.id,
    w.title,
    COALESCE(w.public_slug, public.generate_public_slug(w.title, w.id)) AS slug,
    LOWER(COALESCE(w.form_data->>'topic', 'general')) AS topic,
    COALESCE(w.form_data->>'englishLevel', w.form_data->>'cefr', 'B1') AS lvl,
    ARRAY(
      SELECT DISTINCT (e->>'type')
      FROM jsonb_array_elements((w.ai_response::jsonb)->'exercises') e
      WHERE e->>'type' IS NOT NULL
      LIMIT 12
    ) AS ex_types
  FROM public.worksheets w
  WHERE w.deleted_at IS NULL
    AND w.ai_response IS NOT NULL
    AND (w.is_public IS NULL OR w.is_public = FALSE)
    AND length(trim(w.title)) >= 3
    AND jsonb_typeof((w.ai_response::jsonb)->'exercises') = 'array'
    AND jsonb_array_length((w.ai_response::jsonb)->'exercises') >= 6
    AND COALESCE(w.form_data->>'additionalInformation', '') !~ '(\m[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\M|\+?\d[\d\s().-]{7,}\d)'
)
UPDATE public.worksheets w
   SET is_public = TRUE,
       public_slug = e.slug,
       published_at = COALESCE(w.published_at, now()),
       public_topic = LEFT(e.topic, 120),
       public_level = LEFT(e.lvl, 20),
       public_exercise_types = e.ex_types
  FROM eligible e
 WHERE w.id = e.id;
```

Walidacje SQL = lustro logiki TS w `bulk-publish-worksheets/index.ts` (>= 6 exercises, title >= 3, regex PII).
Idempotent: filtruje `is_public IS NULL OR FALSE`. Bezpieczna: tylko własna funkcja `generate_public_slug` (już istnieje).

### 6.3 Po migracji
- Wywołaj edge function `regenerate-gallery-sitemap` z poziomu UI (admin) lub przez SQL `select net.http_get(...)` (już istnieje wzorzec). Jeśli przeszkoda — pominąć, sitemap regeneruje się przy następnym buildzie SEO workflow.

### 6.4 Edge function `bulk-publish-worksheets` zostaje
Jako narzędzie do **przyrostowego** uruchamiania (np. cron co dobę). Naprawiamy tylko dokumentację: dodajemy notkę w `docs/llm-context.md` że **właściwy** sposób one-shot backfillu to migracja SQL, bo HTTP wymaga ważnego CRON_SECRET.

---

## 7. Migracje DB (jeden plik)

```sql
-- 1. Pozwól na pusty english_level i goal (deferred)
ALTER TABLE public.students ALTER COLUMN english_level DROP NOT NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS main_goal_deadline date;
-- (main_goal już dopuszcza NULL — zweryfikować; jeśli NOT NULL → DROP NOT NULL)

-- 2. Bulk-publish backfill (sekcja 6.2)
… (jak wyżej)
```

GRANT-y dla `students` istnieją (tabela już używana). Brak nowych RLS — kolumny tylko dodawane.

---

## 8. RAG Documentation Update (Problem → Solution → Mechanics)

### 8.1 `docs/llm-context.md` — nowa sekcja **v6.9.32 — Spotlight Onboarding + Add Student v2 + Gallery Backfill**

```
### Problem
Teachers click onboarding steps but land at the wrong scroll position or without
visual cue what to do next. Add Student modal forces CEFR/Main Goal even when
teacher hasn't met student yet. Gallery shows only 5/927 worksheets because
bulk-publish HTTP call returned 401 (cron secret literal).

### Edooqoo.com Solution
- Global SpotlightOverlay (radial mask + ring-pulse) driven by URL `?focus=<id>`
  and `app:spotlight` events.
- Onboarding deep-links use `?tab=dslm&view=<id>&focus=<spotlight>` instead of
  legacy `?section=`.
- AddStudentDialog supports `defer_level` / `defer_goal` with auto-send Welcome
  Test. Custom Goal is first. Compact single-screen layout.
- After add: navigate to DSLM with spotlight or auto-open Add Goal modal.
- Reset Onboarding sets `localStorage.onboarding_force_show=1` so checklist
  re-appears even though steps re-detect as completed.
- NavStudentSwitcher exposes inline `[+ Add]` next to "Switch to student".
- Bulk gallery publish executed via idempotent SQL migration (CTE) instead of
  HTTP — same validation (>=6 exercises, title>=3, PII regex).

### Technical Mechanics
- Components: SpotlightOverlay.tsx (portal), useSpotlight.ts (event bus).
- Targets: data-spotlight="send-welcome-test|learning-roadmap|next-lesson-ideas|pick-idea|add-goal-modal".
- DSLMTab reads `?focus=` once on mount → dispatches event after 600ms.
- Migration: WITH eligible AS (...) UPDATE worksheets SET is_public=true.
- DB: students.english_level → nullable, +main_goal_deadline date.

### RAG Keywords
onboarding spotlight, focus highlight, dim background, Add Student modal, defer
CEFR, defer goal, auto-send welcome test, reset onboarding, gallery backfill,
bulk publish worksheets, public_slug, generate_public_slug, force_show.
```

### 8.2 `llms.txt`
Skrócony kondensat (≤30 linii) z listą plików zmienianych + link do migracji.

### 8.3 `mem/features/onboarding/spotlight-v2.md` (nowy)
Pełen opis 7 spotlight-targets i protokołu URL `?focus=`. + Sanctity rule: nie zmieniać prompta worksheet.

### 8.4 `mem/index.md`
Dodać wpis: `- [Onboarding Spotlight v2](mem://features/onboarding/spotlight-v2) — Spotlight overlay + ?focus= URL param + AddStudent defer fields`.

---

## 9. Kolejność wdrożenia (atomowe commity)

```text
1) Migracja SQL (students nullable + bulk-publish CTE)
2) useSpotlight + SpotlightOverlay + mount w App.tsx
3) data-spotlight markers w 4 komponentach (WelcomeTestPanel, PathwayView, GoalsView)
4) DSLMTab — parse ?focus= → dispatch event
5) OnboardingChecklist — przepisanie deep-linków (section→view + focus)
6) AddStudentDialog v2 (defer CEFR/Goal, compact, deadline, custom first, nawigacja)
7) useOnboardingProgress — force_show flag w resetOnboarding + shouldShow
8) NavStudentSwitcher — przycisk Add
9) WelcomeTestResults — Apply CEFR CTA
10) RAG: docs/llm-context.md, llms.txt, mem/index.md, mem/features/onboarding/spotlight-v2.md
```

## 10. Test plan (po implementacji)

- [ ] Reset onboarding z `/profile` → checklist pojawia się natychmiast nawet gdy wszystkie kroki ukończone.
- [ ] Klik każdego z 7 kroków checklisty → poprawny scroll + widoczny spotlight na właściwym elemencie.
- [ ] Add Student bez CEFR (defer) + auto-send → uczeń utworzony, test wysłany, redirect na `?tab=dslm&view=goals&focus=add-goal-modal`, modal otwarty.
- [ ] Add Student z pełnymi danymi → redirect na `?tab=overview&focus=send-welcome-test`, spotlight na panelu Welcome Test.
- [ ] Apply CEFR z Test Results aktualizuje `students.english_level`.
- [ ] NavStudentSwitcher → przycisk "+ Add" otwiera modal.
- [ ] `/gallery` po migracji: liczba publicznych ≈ liczba spełniających kryteria (oczekiwane ~850–920).
- [ ] Reset onboarding nie psuje progresji — checklist znika po kliknięciu "Hide / Dismiss".
- [ ] Brak regresji w demo mode i student hub.

---

**Po Twojej akceptacji** przechodzę w build mode i wykonuję pkt 1–10 w wymienionej kolejności. Wszystkie zmiany są addytywne; pozostawiamy stare wartości `section=` jako fallback (`DSLMTab` traktuje `section` jako alias dla `view` przez 1 wersję), więc istniejące zakładki/linki w innych miejscach kodu nie zostaną zepsute.
