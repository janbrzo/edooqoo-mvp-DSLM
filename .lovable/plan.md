
# Plan v6.9.7 patch — demo fixes + welcome email diagnoza

## Część 1 — Audyt v6.9.7 (jak jest naprawdę)

Sprawdziłem stan wdrożenia bezpośrednio w bazie i kodzie:

**Wszystko z v6.9.7 zostało wdrożone:**
- Edge Function `format-worksheet-prompt` — istnieje i jest używana przez `useWorksheetGeneration` przez `formatPromptForAI` (potwierdzony błąd `Prompt service unavailable` to faktycznie odpowiedź tej funkcji — rozwiązany w sekcji 3.G).
- Lazy demo content — `buildDemoData` async OK.
- Welcome email pipeline — wszystko utworzone:
  - Edge Function `send-welcome-email` ✅
  - Tabela `email_send_log` ✅
  - Tabela `app_internal_config` z `welcome_email_url` (72 znaki) i `welcome_email_secret` (48 znaków) ✅
  - Trigger `on_user_email_confirmed` na `auth.users AFTER UPDATE OF email_confirmed_at` ✅
  - Funkcja `handle_email_confirmed()` używa `pg_net.http_post` ✅
  - Rozszerzenie `pg_net` aktywne ✅

**Dlaczego dostałeś maila tylko od Supabase, a nie od Resend (j4n.brz0+52@gmail.com):**

To jest stan zamierzony — pipeline działa poprawnie, ale działa w dwóch krokach:

1. **Mail #1 — Confirmation (Supabase Auth, `noreply@mail.app.supabase.io`):** wysyłany natychmiast po `auth.signUp()`, zawiera link "Confirm your email". To NIE jest "welcome". To jest weryfikacja maila, której wymaga Supabase Auth.
2. **Mail #2 — Welcome (Resend, `hello@edooqoo.com`):** wysyłany dopiero PO kliknięciu w link z maila #1. Trigger `on_user_email_confirmed` reaguje na zmianę `email_confirmed_at` z NULL na wartość, wywołuje przez `pg_net` Edge Function `send-welcome-email`, która woła Resend API.

**Twoje konto `j4n.brz0+52@gmail.com` nadal ma `email_confirmed_at = NULL`** (sprawdzone w `auth.users`) — dlatego welcome email z Resend jeszcze nie wyleciał. Po kliknięciu "Confirm your email" wyleci automatycznie. To zachowanie jest rozwiązaniem, jakiego sami chcieliśmy: nie spamujemy welcome przed weryfikacją + jest 1 mail per kanał.

**Trzy obserwacje do poprawy w komunikacji (sekcja 2):**
- Modal po rejestracji mówi "you'll receive 2 free tokens after email confirmation" — OK, ale nic nie wspomina, że po potwierdzeniu przyjdzie drugi (welcome) mail z `hello@edooqoo.com`.
- Treść maila Supabase mówi "After confirming, you'll instantly get 2 free tokens" — OK.
- Brak wpisu w FAQ/Q&A o tym podziale (Supabase confirmation vs Edooqoo welcome).

---

## Część 2 — Spójność komunikacji rejestracji (Problem 2.B)

### Diagnoza
| Miejsce | Obecny tekst | Problem |
|---|---|---|
| `Signup.tsx` modal "Check Your Email" | "You'll receive 2 free tokens after email confirmation" | Brak info, że po kliknięciu przyjdzie 2-gi mail (welcome) |
| Mail Supabase Auth (custom template) | "Welcome to EDOOQOO! …click button below… you'll instantly get 2 free tokens" | OK, nic nie zmieniamy — zostaje |
| Mail Resend Welcome | "Welcome, {firstName} 👋… Open your dashboard" | OK, ale można dodać jednoznaczny status: "Your email has been confirmed and your account is now active." |
| Strony Q&A (`Resources.tsx`, `HowItWorks.tsx`, `Glossary.tsx`) | Brak wpisu o procesie email | Brak FAQ pytania |

### Implementacja
1. **`src/pages/Signup.tsx`** — w modalu "Check Your Email" dodać linijkę pod listą "What's next":
   > "💌 After confirming, you'll get a welcome email from `hello@edooqoo.com` with quick‑start tips."
2. **`supabase/functions/send-welcome-email/index.ts`** — w funkcji `renderWelcomeHtml()` zaktualizować `sourceLine` dla `signupSource === 'email'`:
   > "Your email is confirmed and your account is now active." (dziś jest "Glad you confirmed your email — your account is now active.").
   Drobna kosmetyka, eliminuje "Glad" jako filler.
