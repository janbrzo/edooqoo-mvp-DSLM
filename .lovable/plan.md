# Plan v6.9.29 (rev 4) — Final — Welcome Test + UX + zamknięcie monitoringu modeli

Status diagnozy: **smoke-test OK, cron `audit-llm-models-daily` zapisany w bazie (jobid=10), tabela `model_health_checks` zasilona 8 wierszami**. Pozostają dwie sprawy do dokończenia w monitoringu (sekcja 0) plus pełna lista 8 problemów funkcjonalnych (sekcje 1–9). Plan jest addytywny — sanctity worksheet engine i scoring Welcome Test pozostają nietknięte.

---

## 0. Monitoring modeli — stan po Twoich testach + co jeszcze trzeba

### 0.1 Co już DZIAŁA (potwierdzone w bazie, nic nie ruszamy)

- Cron `audit-llm-models-daily` istnieje (jobid=10, schedule `0 6 * * *`, active=true). Codziennie 06:00 UTC pinguje 4 modele i wpisuje wynik do `model_health_checks`.
- Edge function `audit-llm-models` autoryzuje przez `x-cron-secret` (sprawdzone — 401 dla literału, 200 dla prawdziwej wartości).
- Tabela `model_health_checks` ma 8 wierszy z dwóch przebiegów (smoke-test + cron-once-now). Logger Poziom 3 działa.

### 0.2 Co WYKRYŁY testy i wymaga naprawy w kodzie

**PROBLEM (widoczny w Twoich wynikach):** `openai/gpt-5-mini` przez Lovable Gateway zwraca **HTTP 400 — `"Unsupported parameter: max_tokens"**`. To **false positive** w audycie (model żyje, tylko parametr się zmienił dla rodziny GPT-5 → musi być `max_completion_tokens`).

**Fix w `supabase/functions/audit-llm-models/index.ts**` (funkcja `ping`, gałąź Lovable Gateway): rozróżnij body po rodzinie modelu:

```ts
const isGpt5Family = target.model.startsWith("openai/gpt-5");
const body = isGpt5Family
  ? { model: target.model, messages: [{ role: "user", content: "ping" }], max_completion_tokens: 1 }
  : { model: target.model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 };
```

Po wdrożeniu kolejny przebieg cron-once-now wykaże `ok=true` dla `openai/gpt-5-mini`. Bez tej poprawki audyt codziennie generuje fałszywy alarm w `error_logs` przez `logModelFailure` (4xx > 400 nie loguje, ale w przyszłości łatwo o false-positive).

### 0.3 Co dorabiamy: tryb miesięczny + e-mail do `edooqoo@gmail.com`

**A) Rozszerzenie `audit-llm-models/index.ts`:**

- Czytaj `{ mode?: "daily" | "monthly" }` z body (default `"daily"`).
- `TARGETS_DAILY` = obecne 4 (po fixie z 0.2).
- `TARGETS_MONTHLY` = pełna lista hardkodowana w pliku, wygenerowana z `LLM_MODEL_INVENTORY.md`. Każdy wpis: `{ provider, model, endpoint, family }` żeby `ping` wybrał właściwe body. Komentarz: "When adding a new model anywhere, append it here — see LLM_MODEL_INVENTORY.md".
- Po przebiegu, jeśli `mode === "monthly"`: zbuduj HTML (tabela: provider, model, status, latency, ok, error skrót) + summary `{ total, ok, failed }` → fire-and-forget POST do `send-model-audit-email`.

**B) Nowa funkcja `supabase/functions/send-model-audit-email/index.ts`:**

- `verify_jwt = false` w `config.toml`. In-code: wymaga headera `x-internal-call == CRON_SECRET`.
- Body: `{ reportHtml, summary, generatedAt }`.
- Wysyłka przez Resend (connector gateway, wzorzec z `<resend>` w kontekście):
  - `To`: `edooqoo@gmail.com`
  - `From`: domyślnie `Edooqoo Monitoring <onboarding@resend.dev>` (bezpieczny fallback). Jeśli `email_domain--list_email_domains` pokaże zweryfikowane `edooqoo.com` → `Edooqoo Monitoring <audits@edooqoo.com>` (zweryfikuję przed implementacją).
  - `Subject`: `[Edooqoo] Monthly LLM Audit — YYYY-MM-DD — {failed}/{total} failed`
  - HTML: nagłówek summary + tabela.

