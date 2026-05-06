
# Plan v6.9.8 — pełny zakres

Sześć obszarów, każdy z gotową decyzją wdrożeniową. Wszystko kompatybilne z obecnym kodem, bez ruszania silnika worksheet (sanctity rule).

---

## 1) Student Knowledge — analiza "od zera" (DSLM + 1-Minute Prep + nauczyciel)

### Co system notatek MUSI robić (z perspektywy 3 odbiorców)

**A. Nauczyciel (codzienna praca):**
- 10‑sekundowe dodanie luźnej myśli „w trakcie/po lekcji" („boi się Past Perfect", „lubi true crime", „wraca z Lizbony 12.05").
- Szybkie odnalezienie: „co mam o tej osobie z ostatnich 3 lekcji" bez czytania historii worksheetów.
- Naturalny język, zero przymusu kategoryzacji w pierwszym kroku.

**B. DSLM (Dynamic Student Language Mastery):**
- Notatka typu „weakness/strength/mistake" musi być **maszynowo zrozumiała** — przypięta do `element_type` (grammar/vocab/...), ewentualnie `nano_skill` (np. "past perfect"), z `mastery 0‑100` (jeśli teacher chce nadpisać).
- Notatka „goal" musi spinać się z `students.main_goal` / pacing.

**C. 1‑Minute Prep (przed lekcją):**
- W ≤ 60 s nauczyciel widzi **3 rzeczy**: (a) najświeższe „personal" hooki na small talk, (b) top 3 weaknesses do zaadresowania, (c) „Next Lesson Ideas" które sam zostawił.
- 1MP ma czytać **najnowsze i niewygasłe** notatki, posortowane priorytetem.

### Najważniejsza zasada (której obecnie brakuje): **frictionless capture, structured later**

Obecny system wymusza wybór kategorii + (dla Skill) subtyp + element + nano_skill + mastery przy **każdym** dodaniu. To blokuje wpisywanie w trakcie lekcji. Nauczyciel pomija narzędzie albo wpisuje śmieci do "Notes".

### Docelowy model (idealny)

```text
┌─────────────────────────────────────────────────────────┐
│ QUICK NOTE (10s) — tylko tekst + opcjonalnie student    │
│   "She struggles with past perfect in storytelling"     │
│   ↓ AUTO-CLASSIFY (Lovable AI Gateway, fire-and-forget) │
│       category: Skill Assessment                        │
│       skill_subtype: weakness                           │
│       element_type: grammar                             │
│       nano_skill: "past perfect"                        │
│       suggested_mastery: 35                             │
│       confidence: 0.82                                  │
│   ↓ Teacher widzi "AI sugeruje: …" — jednym klikiem     │
│     ✓ Accept   ✏ Refine   ✗ Keep as plain note          │
└─────────────────────────────────────────────────────────┘
```

Kluczowe komponenty:

1. **One input** — wszystkie notatki przez jeden kanał (FAB albo `Cmd/Ctrl+K` na karcie studenta). Tekstowy `<textarea>` + optional `worksheet_id` + opcjonalny przycisk „mark as personal/goal/idea" jeśli teacher *chce* od razu kategoryzować.

2. **AI auto-classification** (`classify-knowledge-entry` edge function):
   - Input: `content`, `student.english_level`, `student.main_goal`.
   - Output: `category`, `skill_subtype?`, `element_type?`, `nano_skill?`, `suggested_mastery?`, `tags[]`, `confidence`.
   - Fire-and-forget: notatka zapisuje się natychmiast jako `category='Notes'`; AI w tle uzupełnia metadata i jeśli `confidence > 0.6` ustawia kategorię.
   - Jeśli AI proponuje Skill Assessment → tworzy też powiązany rekord/event w DSLM (`useStudentEvents` insert) bez czekania na teacher confirmation, ale oznaczony `confidence < 1.0` żeby DSLM mogło to ważyć.

