
# Plan v6.9.37 — Onboarding stabilization + Audit clarity

Cały kod i dokumentacja po angielsku. Komunikacja po polsku. Worksheet Generation Engine NIE jest dotykany. Zero regresji poza explicit listą.

---

## P1 — Auto-generate w „1-Minute Prep suggestions” NADAL nie startuje

### Dependency scan
- `src/components/dslm/NextStepBanner.tsx` — przycisk „Generate worksheet ↗” → `onUseAndGenerate(suggestion)`.
- `src/components/dslm/PathwayView.tsx` → `callSuggestion(s, true)` → `onUseWorksheetSuggestion(..., autoGenerate=true, suggestionId)`.
- `src/pages/StudentPage.tsx` (1065–1102) — zapisuje sessionStorage (`prefillWorksheet`, `prefillExercises`, `prefillExerciseFocusMap`, `prefillMediaTypes`, `preSelectedStudent`, `autoGenerateWorksheet=true`, `autoGenerateWorksheetRequest`) i nawiguje `navigate('/')`.
- `src/pages/Index.tsx` (148–161) — czyta `preSelectedStudent`, ustawia stan i przekazuje jako prop do `WorksheetForm`.
- `src/components/WorksheetForm/index.tsx` (206–323) — mount-effect czyta prefill + flagę; readiness gate (deps: `lessonTopic, selectedStudentId, selectedExercises, selectedMediaTypes, exerciseFocusMap`) próbuje `formRef.requestSubmit()`.
- `src/hooks/useWorksheetFormPersistence.ts` — pomija hydrację gdy obecny `autoGenerateWorksheet` w sessionStorage (OK).

### Root cause
Bramka gotowości (`readiness gate`) ma warunek `if (req?.studentId && selectedStudentId !== req.studentId) return;`. `selectedStudentId` jest synchronizowany pośrednio przez prop `preSelectedStudent` ustawiany w **innym** komponencie (`Index`) na podstawie `sessionStorage`. Przy nawigacji z `/student/:id` na `/` ta synchronizacja zachodzi dopiero po:
1. mount `Index` → `useEffect[]` czyta `preSelectedStudent` z sessionStorage → `setPreSelectedStudent` → re-render Index;
2. nowy prop dolatuje do `WorksheetForm` → `useEffect[preSelectedStudent]` → `setSelectedStudentId(student.id)` → re-render formularza.

W międzyczasie watchdog 30 s i tak wystarczy — ale w praktyce użytkownik widzi „nic się nie dzieje”, bo readiness gate nigdy nie odpala submita zanim któryś następny render dotknie zależności. Drugi problem: efekt mount (deps `[]`) w `WorksheetForm` zapisuje `autoSubmitRequestRef`, ale readiness gate ma w deps tylko stany (`selectedStudentId` itd.). Jeśli w trakcie hydration `selectedStudentId` zostanie ustawiony **przed** uruchomieniem mount-effectu (np. preSelectedStudent prop arrived przy pierwszym renderze), `autoSubmitRequestRef.current` jest jeszcze `null`, gate przechodzi przez wszystkie warunki, ale następnie próbuje submit — i tu nie ma już re-triggera. W praktyce zdarza się permutacja, gdzie gate **nigdy** nie uruchamia submita.

Dodatkowy problem regresyjny: `selectedStudentId === 'no-student'` jest stanem inicjalnym, ale `req.studentId` to UUID. Jeżeli prop `preSelectedStudent` przyleci ale `students` z `useStudents()` jeszcze się nie załadowali, `Select` może odrzucić wartość — i tak ją utrzymamy w stanie, ale w jakimś przepływie test e2e (np. cold network) timeout 30 s się nie zalicza.

### Solution options
| Opcja | Tradeoff | Risk |
|---|---|---|
| A. WorksheetForm sam czyta `autoGenerateWorksheetRequest` na mount i ustawia `selectedStudentId` bezpośrednio (bez czekania na prop `preSelectedStudent`). Skraca łańcuch i eliminuje race. | Niewielka duplikacja sessionStorage-read. | LOW |
| B. Połączyć efekt mount + readiness gate w jeden efekt z `useState`-driven trigger (`readyTick`). | Większa refaktoryzacja. | MED |
| C. Wymusić submit zawsze po 800 ms timeout. | Wraca poprzedni bug timera. | HIGH |

