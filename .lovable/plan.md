
# Plan v6.9.33 — Onboarding 1‑Minute Prep + Galeria + UI hygiene

Celem jest doprowadzić onboarding do stanu „klikaj i wiesz co dalej", naprawić każdy z konkretnych bugów wymienionych przez użytkownika i zaktualizować dokumentację RAG. Zmiany zaprojektowane tak, żeby nie ruszać silnika worksheet/AI i nie psuć istniejących ścieżek.

---

## 1. Onboarding — Get started with Edooqoo 🚀

### 1.1A — Stany „wymaga ucznia" + brakujący krok kalendarza
Plik: `src/components/OnboardingChecklist.tsx`, `src/hooks/useOnboardingProgress.tsx`.

- Wprowadzamy nowy krok `setup_calendar` w `OnboardingStep` (po `generate_worksheet`).
- W `checkSteps()` dodajemy zapytanie do `calendar_settings` (lub `availability_slots` — wybór: `calendar_settings` z `teacher_id`, fallback na liczbę rekordów >0). Wynik mapowany na `setup_calendar`.
- W `ACTIVE_KEYS` dopisujemy `setup_calendar` (procent liczy się z 8 kroków).
- W `OnboardingChecklist.tsx` w `prepSteps` dopisujemy ostatni step:
  - label: `Set up your calendar for lesson bookings`
  - icon: `Calendar`
  - action: `navigate('/profile?tab=calendar')` (jeżeli taka zakładka istnieje; w przeciwnym razie `/calendar/settings`).
- Każdy krok zależny od istnienia ucznia (`send_welcome_test`, `add_goals`, `generate_roadmap`, `generate_next_ideas`, `pick_idea`) renderujemy z wizualnym stanem „locked" gdy `students.length === 0`:
  - Przycisk `Start` zamieniamy na disabled z tooltipem „Add a student first".
  - Pod labelem dorzucamy mały podtekst (`text-[11px] text-muted-foreground`): „Available after you add a student".
  - Po dodaniu ucznia (`useStudents` zmienia listę) tooltip znika automatycznie.
- `Create a worksheet` zostaje aktywny zawsze.

### 1.1B — Send Welcome Test: na DSLM, nie Overview, plus mniejszy modal
- W `OnboardingChecklist.tsx` zmieniamy deep‑link `send_welcome_test` na `?tab=dslm&view=pathway&focus=send-welcome-test` (zamiast `tab=overview`).
- Banner `WelcomeTestSuggestion` jest obecnie renderowany w zakładce Overview. Aby spotlight zadziałał na DSLM, dodajemy w DSLMTab (na samej górze `pathway`) bliźniaczy mount tego samego komponentu (warunek: brak completed welcome test) — komponent jest idempotentny.
  - Plik: `src/components/dslm/DSLMTab.tsx` — w sekcji `pathway` przed `NextStepsSection` dorzucamy `<WelcomeTestSuggestion studentId={studentId} compact />` z propem `compact`.
  - Dodajemy prop `compact?: boolean` do `WelcomeTestSuggestion` — zmniejsza padding (`p-3` zamiast `p-6`), buttony `size="sm"`. Sam atrybut `data-spotlight="send-welcome-test"` zostaje.
- Modal Onboarding (Card w `OnboardingChecklist.tsx`) zmniejszamy o ~30%:
  - Szerokość: `Card` dostaje `max-w-[280px]` (było ~360).
  - Padding wewnętrzny: `CardHeader pb-2`, `CardContent pt-0 px-3 pb-3`.
  - Typografia: tytuł `text-xs`, badge `text-[10px]`, label kroku `text-[12px]`, ikony `h-3.5 w-3.5`, przyciski `h-7 text-[11px] px-2`.
  - Wysokość kroku: `p-2` zamiast `p-3`, gap `space-y-1.5`.
  - Stan zwinięty (`!isExpanded`): `p-2`, emoji `text-lg`, badge `text-[11px]`.
  - To rozwiązuje też przykrywanie elementu Send Welcome Test (spotlight + węższy modal nie nachodzą).

### 1.1C — Add learning goals: ponowne otwarcie modala
Plik: `src/components/dslm/DSLMTab.tsx`.