**C) Cron miesięczny (Krok D — DO WYKONANIA PRZEZ CIEBIE po implementacji):**

```sql
select cron.schedule(
  'audit-llm-models-monthly',
  '0 7 1 * *',                      -- 07:00 UTC, pierwszy dzień miesiąca
  $$
  select net.http_post(
    url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','TUTAJ_REALNA_WARTOSC_CRON_SECRET'),
    body    := '{"mode":"monthly"}'::jsonb
  );
  $$
);
```

Plus jednorazowy test (`audit-llm-models-monthly-once-now` analogicznie do Kroku E) żeby zweryfikować że mail przyjdzie bez czekania miesiąca.

### 0.4 Logger Poziom 2 — sweep + smoke-test

**Stan obecny:** `logModelFailure` istnieje w `_shared/modelFailureLogger.ts` i jest wpięty w 10 z 12 funkcji LLM. Brakuje go w `generateWorksheet/**` i `generate-media-exercises/index.ts`. **Świadoma Twoja decyzja (poprzednie wiadomości):** wpinamy go tam mimo Sanctity Rule — TYLKO opakowanie istniejących `fetch` w obserwację `if (!r.ok && (r.status===404||r.status===410||r.status>=500)) await logModelFailure({...})`. ZERO zmian w promptach, parametrach, parsowaniu, scoringu.

**Smoke-test loggera (jednorazowy):** nowa funkcja `supabase/functions/test-model-failure-logger/index.ts` (`verify_jwt=false`, in-code `x-cron-secret`). Po wdrożeniu Lovable AI sam ją wywoła przez `supabase--curl_edge_functions`, zweryfikuje wiersz w `error_logs` (source_name=`test-model-failure-logger`) i go usunie. Funkcja zostaje w repo jako debug tool.

### 0.5 Dokumentacja operacyjna

`**docs/operational/audit-llm-models-cron.md**` — przepisany na podstawie tego co już zadziałało:

- **Pogrubione ostrzeżenie** na górze: "NIGDY nie wklejaj literalnie `WKLEJ_TUTAJ_SECRET`. Najpierw skopiuj wartość `CRON_SECRET` z Lovable Cloud → Settings → Secrets."
- Sekcje: Pobranie sekretu → Smoke-test przez `pg_net` (nie curl, bo curl wymaga terminala) → `cron.schedule('audit-llm-models-daily', ...)` → `cron.schedule('audit-llm-models-monthly', ...)` → weryfikacja `cron.job` + `cron.job_run_details` + `model_health_checks` → procedura proaktywnego testu przez `'* * * * *'`+unschedule.

---

## 1. Welcome Test → Auto-apply do Progress

### 1.1 Tło (Twoje pytanie z poprzedniej iteracji)

Dwie OSOBNE ścieżki danych z testu:

- `**student_events**` — timeline aktywności, zasilane automatycznie podczas testu, nie wymaga akcji.
- `**student_learning_elements.current_rating**` — mastery score per nano-skill, napędza DSLM (sugestie, roadmapę). DZISIAJ powstaje przez kliknięcie "Apply Results to Progress": `process-welcome-test` liczy `suggested_rating` → zapisuje do `test_skill_results` → nauczyciel klika → kopiowanie do `student_learning_elements.current_rating`. **Bez kliknięcia DSLM ma stare dane.**

**Auto-apply = ten drugi krok wykonujemy automatycznie wewnątrz `process-welcome-test`.**

### 1.2 Wycofujemy "Re-apply"

Pojęcie niejasne. Retake = nowy test = nowy auto-apply.