3. **`src/pages/Resources.tsx`** — sekcja FAQ — dodać 1 pytanie:
   > **Q: I just signed up — how many emails should I expect?**
   > A: Two. First, a confirmation email from Supabase to verify your address. After you click the link, you'll get a short welcome email from `hello@edooqoo.com` with onboarding tips. Both are one‑time only.
4. **`src/pages/HowItWorks.tsx`** — krok "Sign up" — rozszerzyć opis o 1 zdanie z tym samym wyjaśnieniem.

**Brak regresji:** zmiany czysto tekstowe, plus jeden string w edge function (welcome email — bez zmian w strukturze ani API).

---

## Część 3 — Demo Mode bugs (Problem 3.A‑G)

### 3.A — Pasek na górze zasłania treść w `/demo`

**Przyczyna:** `StickyNav` renderuje `<DemoBanner />` jako `position: fixed top-0 z-[60] h-[36px]`. Następnie `<nav>` ma `sticky top-[36px]` (dobrze). Ale strony renderowane wewnątrz `AuthenticatedPageShell` (Dashboard, AllWorksheetsPage, CalendarPage, StudentPage, itd.) nie mają żadnego `padding-top` rekompensującego 36 px paska. `min-h-screen` w shellu nie wie nic o pasku.

**Implementacja (jeden punkt, zero zgadywania):**

W `src/contexts/DemoContext.tsx` provider już jest. Dodajemy w `src/components/AuthenticatedPageShell.tsx`:

```tsx
import { useDemoContext } from '@/contexts/DemoContext';
// ...
const { isDemoMode } = useDemoContext();
return (
  <div
    className={`min-h-screen auth-bg-shell ${className}`}
    style={isDemoMode ? { paddingTop: '36px' } : undefined}
  >
    {children}
    ...
  </div>
);
```

To rozwiązuje wszystkie strony korzystające z `AuthenticatedPageShell` jednym strzałem. `StickyNav` ma już własny `top-[36px]` więc nie robimy double‑offset.

**Strony anon używające `StickyNav` bez shellu (Index, BookLandingPage, About, …)** — sprawdzę przed implementacją; tam `<DemoBanner />` jest renderowany w samym `StickyNav` i `nav` przesunięte przez `top-[36px]`, treść leci pod navem (mt‑0), więc nic nie zasłania (banner siedzi nad navem, nie nad treścią). Wniosek: zmiana TYLKO w `AuthenticatedPageShell`.

### 3.B — Brak studentów w `/demo` na Dashboard

**Przyczyna sprawdzona w kodzie:** `useStudents` poprawnie zwraca `demoData.students` gdy `isDemoMode && demoData`. `useProfile` też. Problem jest w `DemoContext.tsx` — `buildDemoData` zwraca Promise i `demoData` na początku jest `null`. `useStudents` ma `enabled: isDemoMode ? true : !!teacherId`, więc query odpala się ZANIM `demoData` jest gotowe → zwraca `[]`. Po otrzymaniu `demoData` query NIE odpala się ponownie, bo queryKey nie zmienia się (`demoData` nie jest w kluczu), a `staleTime` defaultu RTK Query trzyma puste `[]`.

**Fix (dwie zmiany, atomowe):**

1. `src/hooks/useStudents.tsx`:
   ```ts
   queryKey: ['students', teacherId, isDemoMode, !!demoData],
   enabled: isDemoMode ? !!demoData : !!teacherId,
   ```
2. To samo dla `src/hooks/useFlashcardSets.tsx` jeśli używa tego samego wzorca (do sprawdzenia w implementacji — jeśli ma `useQuery`, dodać `!!demoData` w key i guard w enabled).

**Brak regresji:** w trybie nie‑demo `demoData = null` ale nie używamy go (jest `if (isDemoMode && demoData)`); klucz query w trybie auth zmienia się tylko o stały `false`, czyli w praktyce bez różnic.

### 3.C — `/worksheets` (AllWorksheetsPage) nie ładuje się

**Przyczyna sprawdzona:** `useWorksheetHistory` w demo ustawia `worksheets` w `useEffect` ale **nigdy nie ustawia `loading=false` w gałęzi demo** (sprawdziłem linie 33‑43 — `setLoading(false)` jest w środku, ale ścieżka `useEffect` w demo nie ma `setLoading(false)` jeśli `demoData` jest `null` w pierwszym renderze). Dodatkowo `AllWorksheetsPage` ma `if (authLoading || loading) return spinner` — i loading nigdy nie schodzi na false dla demo bez worksheetów lub kiedy `demoData` przychodzi z opóźnieniem.

