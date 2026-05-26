
# Plan v6.9.27 — Welcome Test repair + H4 weryfikacja + H5/H6/H8 + reconciliation v6.9.26

Plan łączy: (NOWE) naprawę błędów Welcome Test, (PUNKT 2) weryfikację H1–H4, (PUNKT 3) przyjęcie do wiadomości v6.9.26 z Codex + uzupełnienie RAG, oraz pełną kontynuację H5/H6/H8 z poprzedniego planu (bez skracania).

Sanctity rule: nie ruszamy `generateWorksheet` promptu ani logiki tokenów/płatności.

---

## NOWE — Welcome Test repair (P0)

### Root cause (potwierdzone w bazie)
W `student_tests` dla studenta `f1383aac…1d1` istnieją 2 wiersze:
- `fda2b76a…` — attempt 1, `status=completed`, `answered_count=58`, completed 18:41:18
- `19e9cd52…` — attempt 1, `status=assigned`, `answered_count=0`, utworzony 18:42:33 (POZNIEJ niż completed)

Duplikat powstał przez **race condition** w `src/components/dashboard/WelcomeTestSuggestion.tsx`:
1. `checkWelcomeTest()` jest async i ustawia `testId/shareUrl` w state.
2. Jeżeli nauczyciel kliknie którykolwiek przycisk (Copy/Send/Preview/Refresh Link) **zanim** stan zostanie wypełniony, `ensureWelcomeTest()` widzi `testId == null` i tworzy nowy wiersz `student_tests` z nowymi pytaniami i tokenem.
3. Po stronie listy `tests` (w `StudentTestsTab`) `tests.find(t => t.test_type==='welcome')` zwraca latest (pusty), więc:
   - banner pokazuje „Welcome (placement) Test sent / Waiting for student",
   - `panelState` jest `pending`, więc `View Results` jest disabled,
   - `TestDetailsView` pokazuje AI Analysis (bo to globalny rekord `student_learning_profiles` per student), ale `0/58 Answered` (bo to liczba na konkretnym pustym teście).

Dodatkowo `process-welcome-test` aktualizuje tylko `answered_count`, a `status='completed' + completed_at` zależy w pełni od RPC `calculate_test_results`. Jeśli RPC zawiedzie cicho → status zostaje `in_progress`/`assigned`.

### Fix WT-1 — Twarda ochrona przed duplikatami w `useStudentTests.createTest`
W `src/hooks/useStudentTests.tsx` przed `INSERT` dla `test_type='welcome'` zrobić atomic guard:
```ts
const { data: existing } = await supabase
  .from('student_tests')
  .select('id, share_token, status, attempt_number')
  .eq('student_id', testData.student_id)
  .eq('teacher_id', teacherId)
  .eq('test_type','welcome')
  .is('deleted_at', null)
  .order('attempt_number', { ascending: false })
  .order('created_at', { ascending: false })
  .limit(1);
const last = existing?.[0];
const isRetake = testData.previous_attempt_id != null;
if (last && !isRetake) return last as any;   // idempotent — zwróć istniejący
```
Dzięki temu `ensureWelcomeTest` w obu miejscach (WelcomeTestSuggestion + StudentTestsTab + useWelcomeTestActions) staje się idempotentny niezależnie od race conditions w state React.

### Fix WT-2 — `WelcomeTestSuggestion.tsx`: blokada akcji do końca `checkWelcomeTest`
- Dodać `checking: boolean` (init `true`, false po `checkWelcomeTest` finally).
- `WelcomeTestActionsPanel` dostaje `sending={creating || checking}` aby przyciski były neutralizowane do czasu fetcha.
- W `ensureWelcomeTest()` jeżeli `checking===true` → `await` jednorazowego `checkPromiseRef.current` zanim cokolwiek robi.

### Fix WT-3 — Wybór „aktywnego" welcomeTest preferuje completed
W `StudentTestsTab.tsx` (linia 37) i w hookach gdzie wybieramy 1 welcome test:
```ts
const welcomeTest = useMemo(() => {
  const ws = tests.filter(t => t.test_type==='welcome');
  return ws.find(t => t.status==='completed' || t.status==='reviewed')
      ?? ws.find(t => t.status==='in_progress')
      ?? ws[0];
}, [tests]);
```
Analogicznie w `WelcomeTestSuggestion.checkWelcomeTest` zmienić zapytanie:
```ts
.order('status',{ascending:true})  // 'completed' < 'in_progress' < 'pending' alfa? — zamiast tego osobne 2 query
```
Bezpieczniej: jedno query `select(...)` bez `limit(1)`, w JS wybrać completed > in_progress > assigned > pending (najnowsze w obrębie kategorii).