- **Sukces auto-apply** (status `reviewed`): zielony statyczny chip "✓ Results automatically applied to student's skill ratings."
- **Fallback** (auto-apply padł, status pozostał `completed`): żółta karta + przycisk **"Apply to Progress"** (jednorazowy retry, wywołuje istniejący `applyResultsToProgress` z `useStudentTests.tsx`, którego NIE usuwamy).

### 1.3 Implementacja

**A) `supabase/functions/process-welcome-test/index.ts**` — po istniejącym `UPDATE student_tests SET status='completed'` dopisujemy:

```ts
try {
  const { data: skillResults } = await sb
    .from('test_skill_results')
    .select('id, applied_to_element_id, suggested_rating')
    .eq('student_test_id', testId)
    .is('applied_at', null);

  if (skillResults?.length) {
    for (const r of skillResults) {
      if (r.applied_to_element_id && r.suggested_rating != null) {
        await sb.from('student_learning_elements')
          .update({ current_rating: r.suggested_rating, last_rated_at: new Date().toISOString() })
          .eq('id', r.applied_to_element_id);
      }
    }
    await sb.from('test_skill_results')
      .update({ applied_at: new Date().toISOString() })
      .in('id', skillResults.map(r => r.id));

    await sb.from('student_tests')
      .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
      .eq('id', testId);
  }
} catch (autoApplyErr) {
  await sb.from('error_logs').insert({
    severity: 'warning', source: 'edge-function', source_name: 'process-welcome-test',
    component: 'welcome-test-auto-apply', error_code: 'welcome_auto_apply_failed',
    message: `auto-apply failed for test ${testId}`,
    context: { testId, error: String(autoApplyErr).slice(0, 500) },
  });
  // NIE rollback completed → fallback UI pozwoli ręcznie retry
}
```

**B) `src/components/student-tests/TestDetailsView.tsx` (linie 326–342)** — podmiana bloku Apply Results na chip+fallback (kod w sekcji 2.3 rev 3 — bez zmian).

**C) `useStudentTests.tsx**` — `applyResultsToProgress` bez zmian (używany przez fallback i retake).

### 1.4 Co się NIE zmienia

Algorytm scoringu w `process-welcome-test`, `student_events`, retake flow, DSLM logic.

---

## 2. Brakujące tłumaczenia w Welcome Test

Rozszerzamy `src/data/welcomeTestTranslations.ts` o ID profilujące (psychology/scenarios/communication) z `welcomeTestQuestions.ts` linie 512–869, w 10 językach: pl, es, fr, de, it, pt, ru, uk, tr, zh.

Lista 21 ID: `wt_q18, wt_q19, wt_q20, wt_q21, wt_q22, wt_q23, wt_q24, wt_q25, wt_q26, wt_q27, wt_q28, wt_q29, wt_q30, wt_q31, wt_q32, wt_q33, wt_q34, wt_q35, wt_q37, wt_q38, wt_q39`.

Pytania gramatyka/vocabulary pozostają po angielsku (testują znajomość angielskiego). Renderer ma fallback EN — brak tłumaczenia nie wywala UI.

---

## 3. "Stupid game" w pauzie Welcome Test (Memory Pairs)

Nowy komponent `src/components/welcome-test/BrainResetGame.tsx`:

- Memory Pairs 2×3 (6 kart, 3 pary emoji: 🐶🐱🦊).
- Pure React `useState`, zero deps.
- Klik → odsłoń, dwie odsłonięte → match albo zakryj po 800 ms. Po 3 parach: "Nice reset! Continue."

Integracja w `src/pages/WelcomeTestPage.tsx` w stage `paused`, schowane pod `<details>`:

```tsx
<details className="text-left max-w-sm mx-auto">
  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground py-2">
    🎮 Play a stupid game to reset your mind (optional)
  </summary>
  <BrainResetGame />
</details>
```

Zero wpływu na timer/scoring/sesję.

---

## 4. Email do studenta po ukończeniu Welcome Testu

### 4.1 Treść (bez obietnicy czasu)

- Subject: `Thanks for completing your Welcome Test, {studentName}!`
- Body:
  > Hi {studentName},
  >
  > You've finished your Welcome Test — great job.
  >
  > Your teacher {teacherName} will review your results and reach out to plan your next steps. In the meantime, no action needed.
  >
  > — Edooqoo