Sprawdziłem dokładnie: pierwszy effect ustawia `loading=false` tylko gdy `isDemoMode && demoData`. Jeśli `demoData` jest null (przed lazy import), `useEffect` nie wywołuje setLoading(false), `fetchWorksheets` ma early return (`isDemoMode = true`), więc `loading` zostaje `true` na zawsze.

**Fix:** w `src/hooks/useWorksheetHistory.tsx` `useEffect` w gałęzi demo:
```ts
useEffect(() => {
  if (!isDemoMode) return;
  if (!demoData) { setLoading(true); return; }
  let ws = demoData.worksheets as WorksheetHistoryItem[];
  if (studentId) ws = ws.filter(w => w.student_id === studentId);
  setWorksheets(ws);
  setTotalCount(ws.length);
  setLoading(false);
}, [isDemoMode, demoData, studentId]);
```

To samo dla `useDeletedWorksheets.tsx` — w demo zwracamy `[]` natychmiast tylko gdy `demoData` przyjdzie (lub od razu — `deletedWorksheets` w demo zawsze `[]`, więc `setLoading(false)` można wywołać natychmiast w gałęzi demo, nie czekając na `demoData`).

**Brak regresji:** ścieżka non‑demo nie zmieniona.

### 3.D — Nieprawidłowe komunikaty "Failed to rename / share / delete" w demo

**Diagnoza:** są 4 miejsca z toastem `Failed to rename worksheet` i analogiczne dla rename/share/delete:
- `src/components/worksheet/WorksheetHeader.tsx:92` — `handleRenameWorksheet`
- `src/pages/Dashboard.tsx:136` — `handleRenameWorksheet`
- `src/pages/StudentPage.tsx:412` — `handleRenameWorksheet`
- `src/components/student-homework/StudentHomeworkTab.tsx:257` — `Failed to rename homework`

W demo te akcje wywołują `supabase.from('worksheets').update(...)` które rzuca RLS error/UUID error → łapie `catch` i pokazuje "Failed to…". Mamy już `useDemoGuard.guardAction` ale nie jest tu używane.

**Fix — wzorzec jednolity:** każdy z tych 4 handlerów na początku:
```ts
const { isDemoMode, showDemoBlockedToast } = useDemoContext();
// w handlerze:
if (isDemoMode) { showDemoBlockedToast('Renaming worksheet'); return; }
```

Plus to samo w `DeleteWorksheetButton.tsx`, `DuplicateWorksheetButton.tsx`, `ShareWorksheetModal.tsx`, `RenameDialog.tsx` — sprawdzę i dodam guard tam, gdzie wywołują mutację Supabase. Lista do zrobienia (potwierdzona przez `rg`):
- `src/components/DeleteWorksheetButton.tsx`
- `src/components/DuplicateWorksheetButton.tsx` 
- `src/components/DuplicateWorksheetModal.tsx`
- `src/components/ShareWorksheetModal.tsx`
- `src/components/RenameDialog.tsx` (jeśli sam wywołuje update; jeśli tylko emituje callback — guard idzie w callbacku)
- `src/components/student-homework/StudentHomeworkTab.tsx`
- `src/components/worksheet/WorksheetHeader.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/StudentPage.tsx`

**Brak regresji:** guard tylko gdy `isDemoMode === true`. W non‑demo flow pozostaje 100% identyczny.

### 3.E — "Tokens: 15 professional" → poprawny tier

**Przyczyna:** `src/data/demoData.ts:407` ma `subscription_type: 'professional'`. `StickyNav` renderuje go jako `<Badge>{subscriptionType}</Badge>`. Brak takiego tier'a w cenniku.

**Lista realnych tierów (do potwierdzenia w `PricingCalculator.tsx`/`PricingSection.tsx` przy implementacji):** Free, Hobby, Part-Time, Full-Time 30 (lub podobne).

**Fix:**
1. `src/data/demoData.ts` — zmienić `subscription_type: 'professional'` → `subscription_type: 'Full-Time 30'`.
2. Sprawdzić i poprawić w demo również `monthly_token_limit` jeśli jest niespójne — Full-Time = 30 tokenów/miesiąc. Z screena demo ma 15 tokenów obecnie. Zostawiamy `tokenLeft = 15` (=środek cyklu wygląda autentycznie), ale `monthly_token_limit` ustawić na 30 jeśli pole istnieje w demoData.

**Brak regresji:** demo data tylko.

### 3.F — Calendar: modal slot powinien się otwierać, a blokada przy zapisie