3. **Three views, not seven:**
   - **Timeline** (default) — chronologiczny strumień, jak Twitter; każdy wpis pokazuje auto-przypisaną kategorię jako mały badge.
   - **By Skill** (dla DSLM) — widok zagregowany: lista nano_skills + ich rolling mastery + ile notatek wspiera ocenę.
   - **For Next Lesson** (dla 1MP) — top 3 personal hooks (ostatnie 30 dni), top 3 weaknesses by recency*severity, wszystkie „Next Lesson Ideas" niezarchiwizowane.

4. **Lifecycle / outdating (już jest, ale słabo używane):**
   - Auto-suggest „is this still current?" po 90 dniach dla Personal, po 30 dniach dla Skill jeśli mastery dla tego nano_skill wzrósł >20 pkt w DSLM.
   - „Next Lesson Ideas" auto-archive po użyciu w worksheet (link `worksheet_id`).

5. **1‑Minute Prep integration:**
   - Nowy endpoint w istniejącym `useStudentKnowledge`: `getOneMinutePrep(studentId)` zwraca `{ personalHooks: [], topWeaknesses: [], lessonIdeas: [] }` — używany w istniejącym 1MP UI (jeśli istnieje) lub w `StudentPage` jako sekcja „Quick Prep".

### Kluczowe pola w schema (zmiany minimalne, kompatybilne)

Obecna tabela `student_knowledge_entries` zostaje. Dodajemy:
```sql
ALTER TABLE student_knowledge_entries
  ADD COLUMN IF NOT EXISTS ai_classified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_in_worksheet_id UUID REFERENCES worksheets(id) ON DELETE SET NULL;
```
`metadata` (JSONB) pozostaje — tam dalej `nano_skill`, `mastery`, `skill_subtype`, `element_type`. **Żadna istniejąca dana nie jest niszczona.**

### Werdykt na pkt 2 (vs. obecny stan)

**Nie usuwać. Refactor + dodać AI warstwę + uprościć UI.**

Konkretnie:
- **Zatrzymać:** `useStudentKnowledge`, tabelę, `KNOWLEDGE_CATEGORIES`, `StudentKnowledgeSidePanel` (jako tryb advanced edit).
- **Uprościć Quick Add:** `StudentKnowledgeQuickAddModal` → tylko textarea + Save. Po Save od razu widać entry; AI klasyfikacja pojawi się sama w ciągu 1‑3 s przez query invalidation.
- **Dodać:** edge function `classify-knowledge-entry` + nowy hook `useOneMinutePrep` + zakładkę „Quick Prep" w `StudentPage` (przed istniejącymi tabami).
- **Usunąć z UI:** wymóg wyboru kategorii w QuickAdd. Zostawić wybór tylko w „Advanced edit" (StudentKnowledgeSidePanel).
- **Połączenie z DSLM:** w `useStudentEvents` dodać helper `recordKnowledgeBackedEvent` który zapisuje event z `confidence = ai_confidence` — DSLM już to obsłuży przez istniejącą wagę.

