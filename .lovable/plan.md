# Plan v6.9.35 — Onboarding Click-through, AddStudent Nav, Gallery Nav & Audit Hardening

Wszystkie zmiany są chirurgiczne, poza obszarem Worksheet Generation Engine. Każdy problem ma własny: dependency scan, root cause, wybrane rozwiązanie + uzasadnienie, dokładny diff/treść kodu, weryfikacja.

---

## Problem 1.1 — Spotlight blokuje klikanie wyróżnionego elementu

**Affected surface:** `src/components/onboarding/SpotlightOverlay.tsx`.

**Root cause:** kontener `<div className="fixed inset-0 z-[100]">` (linia 113) pokrywa całą stronę i nie ma `pointer-events-none`. Choć 4 panele dim są nieinteraktywne, sam wrapper przechwytuje kliknięcia w całym viewportcie — także wewnątrz „dziury" wokół podświetlonego przycisku.

**Solution options:**
1. Dodać `pointer-events-none` do wrappera i `pointer-events-auto` tylko na tooltipie (już ma).
2. Zrezygnować z wrappera, renderować 4 panele + tooltip jako rodzeństwo w portalu.

**Wybrane: #1** — minimalna zmiana, zero regresji, zachowuje `aria-live` i z-index stacking.

**Implementacja (jedna linia):**
```diff
-    <div className="fixed inset-0 z-[100]" aria-live="polite">
+    <div className="fixed inset-0 z-[100] pointer-events-none" aria-live="polite">
```
Tooltip ma już `pointer-events-auto` (linia 131), więc `×` i ESC dalej działają.

**Verification:** otwórz spotlight na „Send Welcome Test" → kliknięcie przycisku wywołuje akcję bez wcześniejszego ESC. Tooltip „×" nadal klikalny.

---

## Problem 1.2 — Autosend Welcome Test rzuca „auto-send welcome test failed"

**Affected surface:** `src/components/dashboard/AddStudentDialog.tsx` (linie 187–278), `supabase/functions/send-test-email/index.ts`.

**Root cause:** w konsoli: `GET /rest/v1/student_tests?select=id 400`. Zapytanie używa kombinacji `.eq('test_type','welcome').is('deleted_at', null)` na kolumnie `deleted_at`, której tabela `student_tests` może nie mieć (brak w typach Supabase wygenerowanych klientowi → PostgREST zwraca 400). Dodatkowo `UPDATE … set share_token = crypto.randomUUID()` w zapytaniu `.select('share_token').single()` po update zwraca tablicę gdy share_token był już ustawiony przez trigger, co tu nie problem ale można uprościć. Główny winowajca to filtr `deleted_at`.

**Solution options:**
1. Usunąć `.is('deleted_at', null)` z zapytania (kolumna nie istnieje w tym kontekście; idempotencję trzymamy przez `order created_at desc limit 1`).
2. Zostawić, ale czytać kolumnę warunkowo — nadkomplikacja.

**Wybrane: #1.**

**Implementacja:** w `AddStudentDialog.tsx` linia ~210:
```diff
       .eq('test_type', 'welcome')
-      .is('deleted_at', null)
       .order('created_at', { ascending: false })
       .limit(1);
```
Dodatkowo: gdy `existing?.[0]?.id` istnieje ale share_token jest null, generujemy token via update + select w jednym kroku — kod już to robi (linie 245–253), zostawiamy bez zmian.

**Verification:** Add Student z autosend ON → toast „Welcome Test sent to …", brak błędu w konsoli, w tabeli `student_tests` pojawia się rekord; brak warning'a 400 na `student_tests?select=id`.

---

## Problem 2 — „Generate worksheet ↗" z 1-Minute Prep nie startuje generowania automatycznie

**Affected surface:** `src/pages/StudentPage.tsx` (linia 1086 ustawia `autoGenerateWorksheet` w sessionStorage), `src/components/WorksheetForm/index.tsx` (linie 274–306 — auto-submit effect), `src/components/dslm/NextStepBanner.tsx` (przekazuje `onUseAndGenerate`).