**Obecny stan:** `CalendarPage.handleAddSlot` ma:
```ts
if (isDemoMode) { showDemoBlockedToast('Adding lessons'); return; }
```
Toast wyskakuje od razu, modal nie pokaże się.

**Fix (zgodnie z prośbą — pozwól otworzyć, blokuj przy save):**

1. `src/pages/CalendarPage.tsx` — usunąć guard z `handleAddSlot` i `handleSlotClick` (`isDemoMode` block) — modal otwiera się w demo.
2. Przekazać `isDemoMode` do `<UnifiedSlotModal />` jako prop `demoMode`.
3. W `src/components/calendar/UnifiedSlotModal.tsx:273` — `handleSubmit` na samym początku:
   ```ts
   if (demoMode) { showDemoBlockedToast('Saving calendar slots'); return; }
   ```
4. Dla edycji istniejącego slota — `selectedSlot` modal (osobny komponent) — to samo: pozwolić otworzyć, zablokować save.
5. Zostawić blokadę dla `handleShare` (sharing public calendar) — bo to natychmiastowa akcja bez modala.

**Brak regresji:** w prod (non‑demo) `demoMode = false` → 0 zmian zachowania.

### 3.G — Generowanie worksheetu nie blokowane od razu w demo

**Obecny stan sprawdzony w `useWorksheetGeneration.tsx`:** `generateWorksheetHandler` nie ma guarda demo. `useTokenSystem` ma `isDemo = isDemoMode || isAnonymousUser !== false` — czyli demo zachowuje się jak anon = leci dalej i woła `format-worksheet-prompt`. Edge function odpowiada błędem (bo demo user nie ma tokena/uprawnień) → toast "Prompt service unavailable".

**Fix — wczesna blokada (podobnie jak Calendar):**

W `src/hooks/useWorksheetGeneration.tsx:37` na początku `generateWorksheetHandler`:
```ts
import { useDemoContext } from '@/contexts/DemoContext';
// w hooku:
const { isDemoMode, showDemoBlockedToast } = useDemoContext();
// w handlerze, PRZED isGenerating check:
if (isDemoMode) {
  showDemoBlockedToast('Generating worksheets');
  return;
}
```

Plus sprawdzić wszystkie miejsca, które otwierają generation flow w demo — `src/pages/Index.tsx` (główne `Generate` CTA) i `Dashboard.handleGenerateWorksheet` (które robi `navigate('/')`). Tam też dodać guard, żeby nawet nie nawigować do `/` z `forceNewWorksheet`. Pseudokod dla Dashboard:
```ts
const handleGenerateWorksheet = () => {
  if (isDemoMode) { showDemoBlockedToast('Generating worksheets'); return; }
  sessionStorage.setItem('forceNewWorksheet', 'true');
  navigate('/');
};
```
Analogicznie w `StickyNav` przycisk `+ Generate Worksheet` w demo — `onGenerateWorksheet` przekazany z Dashboard już ma guard, więc StickyNav nic nie robi sam. W `WorksheetForm` (jeśli wywołuje `generateWorksheetHandler` bezpośrednio z anon flow) — guard w hooku łapie i tak.

**Brak regresji:** identyczna ścieżka jak Calendar slot save.

### Sekretne miejsca dodatkowe (sprawdzone)

`useStudentSelector.tsx:19` ma już `guardAction('Transferring worksheets')`. To samo dla `Bulk delete` w `AllWorksheetsPage.handleBulkDelete` — dodać guard demo.

---

## Część 4 — Dokumentacja RAG

### 4.1 — `docs/llm-context.md` — nowa sekcja v6.9.7‑patch