### Fix WT-4 — `process-welcome-test` jawnie ustawia completed
W `supabase/functions/process-welcome-test/index.ts` po `upsert profileData` (linia ~603) i przed notyfikacją dodać:
```ts
await supabase.from('student_tests').update({
  status: 'completed',
  completed_at: new Date().toISOString(),
  answered_count: answered_count ?? undefined,
}).eq('id', test_id).neq('status','reviewed');
```
Niezależnie od `calculate_test_results` RPC.

### Fix WT-5 — Migration: dedupe + soft-delete starych pustych duplikatów
Nowa migracja:
1. Soft-delete: dla każdej pary (student_id, teacher_id, test_type='welcome', attempt_number) jeśli istnieje `status='completed'` → wszystkie inne wiersze z `answered_count=0 AND status IN ('assigned','pending')` ustaw `deleted_at=now()`.
2. Dodać partial unique index: `CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_welcome_attempt ON student_tests (student_id, teacher_id, test_type, attempt_number) WHERE deleted_at IS NULL;` — gwarantuje, że nigdy nie powstanie drugi wiersz tego samego attemptu.

### Fix WT-6 — UI guard „Compare attempts"
W `StudentTestsTab` pokazuj `Compare (N)` tylko gdy `tests.filter(welcome && status in [completed, reviewed]).length >= 2`. Inaczej ukryj — to usunie wprowadzający w błąd licznik „2 tests" przy 1 ukończeniu.

### Fix WT-7 — `View Results` enable
`WelcomeTestActionsPanel` ma `onViewResults` zależne od `panelState==='completed'`. Po WT-3 banner będzie odnosił się do completed → przycisk się aktywuje. Dodatkowo: jeżeli istnieje JAKIKOLWIEK welcome test z `status=completed` dla studenta, `View Results` ma być zawsze klikalny (route `/student/:id?tab=tests&testId=<completedId>`).

### Akceptacja
- Otworzyć profil Johny Bravo → banner pokazuje „Completed", `View Results` klikalne.
- Tab Tests → lista 1 attempt (ten completed). Drugi (pusty) ukryty (soft-deleted).
- Re-send Email z bannera nie tworzy nowego wiersza (idempotent).

---

## PUNKT 2 — Weryfikacja H1–H4

H1 (SEO sitemap fix), H2 (sygnały pSEO), H3 (canonical/hreflang) — wdrożone w v6.9.21–v6.9.26 (Codex). Weryfikacja w ramach reconciliation (RAG niżej).

H4 — Signup return-to:
- Zweryfikować przez `rg "to=\"/signup\"|to='/signup'|navigate\\(['\"]/signup"` że KAŻDY callsite ma `state={{from:...}}`. Lista 25 plików z planu v6.9.24 została zaktualizowana — sprawdzić po build: nie powinno być warningów TS dotyczących brakujących propsów `state` w `FeatureCTA`, `FeatureHero`.
- Naprawa odkryć: jeśli w `Prompts.tsx`, `Resources.tsx`, `BookLandingPage.tsx`, `StudentHubLanding.tsx` (jeśli linkuje do /signup) brakuje state — uzupełnić używając `useSignupLinkState()`.
- Dodać visible „Back" CTA w `Signup.tsx` i `Login.tsx` (jeśli `fromPath !== '/'`) — `<Button variant="ghost" size="sm" onClick={()=>navigate(fromPath)} className="absolute left-4 top-4"><ArrowLeft/> Back</Button>`. Sprawdzić, że ten przycisk jest, a nie tylko logika redirect po sukcesie.
- Test: z `/gallery/<slug>` → klik „Sign up free" → modal/strona /signup → klik Back → wraca na ten sam slug. Z `/pricing`, `/blog`, `/tools/cefr-level-test` analogicznie.

---

## PUNKT 3 — Reconciliation v6.9.26 (Codex)