**Root cause:** Effect auto-submitu (linie 286–298) ma zależność `[lessonTopic, selectedStudentId]`. Po nawigacji `navigate('/')` formularz hydratuje `lessonTopic` z `prefillWorksheet` w innym efekcie. Jednak `setTimeout(500ms)` wewnątrz effectu jest jednorazowy — gdy `lessonTopic` zmienia się dwukrotnie (pierwsza hydracja → potem normalizacja exercises ustawia inny placeholder/topic), pierwszy timeout się czyści (`return () => clearTimeout(t)`) zanim zdążył wystrzelić. Dodatkowo cleanup w drugim efekcie (linia 301–305) usuwa flagę po 10s nawet jeśli effect właśnie próbuje wystrzelić.

Konkretnie: timeout 500ms + cleanup z effecta zostawia okno wyścigu; gdy depend zmienia się szybciej niż 500ms, flaga zostaje, ale `formRef.current.requestSubmit()` nie wywoła się, bo poprzedni timeout został cleared. Jednocześnie watchdog 10s usuwa flagę.

**Solution options:**
1. Wystrzelić `requestSubmit()` natychmiast (bez setTimeout) gdy `lessonTopic && flag === 'true' && formRef.current`. Użyć `requestAnimationFrame` tylko żeby poczekać na pełen commit.
2. Trzymać flagę dopóki rzeczywiście nie zostanie wykonana submit i usunąć watchdog 10s.
3. Połączyć oba.

**Wybrane: #3** — natychmiastowy submit po hydracji + usunięcie watchdoga 10s; bezpiecznik: flagę usuwamy w submit handlerze (już istnieje przed `requestSubmit()`).

**Implementacja w `src/components/WorksheetForm/index.tsx`:**

```diff
   useEffect(() => {
     if (sessionStorage.getItem('autoGenerateWorksheet') !== 'true') return;
     if (!lessonTopic) return;
-    const t = setTimeout(() => {
-      if (sessionStorage.getItem('autoGenerateWorksheet') !== 'true') return;
-      if (formRef.current) {
-        sessionStorage.removeItem('autoGenerateWorksheet');
-        devLog('🚀 [WorksheetForm] Auto-submitting (v6.9.34 retry-effect)');
-        formRef.current.requestSubmit();
-      }
-    }, 500);
-    return () => clearTimeout(t);
+    // v6.9.35 — wait 2× rAF for React commit, then submit. No setTimeout
+    // because rapidly changing deps were cancelling pending timers and the
+    // submit never fired.
+    let cancelled = false;
+    requestAnimationFrame(() => requestAnimationFrame(() => {
+      if (cancelled) return;
+      if (sessionStorage.getItem('autoGenerateWorksheet') !== 'true') return;
+      if (!formRef.current) return;
+      sessionStorage.removeItem('autoGenerateWorksheet');
+      devLog('🚀 [WorksheetForm] Auto-submitting (v6.9.35 rAF)');
+      formRef.current.requestSubmit();
+    }));
+    return () => { cancelled = true; };
   }, [lessonTopic, selectedStudentId]);

-  // Safety net: if flag survives 10s without firing, drop it.
-  useEffect(() => {
-    const cleanup = setTimeout(() => {
-      sessionStorage.removeItem('autoGenerateWorksheet');
-    }, 10000);
-    return () => clearTimeout(cleanup);
-  }, []);
+  // v6.9.35 — last-resort safety: drop flag after 30s of inactivity so a
+  // stuck user navigating away doesn't auto-generate on next /generator visit.
+  useEffect(() => {
+    const cleanup = setTimeout(() => {
+      sessionStorage.removeItem('autoGenerateWorksheet');
+    }, 30000);
+    return () => clearTimeout(cleanup);
+  }, []);
```

**Verification:** w 1-Minute Prep klikam „Generate worksheet ↗" → trafiam na `/`, formularz uzupełnia się, generowanie startuje samo w < 1s.

---

## Problem 3 — Usunąć „Try Demo First" z modalu Create Account

**Affected surface:** `src/pages/Signup.tsx`.

**Implementacja:** `rg -n "Try Demo First" src/pages/Signup.tsx` → usunąć cały link/wiersz (potencjalnie linie ~250–260). Plan: skasować pojedynczy `<Link to="/demo">…</Link>` lub `<p>` zawierający tekst. Zachować separator i „Sign in here".