### Selected: A
Dodatkowo: 1) zmniejszamy watchdog z 30 s do 5 s + force-submit jeśli gate się zablokował tylko na `selectedStudentId` (z `requestRef.studentId` jako jedynego źródła prawdy), 2) dodajemy `devLog` każdej blokady gate (aby w przyszłości debug był prosty), 3) `Index.tsx` zostaje bez zmian (kompat. pre-selected wciąż działa), 4) `useWorksheetFormPersistence` już respektuje `autoGenerateWorksheet`, więc draft go nie nadpisze.

### Impact analysis
- Brak wpływu na ręczne uruchomienie generowania.
- Brak wpływu na inne ścieżki prefill (Dashboard restore, Progress Tab „Use this”).
- Worksheet Generation Engine — bez zmian.
- Token gate / paywall działa tak samo (submit fizycznie naciska przycisk submit).

### Implementation (gotowy diff)
**Plik: `src/components/WorksheetForm/index.tsx`**

W mount-effect (linia ~272) po odczycie flagi autoGenerate dodać:
```ts
if (shouldAutoGenerate) {
  try {
    const raw = sessionStorage.getItem('autoGenerateWorksheetRequest');
    if (raw) {
      const req = JSON.parse(raw);
      autoSubmitRequestRef.current = req;
      // v6.9.37 — bypass prop race: pin student immediately from the request.
      if (req?.studentId && typeof req.studentId === 'string') {
        setSelectedStudentId(req.studentId);
      }
    }
  } catch { /* ignore */ }
  devLog('🚀 [WorksheetForm v6.9.37] autoGenerate flag detected; readiness gate armed');
}
```

Zmienić readiness gate (linia ~289) — dodać precyzyjne devLogi i twardszy fallback:
```ts
useEffect(() => {
  if (autoSubmitFiredRef.current) return;
  if (sessionStorage.getItem('autoGenerateWorksheet') !== 'true') return;
  const req = autoSubmitRequestRef.current;
  // Block conditions with explicit logging (helps next debug cycle).
  if (!lessonTopic || !lessonTopic.trim()) { devLog('[autoSubmit] waiting: lessonTopic empty'); return; }
  if (!selectedExercises || selectedExercises.length === 0) { devLog('[autoSubmit] waiting: no exercises'); return; }
  if (!formRef.current) { devLog('[autoSubmit] waiting: no formRef'); return; }
  if (req?.studentId && selectedStudentId !== req.studentId) { devLog('[autoSubmit] waiting: student not hydrated', { want: req.studentId, have: selectedStudentId }); return; }
  autoSubmitFiredRef.current = true;
  sessionStorage.removeItem('autoGenerateWorksheet');
  sessionStorage.removeItem('autoGenerateWorksheetRequest');
  window.setTimeout(() => {
    requestAnimationFrame(() => {
      try {
        devLog('🚀 [WorksheetForm v6.9.37] Auto-submitting');
        formRef.current?.requestSubmit();
      } catch (e) { devWarn('[WorksheetForm] requestSubmit threw', e); }
    });
  }, 0);
}, [lessonTopic, selectedStudentId, selectedExercises, selectedMediaTypes, exerciseFocusMap]);
```

Skrócony watchdog (linia ~314):
```ts
useEffect(() => {
  const t = setTimeout(() => {
    if (autoSubmitFiredRef.current) return;
    if (sessionStorage.getItem('autoGenerateWorksheet') !== 'true') return;
    // v6.9.37 — last-resort: if topic+exercises present but student never hydrated, submit anyway.
    const ok = !!lessonTopic?.trim() && (selectedExercises?.length ?? 0) > 0 && !!formRef.current;
    if (ok) {
      autoSubmitFiredRef.current = true;
      sessionStorage.removeItem('autoGenerateWorksheet');
      sessionStorage.removeItem('autoGenerateWorksheetRequest');
      devWarn('[WorksheetForm v6.9.37] watchdog force-submit (student hydration timed out)');
      formRef.current?.requestSubmit();
    } else {
      devWarn('[WorksheetForm v6.9.37] watchdog dropping flag (form not ready)');
      sessionStorage.removeItem('autoGenerateWorksheet');
      sessionStorage.removeItem('autoGenerateWorksheetRequest');
    }
  }, 5000);
  return () => clearTimeout(t);
}, []); // intentionally one-shot
```

