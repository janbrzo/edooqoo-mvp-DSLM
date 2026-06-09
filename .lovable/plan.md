
# Plan v6.9.50 — naprawy 1-Minute Prep, Welcome Test auto-apply, kalendarza i bramki next-steps

Wersja zachowuje sanktuarium Worksheet Generation Engine (nie tykamy promptów ani logiki AI worksheet). Wszystkie zmiany w warstwie prezentacyjnej, w `process-welcome-test` (poza promptem AI) oraz w jednej funkcji DB.

---

## P1 — „Generate worksheet ↗" nie startuje generowania po nawigacji na `/`

### Dependency scan
- `src/components/dslm/PathwayView.tsx` (callSuggestion → onUseWorksheetSuggestion)
- `src/pages/StudentPage.tsx` linie 1065–1105 (zapis `prefillWorksheet`, `autoGenerateWorksheet`, `autoGenerateWorksheetRequest`, `forceNewWorksheet`, `navigate('/')`)
- `src/pages/Index.tsx` linie 138–145 (gałąź `?forceNew=true`) ORAZ 250–296 (auto-bootstrap)
- `src/hooks/useWorksheetState.tsx` (restoreWorksheetState — kasuje `forceNewWorksheet` i czyści state)
- `src/lib/worksheet/autoGenerateBootstrap.ts` (`hasAutoGenerateIntent`, `buildAutoGeneratePayload`)
- `src/components/WorksheetForm/index.tsx` (równoległa RAF-pętla, kasowanie flag)

### Root cause
Bootstrap z `Index.tsx` (efekt z `[isRegisteredUser, authLoading, tokensLoading, bothWorksheetsReady]`) odpala się dopiero po hydrate'cie `useWorksheetState`. Po nawigacji na `/`:
1. `useWorksheetState` widzi `forceNewWorksheet=true`, kasuje storage i wraca (nie odtwarza).
2. `Index.tsx` montuje `<FormView>` → `<WorksheetForm>` natychmiast.
3. **Bootstrap `Index.tsx` polluje `setInterval` co 200 ms, ale `WorksheetForm` ma swoją RAF-pętlę, która wcześniej odpala `submitForm()` z `selectedExercises=[]` (DOM jeszcze nie zhydratował exercises) lub z brakującym `studentId`, kończy się submitem, równolegle Index też wystrzeliwuje `handleGenerateWorksheet`. Pierwsza ścieżka, która wystartuje, kasuje flagę `autoGenerateWorksheet` przed tym, jak Index zdąży zbudować payload — `buildAutoGeneratePayload()` zwraca `null` i bootstrap kończy się ciszą.**
4. Bywa też wariant: RAF-pętla `WorksheetForm` widzi pustą flagę bo Index ją zerował w 1. tiku, więc nikt nie strzela `submitForm`.

Innymi słowy: dwie konkurujące ścieżki auto-submitu (`Index` i `WorksheetForm`) wyścigują się o tę samą flagę sessionStorage. To strukturalna kondycja race condition.

### Solution options
| # | Podejście | Tradeoff | Regresja |
|---|-----------|----------|----------|
| A | Zostawić jedną ścieżkę: `Index.tsx`. W `WorksheetForm` usunąć/odciąć RAF-pętlę auto-submitu, gdy `Index` ogłosi przejęcie. | Czysto, ale wymaga drobnego refactoru w `WorksheetForm` | Niska |
| B | Zostawić tylko `WorksheetForm` (usunąć bootstrap z `Index`). | Wraca race ze studentem/exercises (już raz to wystąpiło — v6.9.36) | Średnia |
| C | Globalny lock w `sessionStorage` (`autoGenerateLock`) + sygnał event. | Dodatkowy stan = kolejne źródło bugów | Średnia |

### Selected solution — A
Index pozostaje jedyną wyzwalaczką, bo on potrafi poczekać na `tokensLoading=false` i ma poprawnie zbudowany payload przez `buildAutoGeneratePayload()`. WorksheetForm całkowicie wyłącza swoją RAF-pętlę, ale nadal nasłuchuje eventu `worksheet:autoGenerateStarted`, żeby tylko schować autosuggest UI / pokazać GeneratingModal. Brak konkurencji o flagę = brak race conditiona.