```diff
-          <p className="text-center text-sm text-muted-foreground">
-            🎯 Try Demo First — explore without signing up
-          </p>
```

**Verification:** modal Create Account nie zawiera napisu „Try Demo First".

---

## Problem 4 — Po potwierdzeniu maila nie otwiera się modal Add Student

**Affected surface:** `src/pages/Signup.tsx`, `src/pages/Index.tsx` (linie 86–103).

**Root cause:** Effect w `Index.tsx` czyta `searchParams.get('action')`, ale gdy `isRegisteredUser` jest jeszcze `false` (sesja po e-mailowym potwierdzeniu hydratuje się w 1–3 ticki), early-return zostawia jedynie nieaktywny `setTimeout(600ms)`, który niczego nie wywołuje (`re-run by reading param again` — nigdy nie jest re-readowany, bo zależność to `searchParams` referencja, która się nie zmienia). Gdy `isRegisteredUser` przechodzi w `true`, effect uruchamia się ponownie — TYLKO jeśli `searchParams` zawiera `action=add-student`. Problem: w niektórych flow Supabase po `emailRedirectTo` strica `?token_hash=…&type=signup` zamiast `?action=add-student` (lub nadpisuje query). Dodatkowo, jeśli user trafia na `/` przed wczytaniem sesji i `isRegisteredUser` jest false, `action` przetrwa, OK — ale jeśli inna ścieżka oczyściła query, znika.

**Solution options:**
1. Wprowadzić trwały flag `localStorage.setItem('post-signup-add-student','1')` w `Signup.tsx` zaraz po wywołaniu `supabase.auth.signUp(...)`. W `Index.tsx` otwierać modal gdy flag istnieje + `isRegisteredUser === true`, następnie kasować flag.
2. Polegać tylko na `?action=add-student` — kruche.

**Wybrane: #1** — odporne na zgubienie query przez przekierowanie e-mail confirm/OAuth.

**Implementacja:**

`src/pages/Signup.tsx` — w handlerze sukcesu rejestracji (zarówno signUp z `emailRedirectTo` jak i Google OAuth):
```ts
try { localStorage.setItem('post-signup-add-student', '1'); } catch {}
```
Dodać przed `navigate(...)` w 2 miejscach (form submit + OAuth callback).

`src/pages/Index.tsx` — rozszerzyć efekt (linia 86):
```diff
   useEffect(() => {
-    if (searchParams.get('action') !== 'add-student') return;
-    if (isRegisteredUser) {
-      setAddStudentOpen(true);
-      const next = new URLSearchParams(searchParams);
-      next.delete('action');
-      setSearchParams(next, { replace: true });
-      return;
-    }
-    const id = window.setTimeout(() => {}, 600);
-    return () => window.clearTimeout(id);
+    const hasFlag =
+      searchParams.get('action') === 'add-student' ||
+      (() => { try { return localStorage.getItem('post-signup-add-student') === '1'; } catch { return false; } })();
+    if (!hasFlag) return;
+    if (!isRegisteredUser) return; // wait until session hydrates
+    setAddStudentOpen(true);
+    try { localStorage.removeItem('post-signup-add-student'); } catch {}
+    if (searchParams.get('action') === 'add-student') {
+      const next = new URLSearchParams(searchParams);
+      next.delete('action');
+      setSearchParams(next, { replace: true });
+    }
   }, [searchParams, isRegisteredUser, setSearchParams]);
```

**Verification:** zarejestruj się → potwierdź email → lądowanie na `/` → modal Add Student otwiera się natychmiast po hydracji sesji.

---

## Problem 5 — Brak nawigacji + brak focus po dodaniu ucznia

**Affected surface:** `src/pages/Dashboard.tsx` (linie 504–512), `src/components/dashboard/AddStudentDialog.tsx` (linie 282–297).

**Root cause:** Dashboard przekazuje `onStudentAdded={() => { setAddStudentModalOpen(false); refetchStudents(); }}`. Skutek: dialog wchodzi w gałąź „caller-controlled nav" i NIE wywołuje `navigate(...)`. Użytkownik zostaje na `/dashboard`. To samo dotyczy modalu otwartego z `/?action=add-student` na Index — ale tam `<AddStudentDialog>` nie ma `onStudentAdded`, więc działa OK. Bug jest w Dashboard.