### Verification checklist
- [ ] Klik „Generate worksheet ↗” na `/student/:id?tab=dslm` → strona `/` z wypełnionymi polami → po max 1 s widoczny stan „Generating…”.
- [ ] DevLog ciąg: `autoGenerate flag detected` → ewent. `waiting: …` → `Auto-submitting`.
- [ ] Manualne wypełnienie formularza i klik Submit nadal działa.
- [ ] Reload `/` bez prefill — readiness gate nie odpala (flag nieobecna).

---

## P2 — Modal „Add learning goals” nie otwiera się po automatycznym wysłaniu Welcome Test

### Dependency scan
- `src/components/dashboard/AddStudentDialog.tsx` (231) — przy autosend nawigacja: `/student/${id}?tab=dslm&view=goals&focus=add-goal-modal&_=ts`.
- `src/pages/StudentPage.tsx` (250) — `activeTab` z `searchParams.get('tab') || 'dslm'`.
- `src/components/dslm/DSLMTab.tsx` (191–214) — focus-effect 500 ms → `handleScrollTo('goals')` + `setPendingAddGoal(true)` + strip params.
- `src/components/dslm/DSLMTab.tsx` (280–293) — `GoalsView` zawinięty w `LazySection` (rootMargin 300 px, NOT eager).
- `src/components/dslm/LazySection.tsx` — montuje children dopiero gdy IntersectionObserver złapie obecność w viewport +/-300 px.
- `src/components/dslm/GoalsView.tsx` (76–84) — `useEffect[pendingAddGoal, onConsumePendingAddGoal]` → `setShowAddGoal(true)`.

### Root cause
`onConsumePendingAddGoal={() => setPendingAddGoal(false)}` w `DSLMTab` (linia 291) tworzy **nową referencję funkcji w każdym renderze**. Sekwencja:
1. focus-effect (po 500 ms) → `setPendingAddGoal(true)` + smooth scroll.
2. Parent re-render → nowa referencja `onConsumePendingAddGoal`.
3. Jeszcze przed mountem `GoalsView` (bo `LazySection` czeka na IO, scroll trwa 800 ms), kolejne re-rendery zmieniają referencję bez znaczenia.
4. `GoalsView` w końcu się montuje z `pendingAddGoal=true` i jakąś świeżą referencją. Efekt fires → `setShowAddGoal(true)` + `onConsumePendingAddGoal()` → `setPendingAddGoal(false)`.
5. Parent re-render → nowa referencja → child efekt re-fires **ponieważ deps mają funkcję**, ale teraz `pendingAddGoal=false`, więc gałąź `if (pendingAddGoal)` nie pali. Modal pozostaje otwarty. To **powinno** działać.

Praktyczna obserwacja użytkownika („njechało, modal się nie otworzył”) wskazuje, że w realnym dev-buildzie z React StrictMode + `unstable_batchedUpdates` + Tabs (Radix montuje TabsContent dopiero gdy value === active, a `tab` aktualizuje się z `searchParams` przez `useEffect`, więc istnieje moment gdzie DSLMTab nie jest jeszcze zamontowany kiedy URL ma `focus=add-goal-modal`). focus-effect uruchamia setTimeout(500 ms) tylko **po** zamontowaniu DSLMTab. Jeśli mount nastąpi z opóźnieniem >0, a Radix Tabs ma własną logikę keep-alive, focus-effect odpala timeout PO tym jak `searchParams` zmieniły się w między czasie do `view=goals` bez `focus` (z innego efektu). Mniej istotne — najsilniejsza root cause to **LazySection nie eager** dla pendingAddGoal, i zależność `onConsumePendingAddGoal` na funkcji parent.