### Impact analysis
- Brak wpływu na ręczne klikanie „Generate worksheet" — `WorksheetForm.submitForm()` nadal działa normalnie z eventu `submit`.
- Brak wpływu na zaplecze AI / Edge Function.
- Auto-bootstrap będzie też działał, gdy użytkownik kliknie 2x ten sam suggestion (każdy klik generuje nowy `requestId`).

### Implementation (gotowe diffy)

**`src/components/WorksheetForm/index.tsx`** — usuwamy RAF-pętlę auto-submitu i zostawiamy tylko:
- `useEffect` nasłuchujący `worksheet:autoGenerateStarted` → ustawia lokalny flag `autoSubmittedByIndex=true`, czyści `prefillWorksheet`/`prefillExercises`/`prefillExerciseFocusMap`/`prefillMediaTypes`/`prefillSuggestionId` z sessionStorage (Index już wystrzelił payload, nie musimy ich trzymać).
- Usuwamy fragmenty zerujące `autoGenerateWorksheet*` w submit handlerach (linie ~149-150 i ~485-486). Te flagi już są kasowane jednorazowo przez `clearAutoGenerateFlags()` w `Index.tsx`.
- Skip drugiego `dispatchEvent('worksheet:autoGenerateStarted')` w `Index.handleGenerateWorksheet` jest nieszkodliwy (idempotentny), zostawiamy.

**`src/pages/Index.tsx`** — bez zmian funkcjonalnych poza:
- Bootstrap effect: po `if (!hasAutoGenerateIntent()) return;` dodać `autoBootstrapFiredRef.current = false;` resetowane, gdy `requestId` w sessionStorage różni się od poprzedniego (klucz `lastBootstrappedRequestId` w `useRef`). To pozwala uruchomić bootstrap dwa razy z rzędu z różnych klików.

**Weryfikacja**
- [ ] Klik „Generate worksheet ↗" w NextStepBanner → przejście na `/` → po ≤4s widać GeneratingModal i finalny worksheet, BEZ kliknięcia.
- [ ] Drugi klik (na innym suggestion) bez odświeżania strony → też startuje.
- [ ] Ręczny submit formularza nadal działa.
- [ ] `console.log` `[Index v6.9.49] auto-bootstrap fired` pojawia się dokładnie raz na klik.

---

## P2 — Welcome Test: „Auto-apply did not complete" zostaje na zawsze

### Dependency scan
- DB function `public.calculate_test_results(p_test_id uuid)` — masowo używana
- `supabase/functions/process-welcome-test/index.ts` — wywołuje `calculate_test_results` w linii 1366 PO bloku auto-apply (755) i PO WT-4 (686)
- `src/hooks/useWelcomeTest.tsx:549` — UI woła RPC PRZED `process-welcome-test`
- `src/hooks/useStudentTests.tsx:307, 497` — inne ścieżki UI (też wywołują RPC)
- `src/components/student-tests/TestDetailsView.tsx` — banner