```
### v6.9.7‑patch — Demo UX hardening + email pipeline confirmation

**Problem A:** DemoBanner (fixed 36px) overlaid first 36px of every authenticated page.
**Edooqoo Solution:** Conditional `padding-top: 36px` on `AuthenticatedPageShell` when `isDemoMode`.
**Technical Mechanics:** `useDemoContext()` in shell; pages inside shell get banner offset for free.
**RAG Keywords:** demo banner offset, sticky nav demo, page top cut off, AuthenticatedPageShell padding

**Problem B:** Demo students/worksheets/deleted hooks raced async `buildDemoData`; queries fired before `demoData` ready and never re-fetched.
**Edooqoo Solution:** Add `!!demoData` to React Query key + `enabled` guard; ensure `setLoading(false)` in demo branches even when `demoData` is null.
**Technical Mechanics:** `useStudents`, `useWorksheetHistory`, `useDeletedWorksheets` updated. Non-demo path unchanged.
**RAG Keywords:** demo loading stuck, demo empty list, useStudents queryKey demoData

**Problem C:** Mutating actions in demo showed generic "Failed to rename" instead of "Demo mode" toast.
**Edooqoo Solution:** Demo guard at handler entry across rename/duplicate/delete/share/bulk-delete/generate.
**Technical Mechanics:** `useDemoContext().showDemoBlockedToast(action)` early-return pattern. Identical wording across all surfaces.
**RAG Keywords:** demo mode action blocked, Failed to rename worksheet demo, demo guard pattern

**Problem D:** Calendar Add Slot showed toast immediately; UX expectation = modal opens, save is blocked.
**Edooqoo Solution:** Open modal freely in demo; block at `handleSubmit` of `UnifiedSlotModal` via `demoMode` prop.
**Technical Mechanics:** Removed guard in `CalendarPage.handleAddSlot/handleSlotClick`; added prop-driven guard inside modal.
**RAG Keywords:** demo calendar add slot, slot modal blocked, demoMode prop

**Problem E:** `subscription_type='professional'` is not a real tier; appeared next to token count.
**Edooqoo Solution:** Demo profile uses `Full-Time 30` (real tier).
**Technical Mechanics:** Single change in `src/data/demoData.ts`.

**Problem F:** Worksheet generation in demo wasn't gated; user could trigger and got `Prompt service unavailable` from edge function.
**Edooqoo Solution:** Early demo guard in `useWorksheetGeneration.generateWorksheetHandler` AND in `Dashboard.handleGenerateWorksheet`.
**Technical Mechanics:** `isDemoMode → showDemoBlockedToast('Generating worksheets'); return` before any navigation/API call.
**RAG Keywords:** demo worksheet generation blocked, Prompt service unavailable demo

**Problem G:** Users confused why they got Supabase confirmation email but no Edooqoo welcome email immediately.
**Edooqoo Solution:** Document the two-email flow (Supabase confirmation → after click → Resend welcome). Update Signup modal copy + welcome email body + Resources FAQ.
**Technical Mechanics:** Welcome trigger fires on `email_confirmed_at` NULL→NOT NULL transition. Until user clicks confirmation link, only Supabase auth email exists. This is by design — prevents welcome email to unverified addresses.
**RAG Keywords:** welcome email not received, two emails after signup, hello@edooqoo.com Resend, email_confirmed_at trigger
```

### 4.2 — `llms.txt`
Dodać 1 sekcję mirror (identyczna treść w skróconej formie, jak inne sekcje).

### 4.3 — Memory
Zaktualizować `mem://features/email/welcome-email-pipeline.md` — dodać operację:
> "Two-email UX: Supabase confirmation always fires first; welcome email only after confirmation link click. Document this in user-facing FAQ."

Dodać `mem://features/public-demo-mode-lockdown.md` (już istnieje w indeksie) — note:
> "v6.9.7-patch: demo guards added in: useWorksheetGeneration, Dashboard.handleGenerateWorksheet, AllWorksheetsPage bulk-delete, UnifiedSlotModal.handleSubmit (via demoMode prop), Worksheet rename handlers (4 lokacje). Calendar pattern: open modal, block save."

---

## Kolejność implementacji (1 sesja build)

1. **Demo race fixes** (3.B, 3.C) — `useStudents`, `useWorksheetHistory`, `useDeletedWorksheets`
2. **Banner offset** (3.A) — `AuthenticatedPageShell`
3. **Demo data tier** (3.E) — `demoData.ts`
4. **Demo guards na handlerach** (3.D, 3.F, 3.G) — 9 plików (lista wyżej)
5. **Calendar prop demoMode** (3.F) — `CalendarPage` + `UnifiedSlotModal`
6. **Copy update** (2) — `Signup.tsx`, `send-welcome-email/index.ts`, `Resources.tsx`, `HowItWorks.tsx`
7. **Deploy** `send-welcome-email`
8. **Docs + memory** (4)

## Brak regresji — checklist

- Wszystkie zmiany w demo guardach są `if (isDemoMode) ...; return;` — zerowy wpływ na non‑demo.
- Zmiany w queryKey/enabled dodają tylko jeden boolean — w non‑demo zawsze ten sam wynik.
- `AuthenticatedPageShell` padding tylko w demo.
- `UnifiedSlotModal` prop `demoMode` opcjonalny z default `false`.
- Welcome email pipeline — zero zmian w schema/triggerze, tylko 1 string w HTML.
- Vite config, sourcemaps, logger, format-worksheet-prompt — niezmienione.

Po Twojej zgodzie wykonam wszystko w jednej sesji build, z deployem edge function na końcu.