### Solution options
| Opcja | Tradeoff | Risk |
|---|---|---|
| A. `GoalsView` montowany eager gdy `focus=add-goal-modal` (przekazujemy do `LazySection` prop `eager`). Mount jest natychmiastowy, prop pendingAddGoal=true → modal otwiera się od razu. | Goals montuje się też gdy user trafia z innego linku z tym focusem — to jest oczekiwane. | LOW |
| B. Przeniesienie `pendingAddGoal` do `sessionStorage`/URL i odczyt w GoalsView na mount (bez prop). | Więcej state w globalnym storage. | LOW–MED |
| C. `useCallback` na `onConsumePendingAddGoal`. | Nie rozwiązuje LazySection race. | LOW |

### Selected: A + C (combo)
- Eager mount eliminuje race montowania.
- Stabilna referencja consume callback usuwa potencjalne re-fires.

### Impact
- `LazySection` zyskuje conditional `eager` tylko przy focus = add-goal-modal.
- Inne sekcje DSLM bez zmian.
- Brak wpływu na ścieżkę Roadmap "Add goal" (event `dslm:addGoal`).

### Implementation
**Plik: `src/components/dslm/DSLMTab.tsx`**

```tsx
// near other useCallback / state
const handleConsumePendingAddGoal = useCallback(() => setPendingAddGoal(false), []);
const goalsEagerMount = pendingAddGoal || (searchParams.get('focus') === 'add-goal-modal');
```

Sekcja Goals (linia 278–294):
```tsx
<div ref={sectionRefs.goals} data-section="goals" className="scroll-mt-4 pt-8">
  {sectionHeader('Goals')}
  <LazySection eager={goalsEagerMount}>
    <GoalsView
      studentId={studentId}
      teacherId={teacherId}
      studentName={studentName}
      englishLevel={englishLevel}
      mainGoal={mainGoal}
      mainGoalTargetDate={mainGoalTargetDate}
      onMainGoalChange={onMainGoalChange}
      onMainGoalTargetDateChange={onMainGoalTargetDateChange}
      pendingAddGoal={pendingAddGoal}
      onConsumePendingAddGoal={handleConsumePendingAddGoal}
    />
  </LazySection>
</div>
```

Dodać `import { useCallback } from 'react';` jeśli brak.

### Verification
- [ ] Add Student z zaznaczonym „automatically send Welcome Test” + emailem → ląduje na `/student/:id?tab=dslm&view=goals&...` → modal Add Goal otwiera się w ≤1 s.
- [ ] Add Student bez autosend (focus=send-welcome-test) → banner Welcome Test, modal Goals NIE otwiera się.
- [ ] Klik "Add goal" w Roadmap → modal otwiera się jak dotychczas.

---

## P3 — Usunięcie „🎯 Try Demo” z modala Log In

### Dependency scan
`src/pages/Login.tsx` (194–202) — sekcja `<button onClick={() => navigate('/demo')}>🎯 Try Demo — explore without signing up</button>`.

### Root cause
Element marketingowy odciągający od konwersji w modalu logowania.

### Selected solution
Usunąć blok `<div>` wraz z otaczającym `space-y-2` jeżeli to jedyne dziecko. Pozostawić CTA „Don't have an account? Get started”.

### Impact
- Route `/demo` istnieje nadal (`src/pages/DemoEntry.tsx`) — żaden link nie psuje się poza Login.
- Brak innych miejsc `Try Demo` w UI.

### Implementation
**Plik: `src/pages/Login.tsx`** — usunąć linie 194–202 (cały `<div>` z przyciskiem Try Demo). Zachować zewnętrzny `space-y-2` (lub uprościć do `space-y-0` skoro został tylko jeden link).

### Verification
- [ ] Modal Log In nie pokazuje „Try Demo”.
- [ ] Link „Get started” działa.
- [ ] Strona `/demo` nadal dostępna bezpośrednio.

---

## P4 — `https://edooqoo.com/blog/learning-pacing-scientific-vs-pragmatic-esl.html` → 404

### Dependency scan
- `public/blog/` zawiera 217 plików, ten slug nie istnieje (`ls | grep pacing` → 0).
- `public/sitemap.xml` nie zawiera tego slugu.
- Brak referencji w kodzie, docs i scriptach SEO.
- Index bloga (`public/blog/index.html`) jest prerenderowany ze SPA; nie ma tu kotwicy do tego slugu.