- `Reply-To`: `{teacherEmail}`.

### 4.2 Mechanizm

**A) Migracja:** `ALTER TABLE public.student_tests ADD COLUMN IF NOT EXISTS completion_email_sent_at TIMESTAMPTZ;`

**B) Edge function `supabase/functions/send-welcome-test-completion-email/index.ts`:**

- `verify_jwt=false`, in-code wymaga `Authorization: Bearer <SERVICE_ROLE_KEY>`.
- Body: `{ testId, studentEmail, studentName, teacherName, teacherEmail }`.
- Idempotencja: jeśli `student_tests.completion_email_sent_at` nie null → `{ skipped: true }`.
- Resend przez connector gateway (wzorzec `<resend>`). `From` jak w 0.3.B (fallback `onboarding@resend.dev`).
- Po sukcesie: `UPDATE student_tests SET completion_email_sent_at = now()`.
- Po porażce: `error_logs` z `error_code='welcome_test_email_failed'`.

**C) Szablon:** `supabase/functions/_shared/emailTemplates/welcomeTestCompletion.ts` (`renderWelcomeTestCompletionEmail({ studentName, teacherName })`).

**D) Wywołanie w `process-welcome-test/index.ts**` po auto-apply, fire-and-forget:

```ts
if (student?.email) {
  fetch(`${SUPABASE_URL}/functions/v1/send-welcome-test-completion-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ testId, studentEmail: student.email, studentName, teacherName, teacherEmail })
  }).catch(e => console.error('thank-you email send failed', e));
}
```

**E) `supabase/config.toml`:** dodać `verify_jwt = false` dla `send-welcome-test-completion-email`, `send-model-audit-email`, `test-model-failure-logger`.

---

## 5. "Add Goal" modal nie otwiera się z Roadmap

**Root cause:** `dispatchAddGoal` w `MacroTimeline.tsx:104` emituje `CustomEvent('dslm:addGoal')` — nikt nie nasłuchuje.

**Fix:**

**A) `src/components/dslm/DSLMTab.tsx**` — dodać:

```tsx
const [pendingAddGoal, setPendingAddGoal] = useState(false);
useEffect(() => {
  const handler = () => { setActiveSubTab('goals'); setPendingAddGoal(true); };
  window.addEventListener('dslm:addGoal', handler);
  return () => window.removeEventListener('dslm:addGoal', handler);
}, []);
// render: <GoalsView ... pendingAddGoal={pendingAddGoal} onConsumePendingAddGoal={() => setPendingAddGoal(false)} />
```

(Przed implementacją sprawdzić czy nazwa subtaba to 'goals' czy 'Goals' w bieżącym kodzie.)

**B) `src/components/dslm/GoalsView.tsx**` — dodać props i efekt:

```tsx
interface Props { /* ... */ pendingAddGoal?: boolean; onConsumePendingAddGoal?: () => void; }
useEffect(() => {
  if (pendingAddGoal) { setShowAddGoal(true); onConsumePendingAddGoal?.(); }
}, [pendingAddGoal]);
```

**C) Walidacja:** klik "Add goal" z Pathway → tab Goals + modal. Klik "Add goal first" w AlertDialog → to samo.

---

## 6. Pusty Dashboard po zalogowaniu (wymaga F5)

**Root cause potwierdzony auth-logs (sekcja `<auth-logs>` z 28 wpisami 403 `bad_jwt`):** po logowaniu wiele równoległych requestów `/user` leci ze starym/pustym tokenem — sub claim nie jest jeszcze ustawiony w cache TanStack Query. `useAuthUser` ma `staleTime: Infinity`, więc nigdy się nie odświeża sam.

**Fix w `src/hooks/useAuthFlow.tsx`:**

```ts
import { useQueryClient } from '@tanstack/react-query';
const queryClient = useQueryClient();

// w onAuthStateChange callback, po setLoading(false):
queryClient.setQueryData(['auth-user'], session?.user ?? null);