- Obecny `useEffect` z `searchParams.get('focus')` odpala się tylko raz (`[]` deps), więc kolejne wejście z tym samym focusem nie wystrzeli eventu.
- Refaktor: dodajemy efekt zależny od `searchParams.get('focus')`. Po wykryciu `add-goal-modal`:
  1. `handleScrollTo('goals')`
  2. `setTimeout(() => window.dispatchEvent(new CustomEvent('dslm:addGoal')), 400)`
  3. Czyścimy parametr `focus` z URL (`setSearchParams(next, { replace: true })`) — tak, by ponowne kliknięcie tego samego linku ponownie zatrzasnęło efekt (URL idzie z `null → add-goal-modal` → otwarcie modala, potem czyścimy).
- W `OnboardingChecklist.tsx` `action` dla `add_goals` zostaje, ale dodatkowo wymuszamy `navigate(url, { replace: false })` z timestampem (`&_=Date.now()`), żeby react‑router zawsze widział nową lokalizację — to gwarantuje re‑trigger nawet jeśli URL został wcześniej wyczyszczony.

### 1.1D — Generate Learning Roadmap: prawidłowy spotlight
Plik: `src/components/dslm/PathwayView.tsx`.

- Aktualny `data-spotlight="learning-roadmap"` jest na pustym `<div className="scroll-mt-24"/>` (linia 283), dlatego spotlight pokazuje pusty obszar.
- Przenosimy `data-spotlight="learning-roadmap"` na właściwy kontener sekcji Roadmap (Card lub `<section>` z nagłówkiem „Learning Roadmap"). Atrybut `id="pathway-roadmap"` zostawiamy na cienkim sentinelu do scrolla, ale `data-spotlight` przechodzi na wizualny element o niezerowym rozmiarze.
- Jeśli sekcja Roadmap jest renderowana warunkowo (np. tylko gdy są fazy), atrybut dodajemy też do pustego placeholdera „No curriculum plan yet" (Card), żeby spotlight zawsze trafiał w widoczny prostokąt.

### 1.1F — Use one Next Lesson suggestion: brak akcji
Plik: `src/components/dslm/PathwayView.tsx` lub `NextStepsSection.tsx`.

- Dodajemy `data-spotlight="pick-idea"` na pierwszej karcie sugestii Next Lesson (jeśli istnieje) — gdy karty są, spotlight wyróżnia pierwszą. Gdy brak kart, fallback na przycisk „Generate 1‑Minute Prep suggestions" + komunikat „Generate ideas first".
- W `useEffect` w `DSLMTab.tsx` reagującym na `focus=pick-idea` po `handleScrollTo('pathway')` dispatchujemy event `pathway:pickIdea` który `NextStepsSection` obsłuży: jeśli są sugestie, przewija do listy i podświetla pierwszą; jeśli nie, otwiera `GenerateStepsDialog`.

### 1.1H — Reset Onboarding w /profile
Plik: `src/pages/Profile.tsx`, `src/hooks/useOnboardingProgress.tsx`.

- Aktualny bug: po `resetOnboarding()` `checkSteps()` natychmiast ustawia wszystkie kroki na `true` (bo dane istnieją w DB), `completed=true` → `shouldShow()` blokuje render mimo `onboarding_force_show`.
- Poprawka w `shouldShow()`: kolejność warunków — `forceShow` MUSI być sprawdzony PRZED `completed`. Aktualny kod robi to dobrze, ale `checkSteps()` zaraz po reset zapisuje `completed: allCompleted` co nadpisuje stan ale `forceShow` w localStorage zostaje. Problem leży w `dismissed: dbProgress?.dismissed || currentProgress.dismissed` — po reset `dismissed=false` ale jeżeli wcześniej było `true`, `dbProgress.dismissed` może wciąż być `true` zanim setProgress zapisze (race). Rozwiązanie:
  1. W `resetOnboarding()` po `saveProgress` ustawiamy też `errorBackoffUntilRef.current = Date.now() + 5000` i `lastRunRef.current = Date.now()` (przez `useRef`y eksponowane wewnątrz hooka) — blokujemy najbliższy `checkSteps` na 5s, żeby UI miał czas wyrenderować pustą listę.
  2. Dodajemy flagę `progress.reset_at` (timestamp). W `checkSteps()` po wykryciu `allCompleted`, jeżeli `reset_at` < 60s temu → NIE ustawiamy `completed=true` (tylko aktualizujemy podgląd kroków). Po minucie efekt wygasa.
  3. W `OnboardingChecklist.tsx` `shouldShow()` zwraca true gdy `forceShow=true` niezależnie od kroków — i tutaj UWAGA: po resecie procent może pokazać 100%, ale to jest cel: użytkownik widzi listę „ukończoną" i może ją odznaczyć ręcznie? NIE — chcemy żeby pokazała się jako niewykonana. Dlatego dodatkowo w `resetOnboarding()` ustawiamy `localStorage.setItem('onboarding_reset_at', String(Date.now()))` i `checkSteps` przez 5 minut po reset wypycha `newSteps` w którym wszystkie pola = `false` (poza `add_student` jeżeli realnie istnieje — bo to obiektywny fakt którego nie da się ukryć). To rozwiązanie najbardziej zbliżone do oczekiwania użytkownika: „przywróć onboarding do niewykonanych zadań".
  4. Po 5 minutach (lub po ręcznym ukończeniu wszystkich kroków przez kliknięcia) `onboarding_reset_at` jest czyszczone i kroki wracają do real‑time detekcji.
- Przycisk w `/profile` zostaje, ale po kliknięciu robimy `navigate('/dashboard')` żeby user od razu zobaczył listę.

### 1.2 — Add Student modal: I know vs I don't know my student
Plik: `src/components/dashboard/AddStudentDialog.tsx`.

Analiza oderwana od sugestii: użytkownik ma rację. Obecny default „I'll set level & goal after the Welcome Test" generuje stan „ślepego" tygodnia (uczeń wypełnia test 1–3 dni, w międzyczasie nauczyciel nie może wygenerować roadmap ani next steps). Rozsądny model UX to **3 stany w jednym RadioGroup** (zamiast dwóch checkboxów):

1. `I already know my student` — wymaga level + main_goal + (opcjonalnie) deadline. Welcome Test jest opcjonalny (checkbox „Send Welcome Test anyway").
2. `I don't know my student yet — fill from Welcome Test` (domyślny, gdy email obecny) — level/goal puste, auto‑send Welcome Test zaznaczony domyślnie. Komunikat informacyjny: „Roadmap + Next Steps unlock once the student completes the test (usually 1–3 days). Until then you can use generic worksheets."
3. `Skip Welcome Test — I'll set everything manually later` — level/goal opcjonalne, brak auto‑send. Tylko dla zaawansowanych. Komunikat: „You can add goals and roadmap at any time from the student page."

Zmiany techniczne:
- Wymieniamy `Checkbox deferProfile` i `Checkbox autoSendWelcomeTest` na jeden `<RadioGroup value={mode}>` z 3 opcjami.
- Mapowanie: `mode='know'` → `deferProfile=false`, `autoSendWelcomeTest=<checkbox>`; `mode='defer'` → `deferProfile=true`, `autoSendWelcomeTest=true`; `mode='manual'` → `deferProfile=true`, `autoSendWelcomeTest=false`.
- Domyślny `mode='defer'`.
- Walidacja submit: dla `know` wymaga `englishLevel + mainGoal`; dla pozostałych nie wymaga.
- Pole „Main Goal" obok labela dostaje ikonę info (`<HoverCard>` lub tooltip) z treścią: „Main Goal is the student's primary outcome (e.g. job interview in English, B2 exam). You'll be able to add Supporting Goals (sub‑skills) and Additional Goals (side topics) later from the student's Goals tab."
- Domyślnie `mainGoal='custom'` zostaje.

### 1.3 — Po utworzeniu konta → generator + otwarty Add Student
Plik: `src/pages/Signup.tsx`.

- Po `navigate('/')` (linia 120) ustawiamy parametr query: `navigate('/?action=add-student')`.
- W `src/pages/Index.tsx` (lub plik routujący `/`) dodajemy `useEffect` który czyta `searchParams.get('action')==='add-student'`. Jeżeli true i `students.length===0`, otwiera `AddStudentDialog` (już używamy podobnego wzorca w `WorksheetForm` link `?action=add-student`).
- W `WorksheetForm/index.tsx` szukamy obecnego handlera tego query (link `/dashboard?action=add-student` istnieje); jeżeli generator obsługuje to query, tylko dorzucamy obsługę dla rooty `/`. Jeżeli nie — montujemy `<AddStudentDialog open={...} onOpenChange={...} triggerButton={false} />` w komponencie nadrzędnym dla `/`.

### 1.4 — Po dodaniu ucznia
Plik: `src/components/dashboard/AddStudentDialog.tsx`, `src/components/dslm/DSLMTab.tsx`.

- **A (brak auto‑send):** navigate na `/student/{id}?tab=dslm&view=pathway&focus=send-welcome-test&_=${Date.now()}`. Spotlight na komponencie `WelcomeTestSuggestion` (zmieniony w 1.1B, kompaktowa wersja w DSLM). Dodatkowo w komponencie po `data-spotlight` aktywujemy modal‑style overlay: backdrop `bg-black/50`, jedyna akcja widoczna to przycisk „Send Welcome Test now" (pulse animation, primary), oraz mała linijka „Skip for now — I'll send later" (text button). Wzorzec „task confirmation modal" — wykorzystujemy istniejący `SpotlightOverlay` w trybie `mode='modal'` (nowy prop: `requireAction?: boolean` — gdy true, kliknięcie poza hole NIE zamyka spotlight; tylko przycisk akcji lub Esc).
- **B (auto‑send zaznaczony):** navigate na `/student/{id}?tab=dslm&view=goals&focus=add-goal-modal&_=${Date.now()}`. Skoro WT już został wysłany, kolejny krok = goals. Modal Add Goal otwiera się automatycznie dzięki naprawie z 1.1C.
- Obecny `WelcomeTestSuggestion.tsx` ma `useEffect` na `autosend=1`. Zostawiamy go (już działa). Po sukcesie `handleSend()` zmieniamy URL na `?tab=dslm&view=goals&focus=add-goal-modal` (push state).

---

## 2. Switcher ucznia — ujednolicenie

Plik: `src/components/landing/StickyNav.tsx`, `src/components/landing/NavStudentSwitcher.tsx`, `src/components/StudentSwitcherPopover.tsx`, `src/pages/StudentPage.tsx`.

Decyzja: zostawiamy **jeden** komponent `NavStudentSwitcher` (na sticky nav, po lewej stronie). Usuwamy `StudentSwitcherPopover` z `StudentPage.tsx` (linia 439). Zmieniamy `NavStudentSwitcher`:

- Style trigger: ikona User w kolorze primary + chevron + (na `/student/:id`) nazwa aktualnego studenta, np. `<Users/> XD4 ▾`. Identyczny wygląd niezależnie od strony.
- Pozycja: **po lewej** stronie sticky nav (obecnie jest po prawej w obu wariantach mobile/desktop). Przesuwamy render `NavStudentSwitcher` na początek lewego klastra, zaraz po logo Edooqoo.
- `StickyNav.tsx`: warunek `showStudentSwitcher` rozszerzamy żeby działał też na `/student/:id` (już działa: `!isStudentPage` usuwamy). Switcher pokazuje się na: generatorze, /student, wszystkim poza /dashboard i /profile.
- `StudentPage.tsx`: usuwamy lokalny `StudentSwitcherPopover` (linie ~437–445). Globalny switcher z nav przejmuje funkcję.
- `NavStudentSwitcher`: dodajemy etykietę aktualnego ucznia, gdy URL pasuje do `/student/:id` (czytamy z `useParams` lub `location.pathname`). Wstawiamy też przycisk „+ Add new student" jako pierwszy element pod nagłówkiem „Switch to student" (na prośbę użytkownika ze screenu /student). Obecnie jest w stopce — przenosimy na górę listy.

---

## 3. Zakładka 1 MINUTE — białe obramowanie

Plik: `src/pages/StudentPage.tsx` (linie 463–474).

- Active state TabsTrigger w shadcn ma klasę `data-[state=active]:bg-background data-[state=active]:shadow-sm`. Trigger 1 MINUTE owinięty jest w `TooltipTrigger asChild`, co może wewnętrznie psuć propagację data‑state, ale prawdopodobna przyczyna to brak `text-foreground` / customowych klas — pozostałe taby działają bo nie mają wrappera.
- Poprawka: kopiujemy te same klasy co inne triggers: `className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"`. Jeżeli korzysta z domyślnych z `tabs.tsx`, sprawdzamy że `asChild` w `TooltipTrigger` poprawnie przekazuje `data-state` do TabsTrigger. Alternatywa: zamiast `TooltipTrigger asChild` owinięcie w `<span>` z tooltipem (Tooltip nad span, TabsTrigger osobno) — gwarantuje, że TabsTrigger zachowa wszystkie style Radix.
- Wybieramy alternatywę 2 (rozdzielenie Tooltip + TabsTrigger): mniej regresji niż walka z `asChild` + `data-state`.

---

## 4. Generator — opcja Add Student w dropdownie

Plik: `src/components/WorksheetForm/index.tsx` (linie 660–682).

- W `<Select>` dla wyboru ucznia, pomiędzy `No student (generic)` a listą studentów, dodajemy element niestandardowy: `<SelectItem value="__add_student__" className="text-primary font-medium">+ Add Student</SelectItem>`.
- W `onValueChange={setSelectedStudentId}` przechwytujemy wartość `__add_student__`: zamiast ustawiać id, otwieramy state `setAddStudentOpen(true)` i NIE zmieniamy `selectedStudentId`.
- Mountujemy `<AddStudentDialog triggerButton={false} open={addStudentOpen} onOpenChange={setAddStudentOpen} onStudentAdded={(s)=>{ refetchStudents(); setSelectedStudentId(s.id); setAddStudentOpen(false); }} />`.
- Potrzeba dorzucić w `useStudents()` zwracane id nowo dodanego studenta — `addStudent()` już to robi.
- W `AddStudentDialog` modyfikujemy: jeżeli `onStudentAdded` jest podane, NIE wykonujemy `navigate(...)` na `/student/...` (obecny kod nawiguje zawsze) — dodajemy guard: `if (onStudentAdded) { onStudentAdded(newStudent); return; }`. To pozwala wywołującemu samodzielnie zdecydować co dalej (generator nie chce zmiany URL).

---

## 5. Galeria publiczna

### 5.1 — Renderery synonyms/word‑order/complete‑word/matching/negative‑prefixes
Plik: `src/components/gallery/GalleryExerciseRenderer.tsx`.

Diagnoza (na podstawie screenshotów + kodu, linie 196–214 i 113–126):
- Synonyms/Antonyms/Complete‑word: items mają kształt `{term, definition, letter}`. Aktualny render czyta `it?.prompt ?? it?.word ?? it?.input ?? it?.text ?? it?.question ?? it` — wszystkie nieobecne, więc fallback `it` zamienia obiekt na JSON.stringify.
- Matching‑Halves: items prawdopodobnie `{first, second}` lub `{term, definition}` — dodajemy pełniejsze fallbacki.
- Word‑order: ostatecznie items mogą być `{sentence: "...", words: [...]}` lub czystym stringiem — sprawdzamy oba.
- Negative‑prefixes: items `{word, prefix, answer}` lub `{base, target}`.

Poprawka w `case "synonyms"|"antonyms"|"complete-word"|"negative-prefixes"|...`:
```ts
const left = it?.term ?? it?.prompt ?? it?.word ?? it?.base ?? it?.input ?? it?.text ?? it?.question ?? (typeof it === 'string' ? it : '');
const right = it?.definition ?? it?.answer ?? it?.target ?? it?.solution ?? it?.synonym ?? it?.antonym ?? '';
// Dla complete-word dodatkowo: it?.gapped ?? it?.masked ?? left
```
Identyczne rozszerzenie kluczy dla `case "matching"|"matching-halves"`:
```ts
const left = p.left ?? p.first ?? p.term ?? p.a ?? p.word ?? (typeof p === 'string' ? p : '');
const right = p.right ?? p.second ?? p.definition ?? p.b ?? p.match ?? p.pair ?? '';
```
Dla `case "word-order"`:
```ts
const words = it?.words ?? it?.shuffled ?? it?.tokens
  ?? (typeof it === 'string' ? it.split(/\s+/) : null)
  ?? (typeof it?.sentence === 'string' ? it.sentence.split(/\s+/) : []);
```
Dodatkowo w pomocnicy `toText()` (na górze pliku) wzmacniamy zabezpieczenie: jeśli `value` to obiekt zawierający klucz `term` lub `prompt` lub `text` — bierzemy go zamiast `JSON.stringify` (warstwa obronna na nieuwzględnione typy). To eliminuje „pseudo‑JSON" w treściach (w tym domniemane nano‑skills w treściach — pewnie też wpadły jako pełne obiekty exercise.meta).

### 5.2 — B1/B2 dla wszystkich worksheetów
Diagnoza: zapytanie do bazy pokazało rzeczywistą dystrybucję: B1/B2=694, A1/A2=115, C1/C2=96. Nie wszystkie mają B1/B2 — galeria zapewne nie pokazuje filtra po poziomie lub default sort skupia B1/B2 na górze.

- Plik: `src/pages/gallery/PublicGalleryIndex.tsx`. Dodajemy filtr CEFR (3 chipy: A1/A2, B1/B2, C1/C2) który zmienia query (`.eq('public_level', selected)`).
- Domyślne sortowanie: `order('published_at', { ascending: false })` zostaje, ale dodajemy losowanie w obrębie tygodnia (`order('public_view_count', { ascending: false })`) żeby na początku nie było wyłącznie B1/B2.
- Niezależnie, robimy backfill `public_level` z formy gdy null/pusto (defensywnie): migracja idempotentna `update worksheets set public_level = coalesce(public_level, form_data->>'englishLevel', 'B1/B2') where is_public=true and (public_level is null or public_level = '');`.

### 5.3 — Nano‑skills w treści ćwiczeń (raport użytkownika)
- Po poprawce `toText()` (5.1), wszelkie obiekty `{name, mastery, reason}` (kształt nano‑skill rating) renderowane wcześniej jako JSON zostaną zignorowane lub potraktowane jako `name`. Dodatkowo dodajemy w `toText()`: jeżeli obiekt ma klucz `name` ale też `mastery` lub `reason` → zwracamy pusty string (to nie powinno być w treści ćwiczenia, to metadata).

---

## 6. RAG documentation update

Pliki: `docs/llm-context.md`, `llms.txt`, nowy `mem/features/onboarding/checklist-v3.md`.

Sekcja w obu plikach (dense Markdown, Problem → Solution → Technical Mechanics → RAG Keywords):

```
## Onboarding Checklist v3 (v6.9.33)

### Problem
Teachers stalled between adding a student and reaching 1‑Minute Prep:
deep links opened wrong tabs, Spotlight pointed to empty sentinels,
Welcome Test banner was hidden by the floating onboarding card, Add Student
modal forced a binary choice that left teachers without a roadmap during
the 1–3 day Welcome Test wait, and "Reset Onboarding" did not re-show steps
because checkSteps immediately re-flagged them complete.

### Edooqoo.com Solution
- 8-step checklist now includes `setup_calendar` as the final 1-Minute Prep step.
- Steps that depend on a student are visually locked until the first student exists.
- Welcome Test banner is mounted on the DSLM tab as well (compact variant).
- Floating card resized -30% (max-w-[280px], smaller paddings + typography).
- Add Student modal switched to 3-mode RadioGroup
  (`know` / `defer` / `manual`) with contextual help on Main Goal.
- Spotlight markers moved off zero-size sentinels onto real section cards.
- Re-clickable focus deep links: focus param is consumed and stripped from URL,
  cache-busting `_=ts` ensures re-trigger.
- Reset Onboarding sets `onboarding_reset_at` in localStorage; checkSteps
  zeroes detected steps for 5 minutes after reset to give the teacher a
  truly empty checklist.
- After student creation, navigation goes to DSLM (not Overview):
  `?tab=dslm&view=pathway&focus=send-welcome-test` (manual send) or
  `?tab=dslm&view=goals&focus=add-goal-modal` (auto-send was checked).
- Send-Welcome-Test spotlight uses `requireAction` modal mode: dimmed
  backdrop with only "Send now" / "Skip" actions.

### Technical Mechanics
- `useOnboardingProgress.tsx`: `setup_calendar` step, calendar_settings query,
  `onboarding_reset_at` localStorage flag, 5-min reset window.
- `OnboardingChecklist.tsx`: 8 steps, locked states, compact sizes, calendar
  CTA, deep links carry cache-buster.
- `SpotlightOverlay.tsx`: optional `requireAction` mode (clicks outside hole
  don't dismiss).
- `DSLMTab.tsx`: focus-effect now depends on `searchParams.get('focus')`,
  strips param after firing, also handles `focus=pick-idea` via
  `pathway:pickIdea` event.
- `PathwayView.tsx`: `data-spotlight="learning-roadmap"` and
  `data-spotlight="pick-idea"` moved to visible cards/placeholders.
- `WelcomeTestSuggestion.tsx`: `compact` prop; mounted in DSLM Pathway too.
- `AddStudentDialog.tsx`: RadioGroup with 3 modes; `onStudentAdded`
  callback suppresses default navigation (used by generator).
- `WorksheetForm/index.tsx`: `+ Add Student` SelectItem opens dialog,
  newly created student auto-selected without page nav.
- `StickyNav.tsx` + `NavStudentSwitcher.tsx`: single global switcher,
  left-aligned, shown on /student too; `StudentSwitcherPopover` removed.
- `GalleryExerciseRenderer.tsx`: expanded fallback keys for matching,
  synonyms, antonyms, complete-word, word-order, negative-prefixes;
  defensive `toText()` filters nano-skill metadata objects.
- `PublicGalleryIndex.tsx`: CEFR filter chips; backfill migration for
  `public_level`.

### RAG Keywords
onboarding, welcome test, add student modal, spotlight, deep link, focus
param, learning roadmap, next lesson ideas, reset onboarding, calendar
setup, 1-minute prep, student switcher, sticky nav, public gallery,
exercise renderer, synonyms, complete word, word order, matching halves,
negative prefixes, cefr filter, B1/B2
```

Plus nowy plik `mem/features/onboarding/checklist-v3.md` (Problem → Solution → Technical Mechanics) i wpis w `mem/index.md`.

---

## 7. Kolejność implementacji (do realizacji w build mode)

1. `useOnboardingProgress.tsx`: dodanie `setup_calendar`, `onboarding_reset_at`, 5‑min reset window.
2. `OnboardingChecklist.tsx`: 8 kroków, locked states, calendar CTA, kompakt -30%, cache‑buster w linkach.
3. `WelcomeTestSuggestion.tsx`: prop `compact`. Mount w `DSLMTab` Pathway.
4. `DSLMTab.tsx`: refaktor `useEffect(focus)`, obsługa `pick-idea`, czyszczenie URL.
5. `PathwayView.tsx`: przeniesienie `data-spotlight` na widoczne karty.
6. `SpotlightOverlay.tsx`: prop `requireAction`.
7. `AddStudentDialog.tsx`: RadioGroup 3-tryby, tooltip na Main Goal, `onStudentAdded` callback bez navigate.
8. `Signup.tsx` + root route handler: `?action=add-student` po rejestracji.
9. `StickyNav.tsx` + `NavStudentSwitcher.tsx`: lewo, na /student, etykieta ucznia, „+ Add" na górze.
10. `StudentPage.tsx`: usunięcie `StudentSwitcherPopover`; naprawa TabsTrigger 1 MINUTE (rozdzielenie Tooltip).
11. `WorksheetForm/index.tsx`: `+ Add Student` SelectItem.
12. `GalleryExerciseRenderer.tsx`: rozszerzone fallbacki + obrona `toText()`.
13. `PublicGalleryIndex.tsx`: filtr CEFR.
14. Migracja SQL: backfill `public_level`.
15. RAG: `docs/llm-context.md`, `llms.txt`, `mem/features/onboarding/checklist-v3.md`, `mem/index.md`.

Każdy krok niezależny od reszty, brak ingerencji w silnik worksheet/AI.