**Solution options:**
1. Usunąć `onStudentAdded` z dashboardowego `<AddStudentDialog>` (default flow weźmie nawigację po side `addStudent` z env).
2. Przekazać `onStudentAdded` który sam wykonuje nawigację zgodną z autosend.

**Wybrane: #1** — minimal i spójne z innymi punktami wywołania (Index, OnboardingChecklist). `refetchStudents` i tak odpali się przez efekt `useStudents` po zmianie + onboarding refresh, którego dialog już wywołuje (linie 181, 185).

**Implementacja `src/pages/Dashboard.tsx`:**
```diff
       <AddStudentDialog 
         triggerButton={false}
         open={addStudentModalOpen}
         onOpenChange={setAddStudentModalOpen}
-        onStudentAdded={() => {
-          setAddStudentModalOpen(false);
-          refetchStudents();
-        }}
       />
```
Dialog sam zamknie się (`setOpen(false)`) i sam zrobi `refetch()` (linia 184).

**A. Nawigacja:** Default flow w `AddStudentDialog` (linie 287–297) już teraz robi nawigację na `/student/:id?tab=dslm&...` z odpowiednim `focus`. Po naszej zmianie zadziała.

**B. Brak autosend → focus „Send Welcome Test"** — już zaimplementowane: `navigate('/student/:id?tab=dslm&view=pathway&focus=send-welcome-test&_=ts')`.

**C. Z autosend → modal Add Goal** — DialogContent oczekiwany w PathwayView/DSLMTab. Sprawdzamy: `focus=add-goal-modal` — używamy istniejącego identyfikatora. Jeśli komponent na DSLMTab `view=goals` nasłuchuje `focus`, otwiera modal Add Goal; jeśli nasłuchiwacza nie ma, dodajemy.

Dodatkowo w `DSLMTab.tsx` upewniamy się, że gdy `searchParams.get('focus') === 'add-goal-modal'`, otwieramy modal dodawania celu. Implementacja:
```ts
// DSLMTab.tsx (Goals view)
useEffect(() => {
  if (searchParams.get('focus') === 'add-goal-modal') {
    setAddGoalDialogOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('focus'); next.delete('_');
    setSearchParams(next, { replace: true });
  }
}, [searchParams]);
```
(Jeśli już istnieje analogiczny handler, pomijamy.)

**Verification:**
- Add Student (autosend OFF) → ląduję na `/student/:id?tab=dslm&view=pathway` z aktywnym spotlightem na „Send Welcome Test".
- Add Student (autosend ON) → ląduję na `/student/:id?tab=dslm&view=goals`, otwiera się modal Add Goal.

---

## Problem 6 — Reminder email = ten sam email co pierwotny

**Affected surface:** `supabase/functions/send-test-email/index.ts`. Klient już przekazuje `reminder: true` w body.

**Root cause:** Edge function ignoruje pole `reminder` — zawsze renderuje treść pierwotnego zaproszenia.

**Implementacja `supabase/functions/send-test-email/index.ts`:**
```diff
-    const { shareToken, recipientEmail, testTitle, teacherName, testType } = await req.json();
+    const { shareToken, recipientEmail, testTitle, teacherName, testType, reminder } = await req.json();
```
Dodać nowy blok HTML dla `reminder === true && isWelcomeTest`:
```ts
const reminderBody = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #7c3aed;">⏰ Friendly reminder — Welcome Test</h2>
    <p>Hello,</p>
    <p><strong>${teacherName || "Your teacher"}</strong> noticed you haven't completed the Welcome Test yet.</p>
    <p>It only takes 20–30 minutes and helps your teacher tailor every lesson to you.</p>
    <a href="${shareUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;margin:20px 0;">Resume Welcome Test</a>
    <p style="color:#6b7280;font-size:13px;">If you've already started, this link picks up where you left off.</p>
    <p style="color:#6b7280;font-size:12px;margin-top:20px;">Or copy and paste this URL: ${shareUrl}</p>
  </div>`;