// w getSession().then(...), po setLoading(false):
queryClient.setQueryData(['auth-user'], session?.user ?? null);
```

`setQueryData` (nie `invalidateQueries`) — natychmiastowy zapis do cache, bez round-tripa. `useStudents` widzi `teacherId` od razu → query enabled → dashboard renderuje studentów bez F5.

**Test:** logout → login → dashboard pełny bez odświeżania.

---

## 7. Onboarding zasłania Bug Button + tło

**Problem:** `OnboardingChecklist.tsx:89` → `fixed bottom-6 left-6 z-[70]`. `BugReportButton.tsx:36` → `fixed bottom-4 left-16 z-40`. Kolizja w bottom-left, onboarding z wyższym z-index zasłania FAB i podświetla się przezroczystym tłem.

**Fix:**

- `OnboardingChecklist.tsx:89` → `fixed bottom-6 right-6 z-30 ...`. Po wdrożeniu sprawdzić w preview czy w prawym-dolnym nie ma innego FAB; jeśli tak → `bottom-24 right-6`.
- Z-index `z-[70]` → `z-30` (pod FAB-ami `z-40`, nad treścią `z-10`, pod modalami `z-50`).
- Karta: `max-w-sm bg-card/95 backdrop-blur` żeby nie była przezroczysta.

---

## 8. Dokumentacja & memory (RAG injection)

### 8.1 `docs/llm-context.md`

Nowa sekcja v6.9.29 na początku, dla każdego z 8 problemów format:

- **Problem:** opis kontekstu i co zawodziło
- **Edooqoo.com Solution:** co dokładnie wdrożone
- **Technical Mechanics:** pliki, funkcje, tabele, eventy, kontrakty
- **RAG Keywords:** synonimy i terminy nauczycielskie

### 8.2 `llms.txt`

2–3 linijki summary v6.9.29: monitoring monthly+email, welcome test auto-apply+email+game+i18n, DSLM event listener, auth cache sync, onboarding positioning.

### 8.3 Nowe pliki memory

1. `mem/features/welcome-test/auto-apply-results.md` — process-welcome-test auto-stosuje skill ratings; UI: chip `reviewed` lub fallback przy `completed`; brak Re-apply.
2. `mem/features/welcome-test/student-completion-email.md` — kontrakt funkcji, idempotencja przez `completion_email_sent_at`, treść bez obietnicy czasu, reply-to do nauczyciela.
3. `mem/features/welcome-test/brain-reset-game.md` — minigame w `paused`, schowana w `<details>`, zero deps.
4. `mem/features/dslm/add-goal-event-listener.md` — kontrakt `window event 'dslm:addGoal'` konsumowany w `DSLMTab.tsx`.
5. `mem/features/auth/query-cache-sync.md` — `useAuthFlow` MUSI wywoływać `queryClient.setQueryData(['auth-user'], user)`.
6. `mem/features/onboarding/positioning.md` — `bottom-6 right-6 z-30`, nigdy kolizja z FAB (z-40).
7. **UPDATE** `mem/infrastructure/model-health-monitoring.md` — dopisać: tryb monthly + email; full logger sweep (12/12); smoke-test loggera; ostrzeżenie o literałach w smoke-teście; **uwaga o GPT-5 family wymagającym `max_completion_tokens**`.

`mem/index.md` — dorzucić linki do 6 nowych + odnotować update istniejącego.

### 8.4 `docs/operational/audit-llm-models-cron.md`

Przepisany w/g 0.5.

---

## 9. Kolejność implementacji (atomowa, deterministyczna)

1. **Migracja:** `ALTER TABLE student_tests ADD COLUMN completion_email_sent_at TIMESTAMPTZ`.
2. `**_shared/emailTemplates/welcomeTestCompletion.ts**` — szablon HTML.
3. **Edge function `send-welcome-test-completion-email**` + `config.toml`.
4. **Edge function `process-welcome-test**` — auto-apply + fire-and-forget email.
5. `**TestDetailsView.tsx**` — chip `reviewed` + fallback `completed`.
6. `**welcomeTestTranslations.ts**` — 21 ID × 10 języków.
7. `**BrainResetGame.tsx**` — nowy komponent.
8. `**WelcomeTestPage.tsx**` — integracja gry w `paused`.
9. `**DSLMTab.tsx` + `GoalsView.tsx**` — event listener + `pendingAddGoal`.
10. `**useAuthFlow.tsx**` — `queryClient.setQueryData(['auth-user'], user)`.
11. `**OnboardingChecklist.tsx**` — `right-6 z-30 bg-card/95`.
12. **Logger sweep** — `logModelFailure` w `generateWorksheet/**` (każdy plik z `fetch`) i `generate-media-exercises/index.ts`.
13. `**audit-llm-models/index.ts**` — fix gpt-5 (`max_completion_tokens`) + `mode` + `TARGETS_MONTHLY` + wywołanie email.
14. **Edge function `send-model-audit-email**` + `config.toml`.
15. **Edge function `test-model-failure-logger**` + `config.toml`.
16. **Docs:** `llm-context.md`, `llms.txt`, 6 nowych + 1 update memory + `mem/index.md` + `docs/operational/audit-llm-models-cron.md`.

---

## 10. Walidacja po implementacji (Lovable AI wykonuje sam)

1. `supabase--curl_edge_functions audit-llm-models` z `x-cron-secret` → status 200, `gpt-5-mini` ma teraz `ok=true`.
2. `supabase--curl_edge_functions audit-llm-models` z body `{"mode":"monthly"}` → mail przyszedł (Ty potwierdzasz odbiór).
3. `supabase--curl_edge_functions test-model-failure-logger` → wiersz w `error_logs` → usunąć.
4. Auth refresh: logout → login → dashboard bez F5.
5. Welcome Test E2E: mail + `student_learning_elements.current_rating` zaktualizowane + zielony chip.
6. Add goal: klik "Add goal" w Roadmap → tab Goals + modal.
7. Pause game: wstrzymaj test → rozwiń "🎮 Play a stupid game" → działa.
8. Translations: PL w Welcome Test → scenarios/communication po polsku.
9. Onboarding: prawy dolny, nie zasłania FAB.

---

## 11. Akcje OPERATORA (Ty, PO implementacji)

W SQL Editorze, z REALNYM `CRON_SECRET` (jak w Twoim sukcesie z Krok B/C):

**Krok D — miesięczny cron:**

```sql
select cron.schedule(
  'audit-llm-models-monthly',
  '0 7 1 * *',
  $$
  select net.http_post(
    url     := 'https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<TWOJA_WARTOSC_CRON_SECRET>'),
    body    := '{"mode":"monthly"}'::jsonb
  );
  $$
);
```

**Krok F — jednorazowy test maila miesięcznego (analogicznie do Twojego Kroku E):**

```sql
select cron.schedule('audit-llm-models-monthly-once-now', '* * * * *', $$ <ten sam http_post co wyżej> $$);
-- poczekaj 60-90 sekund, sprawdź skrzynkę edooqoo@gmail.com
select cron.unschedule('audit-llm-models-monthly-once-now');
```

To wszystko — żadnych innych ręcznych SQL po Twojej stronie.

---

## 12. Ryzyka i guard-rails

- **Sanctity Worksheet Engine:** tylko `logModelFailure` w catch — ZERO zmian merytorycznych.
- **Codex-owned files** (`mem/decisions/reconciliation-v6926-codex.md`): nieruszane.
- **Welcome Test scoring:** auto-apply działa na wynikach, nie modyfikuje algorytmu.
- **Auto-apply fail-safe:** błąd NIE rollbackuje `completed`, fallback UI pozwala retry.
- **Email idempotency:** `completion_email_sent_at` blokuje duplikaty.
- **Translations:** brak tłumaczenia → fallback EN, UI się nie wywala.
- **Audit GPT-5 fix:** rozróżnienie body po `target.model.startsWith('openai/gpt-5')` — backwards-compatible dla pozostałych modeli.
- **Cron docs:** explicite ostrzeżenie przed literałami w smoke-teście (Twój 401 to przekonał).