### Root cause
Plik nigdy nie był w obecnym repo. Możliwe że istniał w starszej rewizji (przed którąś czystką blog folderu) lub został opublikowany ręcznie poza systemem i utracony. **Nie mam dostępu do oryginalnej treści.** Nie istnieje też kopia w cache lokalnym sandboxa.

### UCZCIWA ODPOWIEDŹ DLA UŻYTKOWNIKA
Nie potrafię "odtworzyć bez wymyślania". Nie mam żadnego wewnętrznego źródła z tą konkretną treścią. Jeśli ważne jest zachowanie linka, mamy trzy realne opcje — pytanie do akceptacji **przed** implementacją:

| Opcja | Co robi | Plus | Minus |
|---|---|---|---|
| 4a. Napisać nowy artykuł od zera w stylu Edooqoo (~1 200 słów, sekcje: science of pacing, pragmatic 1:1 reality, decision framework, examples). | Plik istnieje, SEO odzyskane. | Treść nowa — nie "odtworzenie", ale spójna z marką. |
| 4b. 301 redirect → `teaching-english-one-to-one.html` lub `one-minute-prep-workflow-for-esl-tutors.html`. | Zero risk wymyślania. | Wymaga reguły hosting/Lovable (preview SPA fallback już zwraca 404 dla bezpośredniego HTML – realny redirect możliwy w `vite.config.ts` lub przez `public/_redirects` w Cloudflare/Netlify, na Lovable trzeba dodać `<meta http-equiv="refresh">` w nowym pliku HTML). |
| 4c. Pozostawić 404 i poprosić użytkownika o oryginał (np. z Wayback Machine). | Najczystsze. | Wymaga jego akcji. |

**Domyślnie rekomenduję 4b** z plikiem HTML zawierającym `<meta http-equiv="refresh" content="0; url=/blog/teaching-english-one-to-one.html">` + canonical do celu + minimalny komunikat „Moved”. Jest to zero-risk i odzyskuje link.

### Implementation (jeśli 4b zaakceptowane)
Utworzyć `public/blog/learning-pacing-scientific-vs-pragmatic-esl.html`:
```html
<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>Learning Pacing — Scientific vs Pragmatic ESL — Edooqoo</title>
<meta name="description" content="This post has moved. Read our updated guide on one-to-one English lesson pacing.">
<link rel="canonical" href="https://edooqoo.com/blog/teaching-english-one-to-one.html">
<meta http-equiv="refresh" content="0; url=/blog/teaching-english-one-to-one.html">
<meta name="robots" content="noindex, follow">
</head><body>
<p>This article moved to <a href="/blog/teaching-english-one-to-one.html">Teaching English One-to-One — Private Lesson Guide</a>.</p>
</body></html>
```

Jeżeli wybierzesz 4a — napisać pełny artykuł zgodny ze stylem `teaching-english-one-to-one.html` (~1 200 słów, schema.org BlogPosting, własna sekcja CTA do `/`). Mogę go wytworzyć, ale treść będzie nowa.

### Verification
- [ ] Klucz: `curl -I https://edooqoo.com/blog/learning-pacing-scientific-vs-pragmatic-esl.html` → 200 OK + `<meta refresh>`.
- [ ] Sitemap zostawiamy bez tego slugu (404 było bezpieczne; 301-meta lepsze).

---

## P5 — Daily audit email + brakujący „purpose” w `model_health_checks` + porządek z Daily/Monthly

### Dependency scan
- `supabase/functions/audit-llm-models/index.ts` — wysyła mail tylko gdy `mode==='monthly'`.
- `supabase/functions/send-model-audit-email/index.ts` — generyczny sender, subject hardcoded `Monthly LLM Audit`.
- Tabela `public.model_health_checks` — kolumny: `id, provider, model, status, latency_ms, ok, error, checked_at`. Brak `purpose`/`used_by`.
- Cron schedule — operatorski SQL (nie w repo). Aktualnie: codziennie `mode=daily` (zapis do DB, brak maila) + miesięcznie `mode=monthly` (zapis + mail).

### Root cause
1. **Brak Daily email** — autor pominął wysyłkę dla daily mode (świadomie, aby nie spamować). User chce go dostawać.
2. **Brak `purpose`** — `TARGETS_*` nie nosi info o tym, do czego model jest używany, więc wiersz tabeli jest „goły”.
3. **Naming Monthly vs Daily** — `[Edooqoo] Monthly LLM Audit` przychodzi raz w miesiącu z pełnego setu; daily zapisuje się tylko do tabeli. User chce wszystko jako daily i jasno opisane.