Zakres tej iteracji (v6.9.8): **TYLKO** te zmiany do pkt 1+2, bez przebudowy DSLM:
1. Migracja kolumn (4 nowe).
2. Edge function `classify-knowledge-entry` (Lovable AI Gateway, model `google/gemini-2.5-flash`, schema-constrained output).
3. `StudentKnowledgeQuickAddModal` — uproszczony (textarea + Save + spinner „AI is organizing…").
4. `useStudentKnowledge.addEntry` — wywołuje classify w tle.
5. `useOneMinutePrep` hook + sekcja `OneMinutePrepCard` w `StudentPage` na samej górze.
6. Auto-archive `Next Lesson Ideas` w `worksheetService.create` jeśli `linked_knowledge_entry_id` przekazany (na razie pomijamy w UI — tylko schema-ready).

---

## 2) Mail #1 — Confirmation (Supabase Auth)

### Decyzja techniczna

**Tak, można zastąpić Supabase confirmation Resendem przez `auth-email-hook`** — Lovable wspiera to natywnie (Auth Email Hook → custom edge function → Resend). Ale **wymaga to email_domain setup w Lovable** (DNS delegacja `notify.edooqoo.com` na nameservery Lovable). To koliduje, jeśli kiedyś byśmy chcieli mieć Resend bezpośrednio — patrz dokumentacja.

**Rekomendacja: zostać przy Supabase native, ale spersonalizować szablon w Supabase Dashboard.** Powody:
- Już mamy działający Resend dla Mail #2. Dodanie auth-email-hook = nowa konfiguracja DNS, ryzyko regresji.
- Supabase pozwala edytować HTML template + subject + sender name w Dashboard → Auth → Email Templates **bez** zmiany domeny (sender name = "Edooqoo", reply-to można ustawić).
- Konfiguracja sender name + brand HTML w Supabase = 5 minut, zero ryzyka.

### Plan dla Maila #1 (manualne kroki + dokumentacja)

Bez zmian w kodzie. Wprowadzimy nowy plik `docs/operational/supabase-confirmation-template.md` z:
- Pełnym HTML szablonem (matching brand: `#5E3FD9`, logo Edooqoo, biały bg, nagłówek "Confirm your email", CTA „Confirm email" → `{{ .ConfirmationURL }}`, footer „Edooqoo · hello@edooqoo.com").
- Subject: `Confirm your Edooqoo account`.
- Sender name: `Edooqoo` (Supabase Dashboard → Project Settings → Auth → SMTP → Sender name).
- Reply-to: `hello@edooqoo.com` (przez Resend custom SMTP, jeśli kiedyś włączymy — w pliku zostawiam instrukcję na przyszłość).

User wkleja HTML do Supabase Dashboard. Komunikuję to wprost w odpowiedzi po wdrożeniu.

---

## 3) Mail #2 — Welcome (Resend) — przebudowa treści + reply routing

### Zmiany w `supabase/functions/send-welcome-email/index.ts`

```ts
// Nowe "What you can do right now":
//   1. ➕ Add your first student and capture their professional goals  ← PRIMARY
//   2. 📊 Run the Welcome Placement Test to map their level & gaps
//   3. 📅 Set your calendar availability so students can book lessons
//   4. 📝 Generate a fully editable, goal-specific worksheet
//   5. 🚀 Send interactive homework with auto-grading

// CTA primary → /dashboard?action=add-student  (Add Your First Student)
// CTA secondary (link) → /dashboard

// Usunąć linię "a real human reads it." → zastąpić:
//   "Questions? Just reply to this email — we read every message."
```

### Reply routing → `edooqoo@gmail.com`

Resend nie przekierowuje automatycznie. Dwie opcje:
- **A. Resend „Reply to" header** = `edooqoo@gmail.com`. Wtedy gdy user kliknie Reply w mailu, klient pocztowy zaadresuje do Gmail. **Wybieram tę** — zero infrastruktury, działa od ręki.
- B. Dodać MX dla `hello@edooqoo.com` → forward do Gmail (przez Cloudflare Email Routing albo Resend Inbound). Nie wybieram — więcej DNS roboty, a A rozwiązuje 100% przypadku.

Zmiana w kodzie: `reply_to: 'edooqoo@gmail.com'` (zamiast `hello@edooqoo.com`). `from` zostaje `Edooqoo <hello@edooqoo.com>`.

Dodatkowo update query `?action=add-student` w `Dashboard.tsx`: jeśli `useSearchParams().get('action') === 'add-student'`, otworzyć `<AddStudentDialog>` automatycznie.

---

## 4) Particles.js tło na landing

### Decyzja: użyć `tsparticles` (modern fork particles.js, zero jQuery, działa z React 18 + Vite)

- Pakiet: `@tsparticles/react` + `@tsparticles/slim` (slim wystarczy, mamy tylko `circle`, `grab`, `push`, `move/top`).
- Config kopiuję 1:1 z user-uploads (250 cząstek, kolor `#643cdd`, lines `#9d8af5`, hover grab 225px, click push 4).

### Implementacja

1. `bun add @tsparticles/react @tsparticles/slim @tsparticles/engine`.
2. Nowy plik `src/components/landing/ParticlesBackground.tsx`:
   ```tsx
   import { useEffect, useState } from 'react';
   import Particles, { initParticlesEngine } from '@tsparticles/react';
   import { loadSlim } from '@tsparticles/slim';
   
   const config = { /* paste z uploadu, klucze konwertowane: line_linked → links, anim → animation itp. */ };
   
   export default function ParticlesBackground() {
     const [ready, setReady] = useState(false);
     useEffect(() => { initParticlesEngine(async (e) => { await loadSlim(e); }).then(() => setReady(true)); }, []);
     if (!ready) return null;
     return <Particles id="bg-particles" options={config} className="fixed inset-0 -z-10 pointer-events-auto" />;
   }
   ```
3. W `src/pages/Index.tsx` (tylko gdy `!isRegisteredUser`): renderować `<ParticlesBackground />` jako pierwszy element JSX. Hero/sections dostają `position: relative; z-index: 1;`.
4. **Wydajność / mobile:** w configu `detect_retina: true` zostaje, ale dodaję `if (window.innerWidth < 640) particles.number.value = 80` (mobile lighter).
5. **Nie ładować dla zalogowanych** (user widzi dashboard tła — nie chcemy regresji). Warunek `isAnonymous || !user`.
6. **Klucze JSON do tłumaczenia**: `line_linked` → `links`, `nb_sides` → `sides`, `out_mode` → `outModes.default`, `onhover.mode` → `interactivity.events.onHover.mode`. Dostarczam pełny przepisany config w implementacji.

---

## 5) Naprawa /demo (5 problemów)

### A. Save Changes na worksheet → UUID error

**Root cause:** `WorksheetContent.saveWorksheetChanges` → `updateWorksheet` → `updateService.ts` linia 27 robi `.from('worksheets').select().eq('id', 'demo-ws-1')` → Postgres rzuca UUID error.

**Fix:** w `WorksheetContent.tsx` linia 171:
```ts
const { isDemoMode, showDemoBlockedToast } = useDemoContext();
const saveWorksheetChanges = async (updatedWorksheet) => {
  if (isDemoMode) { showDemoBlockedToast('Saving worksheet changes'); return; }
  // ...rest
};
```
Także analogicznie w `useExerciseRegeneration`, `useSectionRegeneration`, `useDownloadTracking`, `useWorksheetRating` — przejdę przez wszystkie hooki, które robią `supabase.from(...).update/insert` z worksheet.id i dodam guard. Lista do guardu (zidentyfikowana grepem):
- `useExerciseRegeneration.tsx`
- `useSectionRegeneration.tsx`
- `useWorksheetRating.ts`
- `useDownloadTracking.tsx`
- `useDownloadStatus.tsx`
- `useFlashcardSets.tsx` (Add to Flashcards w demo worksheet)
- `useInteractiveHomework.tsx` (Send Homework)

### B. Studenci się nie ładują

**Root cause:** w `useStudents.tsx` linia 19-20: `enabled: isDemoMode ? !!demoData : !!teacherId`. Gdy `isDemoMode=true` i `demoData=null` (initial async load) → query disabled, ale brak fallback re-trigger po `demoData` przyszłym update. `queryKey` zawiera `!!demoData` więc po przyjściu danych powinno się włączyć — sprawdzam dlaczego nie.

**Faktyczna przyczyna:** `useAuthUser()` w demo zwraca `null` → `teacherId=undefined`. To OK (mamy `isDemoMode ? !!demoData`). Ale `studentsQuery.isLoading` jest `false` gdy query disabled (TanStack Query spec). Komponent dashboard wyświetla `studentsLoading=false && students=[]` → empty state.

**Fix:** w `useStudents`:
```ts
const loading = (isDemoMode && !demoData) || studentsQuery.isLoading;
```
Tym samym dashboard pokaże spinner aż demoData się załaduje, a potem listę.

### C. /worksheets nie ładuje

**Root cause:** `useWorksheetHistory` ma early return + `setLoading(true)` dopóki `demoData` jest null. Ale `useDeletedWorksheets` (też wołane na tej stronie) — nawet po fixie z poprzedniej iteracji — wywoływane jest z `studentFilter` który zmienia useEffect. Problem: w obu hookach `useEffect` listuje `[studentId, page, pageSize, user?.id, isDemoMode]` ale nie listuje `demoData`. W konsekwencji jeśli demoData przyjdzie po pierwszym renderze, `useWorksheetHistory` się uaktualni (bo ma osobny useEffect z `demoData`), ale `AllWorksheetsPage` używa `loading` który = `isLoading` z TanStack — w tym hooku to lokalny `useState`. Trzeba też uwzględnić, że gdy `activeTab='deleted'` i demoData ładuje się, `useDeletedWorksheets` od razu robi `setLoading(false)` więc tab pokazuje empty state — to jest OK.

**Fix dla `/worksheets`:**
1. W `AllWorksheetsPage.tsx` dodać guard: jeśli `isDemoMode && !demoData` → renderować skeleton; nie wołać effectów.
2. W `useWorksheetHistory.tsx` `useEffect` na linii 33 jest poprawny. Sprawdzić czy `useEffect` linii 98 (który wywołuje `fetchWorksheets`) nie jest wołany w demo: warunek `if (!isDemoMode) fetchWorksheets()` jest OK. ALE: `fetchWorksheets` ustawia `setLoading(true)` na początku (linia 48). To nigdy nie odpala się w demo. OK.
3. Realny bug: `useDeletedWorksheets` wywoływane na każdej zmianie `studentFilter` (też w demo) — early return jest, ale `setLoading(false)` resetuje stan. Jeśli `useWorksheetHistory` jeszcze ładuje (`demoData` null), a `useDeletedWorksheets` już skończył — `loading` z `useWorksheetHistory` zostaje true (poprawnie). Dashboard pokaże spinner.
4. **Co realnie psuje:** `useStudents` zwraca `loading=false` od razu (patrz pkt B) → `AllWorksheetsPage` próbuje renderować `students.find(...)` na pustej tablicy. Brakuje wartowniku. Po fixie B problem zniknie automatycznie.

**Wnoszę:** fix B + dodatkowy guard top-level w `AllWorksheetsPage`:
```tsx
if (isDemoMode && !demoData) return <AuthenticatedPageShell><WorksheetsSkeleton /></AuthenticatedPageShell>;
```

### D. /calendar — modal MA się otwierać, blokada na Save

**Stan obecny (po v6.9.7-patch):** `CalendarPage.handleAddSlot/handleSlotClick` mają wczesny return na `isDemoMode`. To jest niepoprawne wg nowych wymagań.

**Fix:**
1. `CalendarPage.tsx` — usunąć `if (isDemoMode) return showDemoBlockedToast(...)` z `handleAddSlot` i `handleSlotClick` i `handleSlotSave`. Pozostawić normalne otwarcie modala.
2. `UnifiedSlotModal.tsx` — w `handleSubmit` (już dodane w v6.9.7-patch) trzymać guard. Sprawdzić że działa.
3. `SlotDetailModal.tsx` — analogicznie w `handleSave` (linia 983) dodać guard `if (isDemoMode) { showDemoBlockedToast('Saving slot changes'); return; }`.

### E. Dashboard „Generate Worksheet" nie ma blokować

**Stan obecny (`Dashboard.tsx` linia 117-121):**
```ts
const handleGenerateWorksheet = () => {
  if (isDemoMode) { showDemoBlockedToast('Generating worksheets'); return; }
  sessionStorage.setItem('forceNewWorksheet', 'true');
  navigate('/');
};
```
Wymaganie: ten przycisk to nawigacja, nie generacja → blokada błędna.

**Fix:** usunąć guard w `Dashboard.handleGenerateWorksheet`. Także w `StudentPage.handleGenerateWorksheet` (jeśli jest tylko nawigacją). Faktyczna blokada jest już prawidłowo w `useWorksheetGeneration` (kliknięcie „Generate" w formularzu na `/`) i w `WorksheetForm` submit.

### Bonus — wszystkie pozostałe miejsca z guardami do uporządkowania

Zrobię systematyczny przegląd: każde `supabase.from(...).insert/update/delete` w hookach + każde `supabase.functions.invoke` które mutuje. Dodam guard albo w wywołującym handlerze (preferowane), albo w samym hooku jako defense in depth (jeśli hook jest wywoływany z wielu miejsc).

---

## 6) Dokumentacja + memory

- `docs/llm-context.md` — nowa sekcja `## v6.9.8` z 6 podsekcjami (Problem → Solution → Mechanics) dla każdego problemu.
- `llms.txt` — zaktualizować „Latest version" na `v6.9.8` z krótkim podsumowaniem, dodać invariants:
  - „Welcome email reply-to MUST be `edooqoo@gmail.com` (admin inbox), from = `hello@edooqoo.com`."
  - „Particles background MUST only render when `!isRegisteredUser` and use `tsparticles` (slim build) — never bring back legacy `particles.js`."
  - „Student Knowledge Quick Add never blocks teacher — AI classification runs fire-and-forget after save."
  - „Demo guards: nawigacja NIGDY nie blokowana; modal Calendar otwiera się w demo, blokada dopiero na Save."
- Nowe memory:
  - `mem/features/student-knowledge/quick-capture-and-ai-classify.md`
  - `mem/features/email/welcome-email-cta-add-student.md`
  - `mem/features/landing/particles-background.md`
  - Update `mem/features/public-demo-mode-lockdown.md` z nowym wzorcem („navigation handlers MUST NOT guard isDemoMode").
- `mem/index.md` — dopisać 3 nowe wpisy (NIE nadpisywać istniejących).

---

## Kolejność wdrożenia (1 sesja, ~14 kroków)

1. Migracja SQL: 4 nowe kolumny w `student_knowledge_entries`.
2. Edge function `classify-knowledge-entry` + deploy.
3. `useStudentKnowledge.addEntry` — wywołanie classify w tle.
4. `StudentKnowledgeQuickAddModal` — uproszczenie do textarea + Save.
5. `useOneMinutePrep` + `OneMinutePrepCard` w `StudentPage` (top sekcja).
6. `send-welcome-email/index.ts` — nowa treść, CTA Add Student, reply_to gmail, deploy.
7. `Dashboard.tsx` — autodetekcja `?action=add-student` → otwarcie AddStudentDialog.
8. `bun add @tsparticles/react @tsparticles/slim @tsparticles/engine`.
9. `ParticlesBackground.tsx` + integracja w `Index.tsx` (tylko anon).
10. Demo fixes: `WorksheetContent.saveWorksheetChanges` + 6 hooków worksheet (guard).
11. Demo fix: `useStudents.loading` (uwzględnić demoData).
12. Demo fix: `AllWorksheetsPage` skeleton fallback.
13. Demo fix: `CalendarPage` — usunąć early-return z handleAddSlot/handleSlotClick + `SlotDetailModal.handleSave` guard.
14. Demo fix: `Dashboard.handleGenerateWorksheet` + `StudentPage.handleGenerateWorksheet` — usunąć guard.
15. Docs: `docs/llm-context.md`, `llms.txt`, 3 nowe memory + update demo lockdown memory + `docs/operational/supabase-confirmation-template.md` (HTML szablon do Supabase Dashboard).

---

## Ryzyka i mitigacje

- **AI classification może źle przypisać kategorię** → `confidence < 0.6` zostaje `Notes`; user ma „Refine" w jednej akcji; zero blokady przepływu.
- **tsparticles wydajność na słabych maszynach** → mobile lighter (80 cząstek), `pauseOnBlur:true` (tab w tle).
- **Welcome email — Gmail jako reply_to** → user dopisuje filtr w Gmail „from:reply via Edooqoo customer". Jeśli woli osobny inbox, przeniesiemy w v6.9.9 na Cloudflare Email Routing.
- **Demo guards regression** → invariant w `llms.txt` + checklista w memory; każdy nowy handler musi przejść przez code review (mam to opisane w memory `public-demo-mode-lockdown`).
- **Student Knowledge schema migration** — wszystkie nowe kolumny mają DEFAULT lub są nullable, **zero breaking change** dla istniejących wpisów.

Po Twoim "approved" wdrażam dokładnie powyższe 15 kroków.