```
Oraz:
```ts
const subject = reminder && isWelcomeTest
  ? `Reminder: please complete your Welcome Test from ${teacherName || "your teacher"}`
  : isWelcomeTest
    ? `${teacherName || "Your teacher"} invited you to take a Welcome Test`
    : `${teacherName || "Your teacher"} assigned you a test: ${testTitle}`;

const html = reminder && isWelcomeTest ? reminderBody : emailBody;
```
i podmienić `html: emailBody` na `html`.

**Verification:** kliknięcie „Send reminder" → mail z tematem „Reminder: please complete your Welcome Test…" i innym body.

---

## Problem 7 — Brak sticky nav w `/gallery` + renderery Word Order / Complete the Word / Matching Halves

### 7A. Sticky nav

**Affected surface:** `src/pages/gallery/PublicGalleryIndex.tsx`, `src/pages/gallery/PublicGalleryWorksheetPage.tsx`, `src/components/landing/StickyNav.tsx` (już istnieje).

**Solution:** dodać `<StickyNav nonSticky={false} isRegisteredUser={!!user} … />` na górze obu stron. Aby nie tworzyć zależności od hooków auth na publicznych stronach, użyjemy uproszczonej wersji — minimalny header z linkami: logo → `/`, „Gallery" → `/gallery`, „Sign in" → `/login`, „Get started" → `/signup`. Niech to będzie nowy lekki komponent `src/components/public/PublicTopNav.tsx`.

**Plik `src/components/public/PublicTopNav.tsx` (nowy):**
```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export const PublicTopNav: React.FC = () => (
  <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
    <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
      <Link to="/" className="text-lg font-bold text-primary">Edooqoo</Link>
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/gallery" className="text-muted-foreground hover:text-foreground px-2">Gallery</Link>
        <Link to="/exercise-types" className="text-muted-foreground hover:text-foreground px-2 hidden sm:inline">Exercises</Link>
        <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
        <Link to="/signup"><Button size="sm">Get started</Button></Link>
      </nav>
    </div>
  </header>
);
export default PublicTopNav;
```

Dodać `<PublicTopNav />` jako pierwszy element w JSX obu stron galerii (przed `<article>`/`<PageSeo>` content wrappera).

### 7B. Renderer Word Order / Complete Word / Matching Halves

`GalleryExerciseRenderer.tsx` ma już aliasy + obsługę halves/word-order. Realny problem: pola w danych z worksheetu nazywają się inaczej. Brakuje obsługi:
- `matching-halves`: niektóre worksheety przechowują `prompts` jako tablicę obiektów `{prompt, options}` (multiple choice w przebraniu) — w takim wypadku traktować jak multiple-choice. Dodać fallback:
  ```ts
  case "matching":
  case "matching-halves": {
    let pairs: any[] = ex.pairs || ex.items || ex.matches || ex.questions || [];
    // ... istniejący kod
    if (pairs.length && pairs[0]?.options && pairs[0]?.prompt) {
      // multiple-choice fallback
      return (
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {pairs.map((q: any, i: number) => (
            <li key={i}>
              <div>{toText(q.prompt)}</div>
              <ul className="mt-1 list-[upper-alpha] pl-6 text-muted-foreground">
                {(q.options || []).map((o: any, oi: number) => <li key={oi}>{toText(o)}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      );
    }
    // ... istniejący table render
  }
  ```
- `word-order`: dodać akceptację `it?.shuffled_sentence`, `it?.scrambled_sentence`, oraz wartości typu `{ words: ["The","cat","..."], answer: "..." }`.
  - Rozszerzyć `raw`:
  ```ts
  const raw =
    it?.words ?? it?.shuffled ?? it?.tokens ?? it?.scrambled ??
    it?.shuffled_sentence ?? it?.scrambled_sentence ?? it?.sentence ??
    it?.prompt ?? (typeof it === 'string' ? it : null);
  ```
- `complete-word` (oraz `negative-prefixes`, `word-formation`): dodać do listy źródeł kolumny lewej `it?.before`, `it?.context`, `it?.sentence`, `it?.clue`, a do prawej `it?.after`, `it?.result`, `it?.full_word`, `it?.complete`.

**Implementacja diff (case "synonyms" … gałąź):**
```diff
-                    {toText(it?.term ?? it?.prompt ?? it?.word ?? it?.base ?? it?.input ?? it?.gapped ?? it?.masked ?? it?.text ?? it?.question ?? it?.root ?? it?.original ?? it?.stem ?? it)}
+                    {toText(it?.term ?? it?.prompt ?? it?.word ?? it?.base ?? it?.input ?? it?.gapped ?? it?.masked ?? it?.text ?? it?.question ?? it?.root ?? it?.original ?? it?.stem ?? it?.before ?? it?.context ?? it?.clue ?? it?.sentence ?? it)}
-                    {toText(it?.definition ?? it?.answer ?? it?.target ?? it?.solution ?? it?.synonym ?? it?.antonym ?? it?.completed ?? it?.negative ?? it?.opposite ?? it?.transformed ?? it?.full ?? "")}
+                    {toText(it?.definition ?? it?.answer ?? it?.target ?? it?.solution ?? it?.synonym ?? it?.antonym ?? it?.completed ?? it?.negative ?? it?.opposite ?? it?.transformed ?? it?.full ?? it?.full_word ?? it?.complete ?? it?.after ?? it?.result ?? "")}
```

**Verification:** otwórz dowolny worksheet w galerii z Word Order / Matching Halves / Complete the Word — wyświetla token chips lub tabelę zamiast JSON.

---

## Problem 8 — Audyt LLM: GPT-5-mini 400 (max_tokens), legacy gemini-2.0 alias + smoke test

**Affected surface:** `supabase/functions/audit-llm-models/index.ts`.

**Root cause:**
- `max_completion_tokens: 16` to wciąż za mało dla GPT-5-mini (reasoning tokens > 16). Podnosimy do `128`.
- Raport e-mailowy pokazał `google/gemini-2.0-flash`, ale w kodzie już tego nie ma → to STARY mailing (sprzed deploy). Robimy ręczny smoke test (curl) żeby potwierdzić, że obecna konfiguracja przechodzi.

**Implementacja:**
```diff
-        [tokenField]: isGpt5Family ? 16 : 1,
+        [tokenField]: isGpt5Family ? 128 : 1,
```

**Smoke test (po deploy):**
```
supabase--deploy_edge_functions(["audit-llm-models"])
supabase--curl_edge_functions(
  path: "/audit-llm-models", method: "POST",
  headers: { "x-cron-secret": "<CRON_SECRET>", "Content-Type":"application/json" },
  body: '{"mode":"monthly"}')
```
Oczekiwane: wszystkie 9 modeli `ok: true`. Jeśli `openai/gpt-5-mini` znowu 400 → podnieść `128` → `256`.

**Verification:** odpowiedź zwraca `failed: 0`. Brak `google/gemini-2.0-flash` w wynikach.

---

## RAG injection — `docs/llm-context.md` + `public/llms.txt`

Dopisać blok:

```
### v6.9.35 — Onboarding click-through & post-signup nav

PROBLEM: Spotlight overlay swallowed clicks on highlighted element; Welcome Test autosend failed with student_tests 400; "Generate worksheet ↗" from 1-Minute Prep filled form but never submitted; Dashboard add-student stayed on /dashboard without focus hand-off; post-signup AddStudent modal failed to open when Supabase confirmation stripped ?action; Welcome Test reminder email reused initial invitation copy; /gallery had no header nav and Word Order/Matching Halves/Complete-Word renderers fell through to JSON dump; audit-llm-models still failed for openai/gpt-5-mini due to insufficient max_completion_tokens.

EDOOQOO SOLUTION:
- SpotlightOverlay wrapper marked pointer-events-none; only the tooltip stays interactive. Highlighted element clicks now fire normally.
- AddStudentDialog autosend query no longer filters by non-existent deleted_at column.
- WorksheetForm auto-submit waits 2× rAF after lessonTopic hydrates and fires synchronously; 10s flag watchdog extended to 30s and only clears stale flags on next mount.
- Dashboard's AddStudentDialog no longer passes onStudentAdded so default navigation (focus add-goal-modal or send-welcome-test) runs.
- Signup persists localStorage flag `post-signup-add-student=1`; Index opens AddStudentDialog when flag OR `?action=add-student` AND session hydrated.
- send-test-email accepts `reminder: true` and renders a distinct "Friendly reminder" body + subject.
- New PublicTopNav component mounted on /gallery and /gallery/:slug.
- GalleryExerciseRenderer matching/halves accepts {prompt, options} multiple-choice fallback; word-order accepts shuffled_sentence/scrambled_sentence; complete-word adds before/after/context/clue/full_word/complete keys.
- audit-llm-models GPT-5 family probe uses max_completion_tokens=128.

TECHNICAL MECHANICS:
- Files: SpotlightOverlay.tsx, AddStudentDialog.tsx, WorksheetForm/index.tsx, Dashboard.tsx, Signup.tsx, Index.tsx, DSLMTab.tsx (focus=add-goal-modal listener), send-test-email/index.ts, audit-llm-models/index.ts, gallery/PublicGalleryIndex.tsx, gallery/PublicGalleryWorksheetPage.tsx, components/public/PublicTopNav.tsx (new), GalleryExerciseRenderer.tsx.
- No DB migrations, no RLS changes, no Worksheet Generation Engine changes.

RAG KEYWORDS: spotlight clickthrough, pointer-events-none overlay, welcome test autosend 400, student_tests deleted_at, autoGenerateWorksheet rAF, 1-minute prep generate worksheet, post-signup add student modal, supabase emailRedirectTo flag, dashboard add student navigation, welcome test reminder email, gallery sticky nav, public top nav, word order renderer, matching halves fallback, complete-word context, gpt-5-mini max_completion_tokens.
```

Analogiczny krótszy wpis w `public/llms.txt` (sekcja Changelog).

Utworzyć też `mem/features/onboarding/v6935-clickthrough-and-nav.md` z sekcjami: Spotlight pointer-events, AddStudent autosend query, WorksheetForm rAF auto-submit, Dashboard nav handoff, post-signup localStorage flag, reminder email body, PublicTopNav scope, gallery renderer fallbacks, audit GPT-5 token bump.

---

## Final change report (po implementacji)

Zmodyfikowane pliki:
1. `src/components/onboarding/SpotlightOverlay.tsx`
2. `src/components/dashboard/AddStudentDialog.tsx`
3. `src/components/WorksheetForm/index.tsx`
4. `src/pages/Dashboard.tsx`
5. `src/pages/Signup.tsx`
6. `src/pages/Index.tsx`
7. `src/components/dslm/DSLMTab.tsx` (focus=add-goal-modal handler — tylko jeśli nie istnieje)
8. `supabase/functions/send-test-email/index.ts`
9. `supabase/functions/audit-llm-models/index.ts`
10. `src/pages/gallery/PublicGalleryIndex.tsx`
11. `src/pages/gallery/PublicGalleryWorksheetPage.tsx`
12. `src/components/gallery/GalleryExerciseRenderer.tsx`

Nowe:
13. `src/components/public/PublicTopNav.tsx`
14. `mem/features/onboarding/v6935-clickthrough-and-nav.md`

Dokumentacja: `docs/llm-context.md`, `public/llms.txt`, `mem/index.md` (dopis linka).

Out of scope (zalogowane do późniejszego sprintu):
- 406 na `/rest/v1/subscriptions` (RLS lub brak rekordu) — wymaga osobnej decyzji.
- `MaxListenersExceededWarning` z rozszerzenia MetaMask — szum, nie nasz kod.

Verification checklist:
- [ ] Spotlight: klik w „Send Welcome Test" działa bez ESC.
- [ ] Add Student z autosend ON nie loguje błędu 400 i wysyła test.
- [ ] „Generate worksheet ↗" z 1-Minute Prep auto-startuje generowanie.
- [ ] Modal Create Account nie zawiera „Try Demo First".
- [ ] Po potwierdzeniu emaila → modal Add Student otwiera się na `/`.
- [ ] Po dodaniu ucznia z dashboardu → przejście na `/student/...?tab=dslm` z poprawnym focusem (Send Welcome Test / Add Goal modal).
- [ ] Reminder mail ma temat „Reminder: please complete your Welcome Test…".
- [ ] `/gallery` i `/gallery/:slug` mają sticky header z linkami do logowania.
- [ ] Word Order, Matching Halves, Complete the Word renderują się jako chipy/tabela, nie JSON.
- [ ] audit-llm-models smoke test → `failed: 0`.