Codex zmergował PR #4: naprawa undefined w JSON-LD claim-integrity, BusyTeacher → neutralny framework, hreflang=x-default, claim scan w audit. **Nie powielamy** — tylko upewniamy się, że nasze wdrożenia H4+ nie regresują tych plików:
- nie modyfikujemy `scripts/seo/generate-citable-pages.mjs`, `scripts/seo/audit-seo-assets.mjs`, `src/components/seo/PageSeo.tsx`, `src/constants/seoMeta.ts`, `src/constants/faqItems.ts`, `src/pages/HowItWorks.tsx`, `src/pages/seo/*`, `public/*-vs-*.html`, `public/blog/*.html`,
- WYJĄTEK: w sweepie H4 dodajemy WYŁĄCZNIE `state={...}` do istniejących `<Link to="/signup">` — to nie koliduje z claim-integrity.
- Zaktualizować RAG z notką, że v6.9.26 jest stabilna i nie powtarzamy jej w v6.9.27.

---

## H5 — SSE keepalive + silent retry (z v6.9.24, pełna treść)

**Problem:** Stream worksheet generation gubi się przy długich pauzach modelu (>40s), bo nie ma heartbeatu po stronie serwera, a klient aborten natychmiast po watchdogu.

### H5.1 Server keepalive
W `supabase/functions/generateWorksheet/streaming.ts` (lub odpowiedniku, sprawdzić ścieżkę przy implementacji) dodać interval co 15s emitujący komentarz SSE `: keepalive\n\n`, czyszczony w `finally` po zakończeniu generacji. Komentarze SSE nie są parsowane jako event, ale RESETUJĄ heartbeat klienta.

### H5.2 Client watchdog 45s + silent retry
W `src/services/worksheetStreamService.ts`:
- Zmienić `HEARTBEAT_MS` z 40000 → 45000.
- Dodać `retryAttempted = false` i licznik `exercisesGenerated`. W timeout handlerze:
  - jeśli `exercisesGenerated === 0 && !retryAttempted` → `retryAttempted=true`, zrobić **silent retry**: stworzyć nowy `AbortController`, `fetch` ponownie z identycznym body, NIE wywoływać `onError`, kontynuować pętlę odczytu na nowym strumieniu.
  - jeśli już > 0 albo retry był → `controller.abort()` + `onError(...)` jak teraz (komunikat z liczbą).

### H5.3 Akceptacja
- Symulacja: edge function śpi 30s przed pierwszym chunkiem → keepalive trzyma stream, klient nie abortuje. Po retry max 1×, jeśli upadnie — user widzi czytelny error.

---

## H6 — Multi-provider model audit & monitoring (z v6.9.24, pełna treść)

### H6.1 Wpiąć `modelFailureLogger` w 12 edge functions
Plik: `supabase/functions/_shared/modelFailureLogger.ts` istnieje (v6.9.21). Dodać `try/catch` z wywołaniem `logModelFailure({provider, model, endpoint, status, error})` w katchach każdej z funkcji wołających model:
- `generateWorksheet/index.ts` (OpenAI/Gemini calls)
- `verify-open-answers/index.ts`
- `translate-flashcard/index.ts`
- `process-welcome-test/index.ts` (już ma częściowo — uzupełnić wszystkie catch)
- `suggest-exercises/index.ts`
- `generate-welcome-test-audio/index.ts`
- `classify-knowledge-entry/index.ts`
- `generate-curriculum-phases/index.ts`
- `generate-media-exercises/index.ts`
- `generate-image/index.ts`
- `generate-timeline/index.ts`
- `generate-audio/index.ts` (już — zostawić)

Wzór:
```ts
} catch (e) {
  await logModelFailure(supabase, { provider:'openai', model:'gpt-5', endpoint:'chat.completions', status:e?.status, error:String(e?.message||e) });
  throw e;
}
```

### H6.2 Migration: tabela `model_health_checks`
```sql
CREATE TABLE public.model_health_checks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  status int not null,
  latency_ms int,
  ok boolean not null,
  error text,
  checked_at timestamptz not null default now()
);
ALTER TABLE public.model_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.model_health_checks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_mhc_recent ON public.model_health_checks (provider, model, checked_at DESC);
```

### H6.3 Nowa edge `audit-llm-models`
`supabase/functions/audit-llm-models/index.ts` — ping minimal request do:
- `openai/gpt-5-mini` przez Lovable AI Gateway
- `google/gemini-3-flash-preview`
- (rozszerzalne)