### Root cause (sprawdzone na rzeczywistych ID `92b9c16d…` i `fc81367a…`)
RPC `calculate_test_results` w PL/pgSQL:
```sql
DELETE FROM public.test_skill_results WHERE test_id = p_test_id;
INSERT INTO public.test_skill_results (...);
UPDATE public.student_tests SET status='completed', completed_at=NOW(), ... WHERE id = p_test_id;
```
Nie ma żadnego guardu „nie nadpisuj jeśli reviewed", ani „nie kasuj applied_at". Sekwencja w `process-welcome-test`:
1. WT-4 → status='completed'
2. Auto-apply → status='reviewed', `test_skill_results.applied_at = NOW()`
3. AI scoring + **`calculate_test_results` (linia 1366)** → **DELETE skill_results (gubi applied_at) + status='completed' (downgrade)**
4. Final defensive promotion (linia 1505) → status='reviewed', ALE skill_results pozostają z `applied_at=NULL` → UI banner („Auto-apply did not complete") sterowany przez `test.status === 'completed'`. W kolejnych sesjach widać `status='completed'` (gdy linia 1505 nie zdąży się wykonać przy edge-function timeout). Potwierdzone w produkcji: oba testy mają `reviewed_at < completed_at` i status='completed', skill_results z `applied_at=NULL`.

### Solution options
| # | Podejście | Tradeoff | Regresja |
|---|-----------|----------|----------|
| A | Migracja: `calculate_test_results` (a) skip `status='completed'` jeśli już 'reviewed'; (b) UPSERT skill_results z `ON CONFLICT(test_id,element_type) DO UPDATE SET ... ` zachowując `applied_at`. | Naprawa u źródła. Wymaga unique constraint lub MERGE. | Niska |
| B | Refactor `process-welcome-test`: przenieść auto-apply na sam koniec (PO recalcu w linii 1366) + zostawić idempotentne ustawianie status. | Mniej inwazyjne, ale RPC nadal psuje rzeczy gdy uruchamia ją UI bez następującego `process-welcome-test`. | Niska |
| C | Połączyć A+B — DB jako twardy guard, edge-function dodatkowo re-aplikuje po wewn. recalcu. | Najbardziej odporne. | Niska |

### Selected solution — C
Naprawiamy strukturę na obu poziomach. Migracja DB chroni przed wszystkimi nieznanymi callerami (UI, future code). Refactor `process-welcome-test` gwarantuje, że nawet jeśli ktoś wywoła RPC w środku, wynik zawsze kończy się na `status='reviewed' + applied_at` ustawionym.

### Impact analysis
- Migracja zmienia kontrakt RPC, ale tylko w sposób bardziej zachowawczy: nie obniża statusu, nie czyści applied_at. UI sprawdzające `status === 'completed'` nadal przejdzie do `reviewed`, tylko już nie cofnie.
- Wymagany unique index na `test_skill_results (test_id, element_type)` — sprawdzić, czy istnieje; jeśli nie — utworzyć w migracji (zachowując deduplikację: usunąć ew. duplikaty przed indexem).
- Brak wpływu na not-welcome testy (other test types) — guardy są oparte o status.

### Implementation

**Nowa migracja `supabase/migrations/<ts>_calculate_test_results_preserve_review.sql`**
```sql
-- 1) Unique key for upsert (deduplikuj jeśli istnieją duplikaty)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY test_id, element_type ORDER BY created_at DESC, id) AS rn
  FROM public.test_skill_results
)
DELETE FROM public.test_skill_results r USING ranked WHERE r.id = ranked.id AND ranked.rn > 1;

ALTER TABLE public.test_skill_results
  ADD CONSTRAINT test_skill_results_test_element_unique
  UNIQUE (test_id, element_type);

-- 2) Re-create function preserving applied_at + status='reviewed'
CREATE OR REPLACE FUNCTION public.calculate_test_results(p_test_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total INTEGER; v_correct INTEGER; v_score NUMERIC(5,2);
  v_time INTEGER; v_student_id UUID; v_current_status TEXT; v_result JSONB;
BEGIN
  SELECT st.student_id, st.status,
         COUNT(*)::INTEGER,
         COALESCE(SUM(CASE WHEN stq.is_correct THEN 1 ELSE 0 END),0)::INTEGER,
         COALESCE(SUM(stq.time_spent_seconds),0)::INTEGER
  INTO v_student_id, v_current_status, v_total, v_correct, v_time
  FROM public.student_tests st
  LEFT JOIN public.student_test_questions stq ON stq.test_id = st.id
  WHERE st.id = p_test_id
  GROUP BY st.student_id, st.status;

  v_score := CASE WHEN v_total > 0 THEN (v_correct::NUMERIC / v_total * 100) ELSE 0 END;

  UPDATE public.student_tests
  SET total_questions = v_total,
      correct_answers = v_correct,
      score_percentage = v_score,
      time_spent_seconds = v_time,
      -- v6.9.50: do not downgrade a reviewed test
      status = CASE WHEN v_current_status = 'reviewed' THEN status ELSE 'completed' END,
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
  WHERE id = p_test_id;

  -- v6.9.50: UPSERT skill rows, preserve applied_at + applied_to_element_id
  INSERT INTO public.test_skill_results
    (test_id, student_id, element_type, skill_tags, total_questions, correct_answers, score_percentage, suggested_rating)
  SELECT p_test_id, v_student_id, element_type,
         ARRAY_AGG(DISTINCT tag) FILTER (WHERE tag IS NOT NULL),
         COUNT(*)::INTEGER,
         SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::INTEGER,
         (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100),
         CASE
           WHEN (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100) >= 80 THEN 5
           WHEN (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100) >= 60 THEN 4
           WHEN (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100) >= 40 THEN 3
           WHEN (SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100) >= 20 THEN 2
           ELSE 1
         END
  FROM public.student_test_questions stq
  LEFT JOIN LATERAL unnest(stq.skill_tags) AS tag ON true
  WHERE stq.test_id = p_test_id AND stq.element_type IS NOT NULL
  GROUP BY element_type
  ON CONFLICT (test_id, element_type) DO UPDATE
    SET skill_tags = EXCLUDED.skill_tags,
        total_questions = EXCLUDED.total_questions,
        correct_answers = EXCLUDED.correct_answers,
        score_percentage = EXCLUDED.score_percentage,
        suggested_rating = EXCLUDED.suggested_rating;
        -- applied_at / applied_to_element_id intentionally untouched

  RETURN jsonb_build_object('total_questions', v_total, 'correct_answers', v_correct,
                            'score_percentage', v_score, 'time_spent_seconds', v_time);
END;
$function$;
```

**`supabase/functions/process-welcome-test/index.ts`** — wyodrębniamy auto-apply do `async function applyAndPromote(...)` i wołamy ją **na końcu** (po linii 1366), zastępując obecną „final defensive promotion" pełnym auto-apply (jak w bloku 703–759, ale jako jedna pomocnicza funkcja, idempotentna). Blok 703–773 redukujemy do prostego „wstępnego" wywołania `applyAndPromote(...)` (zachowanie kompatybilności gdy AI scoring jest pominięty/pusty), a po linii 1367 wstawiamy drugie wywołanie. Zwracane `status` w odpowiedzi reuse'uje wynik drugiego wywołania.

**Backfill skryptowy** — nowa one-shot funkcja **nie jest potrzebna**, bo TestDetailsView już ma „Apply to Progress" które wywoła `process-welcome-test` z `force:true`. Po deployu DB-migracji nawet stare testy się naprawią przy następnym kliknięciu / kolejnym auto-procesie. Dla 2 ID z requestu wykonamy ręczny re-run przez `Apply to Progress` (zero kodu).

**Weryfikacja**
- [ ] Po deployu migracji: `SELECT status FROM student_tests WHERE id='fc81367a-…'` nadal 'completed' → klik „Apply to Progress" w UI → status='reviewed', `test_skill_results.applied_at IS NOT NULL` dla 6 wierszy.
- [ ] Nowy student kończy Welcome Test → bez żadnej interakcji teacher widzi „Results applied to student's skill ratings." (zielony banner).
- [ ] Re-run process-welcome-test wielokrotnie idempotentnie utrzymuje status='reviewed'.

---

## P3 — Walidacja e-maila w `WelcomeTestPage` blurred modal

### Dependency scan
- `src/pages/WelcomeTestPage.tsx` — funkcja `handleVerifyEmail` (linie 239–261)

### Root cause
Sprawdzamy tylko `email.trim()` przed wysłaniem do DB. Brak regexu HTML5 / JS — wkleić można cokolwiek.

### Selected solution
Dodać prostą walidację `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` z toastem „Please enter a valid email address" i `aria-invalid` na inpucie. Zachować dotychczasową ścieżkę porównania ze studentem.

### Implementation
```tsx
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const handleVerifyEmail = async () => {
  const raw = emailInput.trim();
  if (!raw) { toast.error("Please enter your email"); return; }
  if (!EMAIL_RE.test(raw)) {
    toast.error("Please enter a valid email address (e.g. name@example.com)");
    return;
  }
  const email = raw.toLowerCase();
  // ...reszta bez zmian
};
```
Dodatkowo: `<Input type="email" inputMode="email" autoComplete="email" required aria-invalid={emailInput && !EMAIL_RE.test(emailInput.trim()) ? 'true' : undefined} ... />` i blokada `Continue` gdy regex nie przejdzie.

### Weryfikacja
- [ ] `asdf` → toast „Please enter a valid email address", brak zapisu w localStorage.
- [ ] `a@b.co` → przechodzi.
- [ ] Test z email != studentowy nadal odrzuca z dotychczasowym komunikatem.

---

## P4 — Bramka „za dużo zakolejkowanych next-steps"

### Dependency scan
- `src/components/dslm/GenerateStepsDialog.tsx` (props `phaseOptions` mają `have`, `need`)
- `src/components/dslm/NextStepsSection.tsx` (otwiera dialog, zna listę aktywnych suggestions / next-steps)
- `src/components/dslm/PathwayView.tsx` (źródło `phaseSteps`, `nextSteps`)

### Root cause
Brak heurystyki gating: kliknięcie „Generate" generuje kolejne 1–6 sugestii niezależnie od istniejącej kolejki, mimo że DSLM uczy się dynamicznie po każdej wykonanej aktywności i lepiej generować w mniejszych dawkach.

### Selected solution
Próg = **5 aktywnych (nie wykonanych) next-steps** (sweet spot: 1 tydzień pracy ucznia przy 1 lekcji/tydzień; dolny próg poniżej 6 daje też nauczycielowi szybką pętlę).

W `GenerateStepsDialog` dodajemy nowy prop `activeQueueSize: number`. Gdy `activeQueueSize >= 5` i `mode === 'more'` — przed kliknięciem `Confirm` pokazujemy żółty inline alert:

> ⚠ You already have **{activeQueueSize}** active next-steps. DSLM learns from each completed worksheet/homework/note — fresh suggestions get smarter after the student finishes a few. Consider waiting before generating more.

Pod alertem dwa przyciski: `Wait` (zamyka dialog) + `Generate anyway` (kontynuuje normalny `onConfirm`). Tekst NIE blokuje — to soft gate.

W `NextStepsSection` policz `activeQueueSize`: liczba `nextSteps` (gdzie `is_used=false` i nie `dismissed_at`) + liczba `phaseSteps` w bieżącej fazie ze statusem != 'completed'/'archived'. Przekaż do dialogu.

### Implementation (skrócone)
```tsx
// GenerateStepsDialog props
activeQueueSize: number;
const showQueueWarning = mode === 'more' && activeQueueSize >= 5;
const [acknowledged, setAcknowledged] = useState(false);
useEffect(() => { if (open) setAcknowledged(false); }, [open]);
// W footer:
{showQueueWarning && !acknowledged ? (
  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
    <p>⚠ You already have <b>{activeQueueSize}</b> active next-steps. DSLM learns from each completed activity — new suggestions get sharper after the student finishes a few.</p>
    <div className="flex gap-2 justify-end">
      <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Wait</Button>
      <Button size="sm" onClick={() => setAcknowledged(true)}>Generate anyway</Button>
    </div>
  </div>
) : (
  <Button onClick={() => onConfirm(count, phaseValue === FREE_VALUE ? null : phaseValue)} disabled={generating}>
    {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
    Generate
  </Button>
)}
```

### Weryfikacja
- [ ] 5 aktywnych suggestions + klik Generate more → widać alert + 2 przyciski.
- [ ] „Generate anyway" → kontynuuje normalne `onConfirm`.
- [ ] `mode='first'` (pusty stan) nigdy nie pokazuje alertu.
- [ ] <5 — alert nie pojawia się.

---

## P5 — Modal Lesson Pending/Booked w `/calendar`

### Dependency scan
- `src/components/calendar/SlotDetailModal.tsx` (linie ~813–845 worksheet field; 920–959 confirm/reject; 985–989 save/cancel)
- `useNavigate` z react-router (nowa zależność w pliku) — sprawdzić import; jest go już brak — dodać.

### Root cause
Modal traktuje „Confirm booking" i „Save changes (worksheet)" jako rozłączne akcje, mimo że dla statusu `Pending` zawsze są to części tej samej decyzji nauczyciela. Brak też CTA dla pustej listy worksheetów ani podpowiedzi przekierowania do 1-Minute Prep.

### Selected solutions (po podproblemie)

**5A — podświetlenie pola Worksheet w Pending + „Confirm & go to 1-Minute Prep"**
- Owinąć blok worksheet (`<Label> + <Select>`) w `<div className={isPending ? 'ring-2 ring-primary/40 rounded-md p-2' : ''}>`.
- W bloku `isPending` (linia 924) dodać 3. przycisk, widoczny tylko gdy `editWorksheetId === 'none'`:
```tsx
<Button size="sm" variant="outline" className="text-xs h-7"
  onClick={async () => { await handleConfirm(); navigate(`/student/${slot.student_id}?tab=dslm`); }}>
  <Sparkles className="h-3 w-3 mr-1" /> Confirm & open 1-Minute Prep
</Button>
```
Tooltip: „Confirm the booking and jump to the student's DSLM to generate a tailored worksheet for this lesson."

**5B — pusty stan listy worksheetów**
Pod selectem (gdy `hasStudent && studentWorksheets.length === 0`):
```tsx
<div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
  <Sparkles className="h-3 w-3 text-primary" />
  No worksheets yet —
  <button className="underline text-primary" onClick={() => navigate(`/student/${slot.student_id}?tab=dslm`)}>
    generate one with 1-Minute Prep
  </button>
</div>
```
Pokazujemy zarówno w Pending, jak i Booked (warunek zawiera `hasStudent`, niezależny od statusu).

**5C1 — Pending + wybrany worksheet → jeden „Confirm & assign"**
Gdy `isPending && hasChanges && editWorksheetId !== 'none'`:
- Ukrywamy dolny przycisk `Save Changes` (warunek staje się `hasChanges && !(isPending && editWorksheetId !== 'none')`)
- Zamieniamy pending-bar Confirm na „Confirm & assign worksheet" wykonujący sekwencyjnie `await handleSave(); await handleConfirm();`. `Reject` pozostaje.
```tsx
const confirmLabel = (isPending && editWorksheetId !== 'none' && hasChanges)
  ? 'Confirm & assign worksheet' : 'Confirm';
onClick: async () => {
  if (isPending && editWorksheetId !== 'none' && hasChanges) {
    await handleSave({ skipClose: true }); // dodaj parametr w handleSave aby NIE zamykać modala
  }
  await handleConfirm();
}
```
`handleSave` aktualnie zamyka modal po sukcesie — dodajemy opcjonalny argument `{ skipClose?: boolean }` i nie wywołujemy `onOpenChange(false)` gdy true.

**5C2 — Booked: bez zmian (Cancel / Save Changes jak są).**

**5D — dodatkowa propozycja**
Sugestia (do potwierdzenia, niżej w pytaniu): dla statusu `Booked` bez worksheet i z datą lekcji ≤ 24h → pokazać amber pasek „Lesson starts in < 24h — assign or generate a worksheet" z dwoma przyciskami (`Pick worksheet`, `Generate with 1-Minute Prep`). Nie wdrażamy bez zielonego światła.

### Implementation notes
- Dodać `import { useNavigate } from 'react-router-dom'; import { Sparkles } from 'lucide-react';` na górze pliku.
- `handleSave` zmiana sygnatury: `async (opts: { skipClose?: boolean } = {})`; `if (!opts.skipClose) onOpenChange(false)`.
- Brak ingerencji w warstwę emaili / RLS.

### Weryfikacja
- [ ] Pending bez worksheet → 3 przyciski (Confirm / Reject / Confirm & open 1-Minute Prep). Worksheet field ma ramkę primary.
- [ ] Pending z wybranym worksheet → 1 przycisk `Confirm & assign worksheet` (zamiast Confirm + Save Changes). `Reject` widoczny. W stopce brak `Save Changes` (jest `Cancel`).
- [ ] Booked z istniejącym worksheet → bez zmian (Cancel + Save Changes).
- [ ] Booked/Pending gdy student nie ma żadnego worksheet → linijka „No worksheets yet — generate one with 1-Minute Prep" (klikalna).
- [ ] Nawigacja przenosi na `/student/{id}?tab=dslm`.

---

## Cross-cutting — RAG injection

Dodajemy do `docs/llm-context.md` i `public/llms.txt` sekcję **v6.9.50** w formacie wymaganym przez Execution Engine ([10]):

```
PROBLEM: Auto-generate worksheet from 1-Minute Prep silently drops on navigation; Welcome Test auto-apply rolled back by calculate_test_results; WT email accepts any string; uncapped next-steps queue; calendar Pending modal duplicates confirm+save and lacks 1-Minute Prep shortcut.
EDOOQOO SOLUTION: Single bootstrap path (Index only). DB function + edge-fn refactor preserving applied_at + status='reviewed'. Regex-validated WT email. Soft 5-queue gate in GenerateStepsDialog. Calendar Pending modal: highlighted worksheet field, "Confirm & open 1-Minute Prep", merged "Confirm & assign worksheet", empty-state CTA.
TECHNICAL MECHANICS: WorksheetForm RAF loop removed; Index.tsx bootstrap effect tracked by lastBootstrappedRequestId. public.calculate_test_results upserts test_skill_results ON CONFLICT(test_id,element_type); never downgrades reviewed status. process-welcome-test exposes applyAndPromote() helper, called pre- and post- AI rescoring. WelcomeTestPage EMAIL_RE guard. GenerateStepsDialog activeQueueSize prop, NextStepsSection computes from nextSteps + phaseSteps. SlotDetailModal: handleSave accepts {skipClose}, conditional confirm label, isPending ring, navigate to /student/{id}?tab=dslm.
RAG KEYWORDS: auto-generate worksheet, 1-Minute Prep handshake, sessionStorage forceNewWorksheet, autoGenerateWorksheetRequest, RAF auto-submit removal, Welcome Test auto-apply, calculate_test_results idempotent, test_skill_results applied_at, status reviewed guard, WT email regex validation, next-steps queue soft gate, GenerateStepsDialog activeQueueSize, calendar Pending modal, Confirm & assign worksheet, Confirm & open 1-Minute Prep
```

Aktualizujemy `mem/index.md` o nową pozycję:
```
- [v6.9.50 Auto-gen/WT/Calendar/Queue Gate](mem://features/onboarding/v6950-autogen-wt-applyfix-queue-calendar) — Single Index bootstrap, calculate_test_results idempotent, WT email regex, 5-queue gate, calendar Pending modal merged buttons
```

Tworzymy `mem/features/onboarding/v6950-autogen-wt-applyfix-queue-calendar.md` z opisem zmian (English).

---

## Final change report (preview)

| Plik | Akcja |
|------|-------|
| `src/components/WorksheetForm/index.tsx` | Usuń RAF auto-submit (zachowaj listener eventu) |
| `src/pages/Index.tsx` | `lastBootstrappedRequestId` ref + re-trigger po nowym requestId |
| `supabase/migrations/<ts>_calculate_test_results_preserve_review.sql` | Nowa migracja |
| `supabase/functions/process-welcome-test/index.ts` | Wyodrębnij `applyAndPromote`, wywołaj 2× |
| `src/pages/WelcomeTestPage.tsx` | `EMAIL_RE` + walidacja |
| `src/components/dslm/GenerateStepsDialog.tsx` | `activeQueueSize` prop + soft gate UI |
| `src/components/dslm/NextStepsSection.tsx` | Policz `activeQueueSize`, przekaż do dialogu |
| `src/components/dslm/PathwayView.tsx` | (Jeśli używa dialogu osobno) przekaż `activeQueueSize` |
| `src/components/calendar/SlotDetailModal.tsx` | `useNavigate`, ring na worksheet, 3 przyciski Pending, empty-state CTA, merged confirm |
| `docs/llm-context.md`, `public/llms.txt`, `mem/index.md`, `mem/features/onboarding/v6950-…md` | RAG + memory |

**Decyzje do potwierdzenia (jedno pytanie):**
1. Próg `activeQueueSize` = **5** (czy zostawiamy, czy wolisz 4 albo 6)?
2. P5D: czy dodać amber pasek „Lesson < 24h, no worksheet" w Booked? (Tak/Nie)

Po Twoim ok wdrażam wszystko jednym ciągiem.