### Selected solution
1. Wysyłać email w **obu** trybach. Subject prefix z trybu (`Daily` / `Monthly`).
2. Dodać kolumnę `purpose TEXT` + (opcjonalnie) `used_by TEXT[]` przez migrację. Rozszerzyć `TARGETS_DAILY`/`TARGETS_MONTHLY` o pole `purpose` i zapisywać do DB. Dodać `purpose` w mailu (kolumna „Used for”).
3. Cron — pozostaw daily codziennie; monthly skasować (operator usuwa job z pg_cron — udokumentować). Alternatywnie zachować monthly jako „pełny przegląd” raz na miesiąc dodatkowo (subject „Monthly Full LLM Audit”).

Rekomenduję: **daily codziennie z pełnymi danymi + monthly opcjonalny full-set**. Daily używa `TARGETS_DAILY`, monthly `TARGETS_MONTHLY`. Oba wysyłają mail z odpowiednim subjectem.

### Impact
- Nowa migracja DB (`add purpose to model_health_checks`).
- Edge function `audit-llm-models` — Targets + DB insert + mail trigger.
- Edge function `send-model-audit-email` — parametryzowany subject (już bierze `summary` w body; subject zbuduje audit-llm-models).
- Resend już skonfigurowany (klucz `RESEND_API_KEY` istnieje, bo monthly maile chodzą).

### Implementation

**Migracja: `supabase/migrations/<ts>_audit_purpose.sql`**
```sql
alter table public.model_health_checks add column if not exists purpose text;
comment on column public.model_health_checks.purpose is 'Human-readable description of what this model powers in the app.';
create index if not exists idx_model_health_checks_purpose on public.model_health_checks (purpose);
-- No GRANT changes: table is service-role only (no PostgREST exposure).
```

**`supabase/functions/audit-llm-models/index.ts`** — kluczowe zmiany:

```ts
interface Target { provider: Provider; model: string; endpoint: string; purpose: string; }

const TARGETS_DAILY: Target[] = [
  { provider: "lovable-gateway", model: "google/gemini-2.5-flash",      endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
    purpose: "Primary worksheet generation (generateWorksheet, suggest-exercises)" },
  { provider: "lovable-gateway", model: "google/gemini-2.5-flash-lite", endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
    purpose: "Lightweight classification (classify-knowledge-entry, translate-flashcard)" },
  { provider: "openai",          model: "gpt-4o-mini",                  endpoint: "https://api.openai.com/v1/models/gpt-4o-mini",
    purpose: "OpenAI fallback for verify-open-answers, generate-curriculum-phases" },
  { provider: "openai",          model: "gpt-5-mini-2025-08-07",        endpoint: "https://api.openai.com/v1/models/gpt-5-mini-2025-08-07",
    purpose: "Direct OpenAI premium fallback (welcome-test scoring)" },
];

const TARGETS_MONTHLY: Target[] = [
  ...TARGETS_DAILY,
  { provider: "openai",          model: "gpt-4o-mini-tts",              endpoint: "https://api.openai.com/v1/models/gpt-4o-mini-tts",
    purpose: "TTS for generate-audio and welcome-test audio prompts" },
  { provider: "openai",          model: "gpt-4.1-2025-04-14",           endpoint: "https://api.openai.com/v1/models/gpt-4.1-2025-04-14",
    purpose: "Legacy reasoning fallback (kept for audit only)" },
  { provider: "lovable-gateway", model: "google/gemini-3-flash-preview", endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
    purpose: "Default chat/text model (per Lovable AI catalog)" },
];
```

Insert do DB:
```ts
await sb.from("model_health_checks").insert({
  provider: target.provider,
  model: target.model,
  status: r.status,
  latency_ms: r.latency_ms,
  ok,
  error: r.error,
  purpose: target.purpose,
});
```

Wysyłka maila ZAWSZE (poza pominięciem, gdyby `?mode=silent` w przyszłości). Przenieść blok email outside `if (mode === 'monthly')`:

```ts
// v6.9.37 — email in BOTH modes (daily + monthly). Subject reflects mode.
try {
  const okCount = results.filter(r => r.ok).length;
  const failedCount = results.length - okCount;
  const rows = results.map(r => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${r.provider}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;"><code>${r.model}</code></td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${(r as any).purpose || ''}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.status}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.latency_ms} ms</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:${r.ok ? '#16a34a' : '#dc2626'};">${r.ok ? 'OK' : 'FAIL'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280;">${(r.error || '').slice(0, 120)}</td>
    </tr>`).join("");
  const reportHtml = `
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <thead><tr style="background:#f3f4f6;">
        <th style="padding:6px 10px;text-align:left;">Provider</th>
        <th style="padding:6px 10px;text-align:left;">Model</th>
        <th style="padding:6px 10px;text-align:left;">Used for</th>
        <th style="padding:6px 10px;text-align:right;">HTTP</th>
        <th style="padding:6px 10px;text-align:right;">Latency</th>
        <th style="padding:6px 10px;text-align:left;">Status</th>
        <th style="padding:6px 10px;text-align:left;">Error</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  const emailPromise = fetch(`${url}/functions/v1/send-model-audit-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-call": expected || "" },
    body: JSON.stringify({
      reportHtml,
      summary: { total: results.length, ok: okCount, failed: failedCount },
      generatedAt: new Date().toISOString(),
      mode,                                  // <— NEW
    }),
  })
    .then(async (r) => console.log("[audit-llm-models] email dispatch status", r.status, (await r.text()).slice(0, 300)))
    .catch((e) => console.error("[audit-llm-models] email dispatch failed", e));
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(emailPromise);
  } else {
    await emailPromise;
  }
} catch (e) {
  console.error("[audit-llm-models] email build failed", e);
}
```

**`supabase/functions/send-model-audit-email/index.ts`** — przyjąć `mode`:

```ts
const { reportHtml, summary, generatedAt, mode } = await req.json();
...
const label = mode === 'monthly' ? 'Monthly LLM Audit' : 'Daily LLM Audit';
const subject = `[Edooqoo] ${label} — ${dateStr} — ${failed}/${total} failed`;
```

Deploy obu funkcji.

**Cron (operatorska akcja — udokumentować w komentarzu README/docs/operational/audit-llm-models-cron.md):**
- Daily (codziennie 06:00 UTC) — body `{}` → `mode=daily` → mail + DB.
- Monthly (1. dnia 06:30 UTC) — body `{"mode":"monthly"}` → full set.

### Verification
- [ ] Po deployu wywołać ręcznie z `mode=daily` przez `curl -H "x-cron-secret: <CRON_SECRET>" -X POST .../functions/v1/audit-llm-models` → mail `[Edooqoo] Daily LLM Audit — YYYY-MM-DD — N/M failed` na edooqoo@gmail.com.
- [ ] `SELECT purpose, count(*) FROM public.model_health_checks WHERE purpose IS NOT NULL GROUP BY 1;` — niezerowe.
- [ ] Mail zawiera kolumnę „Used for”.
- [ ] Stary monthly mail dalej działa jeśli pozostawiony w cronie.

---

## RAG injection — `docs/llm-context.md` i `public/llms.txt`

Wstawić sekcję v6.9.37:

```
v6.9.37 — Onboarding & Audit hardening

PROBLEM: 1-Minute Prep "Generate worksheet ↗" did not auto-start generation.
EDOOQOO SOLUTION: WorksheetForm now pins selectedStudentId from autoGenerateWorksheetRequest at mount (no longer waits for preSelectedStudent prop). Readiness gate logs each block reason; watchdog shortened to 5 s with force-submit fallback if topic+exercises present.
TECHNICAL MECHANICS: src/components/WorksheetForm/index.tsx (mount-effect, readiness gate, watchdog).
RAG KEYWORDS: auto-submit, 1-Minute Prep, NextStepBanner, autoGenerateWorksheet, autoGenerateWorksheetRequest, readiness gate, watchdog, requestSubmit, suggestion, prefill.