Każdy ping mierzy latency, zapisuje 1 row w `model_health_checks`. CORS off (`verify_jwt=false`, ale chronione X-CRON-SECRET headerem z env).

### H6.4 pg_cron 06:00 UTC daily
```sql
SELECT cron.schedule('audit-llm-models-daily','0 6 * * *', $$
  SELECT net.http_post(
    url:='https://bvfrkzdlklyvnhlpleck.supabase.co/functions/v1/audit-llm-models',
    headers:= jsonb_build_object('content-type','application/json','x-cron-secret', current_setting('app.cron_secret', true))
  );
$$);
```
(Sekret `CRON_SECRET` dodany przez tool secrets.)

### H6.5 StatusPage banner — już istnieje (v6.9.21). Tylko weryfikujemy że `get_active_model_issues()` widzi nowe wpisy z `error_logs`.

---

## H8 — Dokumentacja RAG (z v6.9.24, pełna treść)

### H8.1 `docs/llm-context.md` — dodać 6 sekcji (struktura Problem → Solution → Mechanics + RAG Keywords)
1. **v6.9.27 Welcome Test Duplicate Repair** — opis race condition, fix WT-1..WT-7, partial unique index, jawny update status w process-welcome-test.
2. **v6.9.24 Signup Return-To Flow** — `useSignupLinkState`, propagacja `state.from`, lista 25 callsites, „Back" CTA.
3. **v6.9.24 SSE Keepalive & Silent Retry** — serwer 15s keepalive, klient 45s watchdog, silent retry przed pierwszym exercise.
4. **v6.9.24 Model Health Monitoring** — `modelFailureLogger`, `model_health_checks`, `audit-llm-models`, pg_cron 06:00 UTC, StatusPage RPC.
5. **v6.9.26 Reconciliation (Codex)** — przyjęcie zmian: JSON-LD claim-integrity, BusyTeacher neutral, hreflang x-default, claim scan. Wskazanie że v6.9.27 nie powtarza tych zmian.
6. **RAG Keywords** sekcja dla każdej z powyższych (np. „welcome test duplicate, race condition, idempotent createTest, attempt unique index").

### H8.2 `llms.txt` (root + public/) — dodać 6 jednolinijkowych entry odsyłających do sekcji w `llm-context.md`.

### H8.3 Nowe pliki `mem/`
- `mem/features/welcome-test/duplicate-prevention.md`
- `mem/infrastructure/sse-keepalive-pattern.md`
- `mem/infrastructure/model-health-monitoring.md`
- `mem/features/auth/signup-return-to-flow.md`
- `mem/decisions/reconciliation-v6926-codex.md`

Każdy plik z YAML frontmatter (name/description/type) i krótką treścią. Aktualizacja `mem/index.md` (zachować WSZYSTKIE istniejące wpisy + dodać 5 nowych w sekcji Memories).

---

## Kolejność implementacji
1. **WT-1..WT-7** (P0 — naraża dane studentów) — bez deploy edge: najpierw kod + migracja, potem edge function deploy.
2. **H4 weryfikacja** — sweep `rg` i uzupełnienie brakujących `state`.
3. **H5** — server keepalive + client watchdog.
4. **H6** — logger w 12 funkcjach, migracja `model_health_checks`, edge `audit-llm-models`, pg_cron.
5. **H8** — `docs/llm-context.md`, `llms.txt`, 5 plików `mem/`, update `mem/index.md`.

## Ryzyko i mitygacja
- Migracja unique index może upaść jeśli już istnieją duplikaty z `deleted_at IS NULL` i nieukończonym statusem. Mitygacja: krok 1 migracji to soft-delete pustych duplikatów PRZED utworzeniem indeksu.
- `process-welcome-test` deploy: bez wpływu na klienta (idempotentny update).
- Sweep H4 jest mechaniczny (dodanie propsa) — ryzyko regresji minimalne; build TS to wyłapie.

## Co NIE jest robione
- Brak modyfikacji promptu `generateWorksheet`.
- Brak ruszania `public/*-vs-*.html`, `scripts/seo/*`, `seoMeta.ts` (w gestii Codex/v6.9.26).
- Brak rebuildu sitemap (1745 URL stabilne).
- Brak nowych feature'ów; tylko fixy i monitoring.