PROBLEM: Welcome-Test autosend navigated to DSLM Goals tab but Add-Goal modal never opened.
EDOOQOO SOLUTION: GoalsView now eager-mounts when focus=add-goal-modal; consume callback memoized with useCallback to avoid effect re-fires that consumed pendingAddGoal before child mount.
TECHNICAL MECHANICS: src/components/dslm/DSLMTab.tsx (goalsEagerMount, handleConsumePendingAddGoal), src/components/dslm/LazySection.tsx (eager prop usage), src/components/dslm/GoalsView.tsx.
RAG KEYWORDS: AddStudentDialog, welcome test autosend, DSLMTab focus param, pendingAddGoal, LazySection eager, GoalsView, add-goal-modal, IntersectionObserver, scrollIntoView, modal race.

PROBLEM: Login modal contained 🎯 Try Demo CTA pulling users out of the conversion funnel.
EDOOQOO SOLUTION: Removed Try Demo button from Login.tsx. /demo route still reachable directly.
TECHNICAL MECHANICS: src/pages/Login.tsx.
RAG KEYWORDS: Login modal, Try Demo, conversion, /demo route, GoogleSignInButton, signup CTA.

PROBLEM: /blog/learning-pacing-scientific-vs-pragmatic-esl.html returned 404 with no source in repo or sitemap.
EDOOQOO SOLUTION: Added meta-refresh redirect HTML pointing to teaching-english-one-to-one.html with rel=canonical and noindex.
TECHNICAL MECHANICS: public/blog/learning-pacing-scientific-vs-pragmatic-esl.html.
RAG KEYWORDS: blog 404, learning pacing, scientific vs pragmatic, meta refresh redirect, canonical, noindex, content recovery.

PROBLEM: Daily LLM health audit only wrote DB rows; no daily email; model_health_checks lacked "purpose"; Monthly email subject confused user about cadence.
EDOOQOO SOLUTION: audit-llm-models now sends email in both daily and monthly modes; subject prefixed by mode; purpose column added to model_health_checks with per-target description; mail table gained "Used for" column.
TECHNICAL MECHANICS: supabase/functions/audit-llm-models/index.ts (TARGETS_*.purpose), supabase/functions/send-model-audit-email/index.ts (mode-aware subject), migration adding purpose text column.
RAG KEYWORDS: audit-llm-models, model_health_checks, purpose, daily audit, monthly audit, send-model-audit-email, Resend, CRON_SECRET, pg_cron, LLM monitoring.
```

`llms.txt` — dodać do Changelog: `v6.9.37 — auto-submit hard-fix, add-goal modal eager mount, login Try-Demo removed, blog 404 redirect, daily LLM audit email + purpose column.`

`mem/index.md` — dodać entry `[v6.9.37 fixes](mem://features/onboarding/v6937-autosubmit-and-audit) — auto-submit, add-goal modal, audit email, blog redirect, login cleanup`.

`mem/features/onboarding/v6937-autosubmit-and-audit.md` — nowy plik z opisem.

---

## Final change report (po implementacji)

Pliki do utworzenia:
- `public/blog/learning-pacing-scientific-vs-pragmatic-esl.html` (redirect HTML)
- `supabase/migrations/<ts>_add_purpose_to_model_health_checks.sql`
- `mem/features/onboarding/v6937-autosubmit-and-audit.md`

Pliki do modyfikacji:
- `src/components/WorksheetForm/index.tsx`
- `src/components/dslm/DSLMTab.tsx`
- `src/pages/Login.tsx`
- `supabase/functions/audit-llm-models/index.ts`
- `supabase/functions/send-model-audit-email/index.ts`
- `docs/llm-context.md`
- `public/llms.txt`
- `mem/index.md`

Deploy edge functions: `audit-llm-models`, `send-model-audit-email`.

Out-of-scope (do następnej tury):
- Pełny artykuł blogowy o pacing (opcja 4a) — wymaga decyzji.
- Audit retention policy w `model_health_checks` (puchnie codziennie).

---

**Decyzja wymagana przed buildem:**
1. **P4** — wybierasz 4a (nowy artykuł napisany przeze mnie), 4b (meta-refresh redirect, rekomendowane), czy 4c (zostaw 404)?
2. **P5 cron** — usuwam monthly i robię tylko daily, czy zostawiam oba (daily + monthly full)?

Reszta (P1, P2, P3, P5 kod + migracja) gotowe do implementacji od ręki.
