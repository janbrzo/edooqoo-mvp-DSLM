## Plan v6.9.54 — Modal generowania, dark mode na worksheet, walidacja emaila Welcome Test

WORKSHEET GENERATION ENGINE pozostaje nietknięty (zakaz z core rules).

---

## PROBLEM 1 — Modal "Generating Your Worksheet"

### Dependency scan
- `src/components/GeneratingModal.tsx` (host modala, carousel timer, layout, scroll)
- `src/components/generation/GenerationContextPanel.tsx` (CTA "Create free account", scroll height)
- `src/components/generation/WorkflowSummaryCard.tsx` (siatka 5 itemów → 3 rzędy)
- `src/components/generation/generationModalSlides.ts` (źródło itemów)
- `src/constants/oneMinutePrepWorkflowProof.ts` (lista `lessonSignalWorkflowSteps` – tu jest 5 itemów)
- `src/pages/Index.tsx` (przekazuje propsy; mamy już `sessionStorage.worksheetStudentName`)

### Root cause
- 1A: modal nigdy nie dostawał `studentName` — brak propsa.
- 1B: `WorkflowSummaryCard` używa `grid sm:grid-cols-2`, a slide "signals" ma 5 itemów → 3 rzędy zwiększają wysokość.
- 1C: auto-advance carousel jest ustawiony na 8000 ms, użytkownik chce 15000 ms.
- 1D: `GenerationContextPanel` używa `<Link to="/signup">` w tej samej karcie — przerywa generowanie po nawigacji.
- 1E: zawartość prawej kolumny (`GenerationContextPanel`) jest zbyt wysoka (screenshot 320–360 px + listy + dots + CTA) → przy mniejszych viewportach pojawia się scroll w modalu.

### Selected solution + why
Minimalna chirurgia w 4 plikach, bez zmian logiki generowania. Wszystkie zmiany czysto presentacyjne / propsowe.

### Impact analysis
- Zerowy wpływ na pipeline generowania, edge functions, RLS.
- WorkflowSummaryCard renderuje teraz max 4 itemy (slide "signals" ma 5 → ostatni "Live worksheet answers" zostaje pokazany przez prawą kolumnę `GenerationContextPanel`, więc treść nie znika z modala).
- Otwarcie signup w nowej karcie nie psuje state — generowanie trwa w obecnej.

### Full implementation

**1) `src/components/generation/generationModalSlides.ts`**
Dodaj eksport helpera:
```ts
export const MAX_LEFT_CARD_ITEMS = 4;
```
(używany w `WorkflowSummaryCard`).

**2) `src/components/generation/WorkflowSummaryCard.tsx`**
- Zaimportuj `MAX_LEFT_CARD_ITEMS`.
- Renderuj `slide.items.slice(0, MAX_LEFT_CARD_ITEMS)`.
- Zostaw `sm:grid-cols-2` — 4 itemy = 2 rzędy zawsze.

**3) `src/components/generation/GenerationContextPanel.tsx`**
- Zamień:
  ```tsx
  <Button asChild className="mt-4 rounded-full">
    <Link to="/signup">...</Link>
  </Button>
  ```
  na:
  ```tsx
  <Button asChild className="mt-4 rounded-full">
    <a href="/signup" target="_blank" rel="noopener noreferrer">
      Create free account
      <ArrowRight className="ml-2 h-4 w-4" />
    </a>
  </Button>
  ```
- Zmniejsz wysokość screenshotu: `imageClassName="h-36 sm:h-40"` (było `h-44 sm:h-48`).
- Zmniejsz padding: `p-4` → `p-3`; `mt-4 space-y-2` → `mt-3 space-y-1.5`; `py-2` → `py-1.5`; `mt-4` na CTA → `mt-3`.
- Header: `text-lg` → `text-base`, `mt-2 text-sm leading-6` → `mt-1.5 text-xs leading-5`.

**4) `src/components/GeneratingModal.tsx`**
- Dodaj prop `studentName?: string` (interface + parametry).
- Header zamień na:
  ```tsx
  <div className="text-center space-y-0.5">
    <h2 className="text-2xl font-semibold bg-gradient-to-r ...">
      Generating Your Worksheet
    </h2>
    {studentName ? (
      <p className="text-sm text-muted-foreground">for <span className="font-medium text-foreground">{studentName}</span></p>
    ) : null}
  </div>
  ```
- Zmień interwał carousel: `}, 8000);` → `}, 15000);`
- Reset paddingu modal-grida: zostawić `p-6` ale w `space-y-6 ... lg:gap-6` zmienić `lg:gap-6` → `lg:gap-4` (kompresja przestrzeni między kolumnami).

**5) `src/pages/Index.tsx`**
W obu wystąpieniach `<GeneratingModal ...>` dodaj:
```tsx
studentName={typeof window !== 'undefined' ? (sessionStorage.getItem('worksheetStudentName') || undefined) : undefined}
```
(Authenticated branch: linia ~428, anonymous branch: linia ~545; w anon możemy pominąć — anon nie ma studenta, ale prop jest opcjonalny.)

### Verification checklist 1
- [ ] Modal pokazuje "for {imię}" gdy worksheet jest dla studenta.
- [ ] Karta "Lesson-time signal capture" ma max 2 rzędy (4 itemy).
- [ ] Slajdy auto-advance co 15 s.
- [ ] Click "Create free account" otwiera signup w nowej karcie; modal generowania nadal działa w starej.
- [ ] Brak scrollbara w modalu na 1280×720 i 1366×768 dla wariantu anon.

---

## PROBLEM 2 — Odwrócone kolory na worksheet/homework

### Dependency scan
- `index.html` linie 213-219 — inline script ustawia `.dark` na bazie `prefers-color-scheme`.
- `src/hooks/useTheme.ts` — `theme === 'system'` mapuje na dark gdy media-query dopasuje.
- Memory `mem/index.md`: **"Dark Mode is for teachers only (AuthenticatedPageShell)"**.
- `src/pages/WorksheetPage.tsx`, `src/pages/SharedWorksheet.tsx`, `src/components/Homework*` — strony renderowane też dla anon.

### Root cause
Inline-script w `index.html` ustawia klasę `dark` także dla anonimowych użytkowników bez explicit preferencji, gdy ich system jest w trybie ciemnym. Strony worksheet nie są pod `AuthenticatedPageShell`, więc nie mają własnego trybu — dziedziczą globalną klasę → kolory teacher-theme odwracają się na biało-czarne i tracą kontrast.

### Selected solution + why
Dwuwarstwowe zabezpieczenie:
1. Inline-script przestaje dziedziczyć `prefers-color-scheme`. Dark stosuje się **tylko** jeśli teacher świadomie wybrał `dark` (zapisana wartość `'dark'`). Wartości `'system'` / brak = light.
2. `useTheme.ts`: `'system'` rezolwuje się do `light` (nie pyta media-query). Teacher zostaje z trzema opcjami: system (= light), light, dark; ale dark wymaga wyboru ręcznego. Eliminuje dryf przy zmianie systemu.
3. `WorksheetPage.tsx`, `SharedWorksheet.tsx`, `StudentHubHomework.tsx`, `StudentHubWorksheets.tsx`, `pages/StudentHubLanding.tsx`, `pages/PublicBookingPage.tsx`, `pages/gallery/PublicGalleryWorksheetPage.tsx` — na mount usuwają `.dark` z `document.documentElement` i na unmount przywracają zapisaną preferencję (tylko jeśli localStorage = `'dark'`).

Wybór: zachowuje istniejące zachowanie teacher dark mode (świadoma decyzja), ale zamyka wszystkie ścieżki auto-inwersji dla worksheet i homework.

### Impact analysis
- Teacherzy którzy mieli `'system'` i system dark — utracą auto-dark. Memory wskazuje że dark to świadomy wybór teachera, więc to zgodne z polityką.
- Sonner (`src/components/ui/sonner.tsx`) używa `useTheme` z innego pakietu — bez zmian.
- BackgroundPatternSwitcher nie zmienia logiki.

### Full implementation

**1) `index.html`** linie 213-220:
```html
<script>
  (function() {
    try {
      var t = localStorage.getItem('edooqoo-theme');
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (_) {}
  })();
</script>
```

**2) `src/hooks/useTheme.ts`** — zmień `applyTheme`:
```ts
const applyTheme = (t: Theme) => {
  // Dark mode is teacher-only and must be an explicit opt-in.
  // 'system' resolves to light to prevent OS-driven color inversion on
  // public surfaces (worksheet/homework/welcome test).
  const isDark = t === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
};
```
Usuń efekt nasłuchujący media-query (linie 19-24) — niepotrzebny.

**3) Nowy hook `src/hooks/useForceLightTheme.ts`**:
```ts
import { useEffect } from 'react';

/**
 * Force-disable dark mode for the lifetime of a page.
 * Used on worksheet/homework/public surfaces where teacher dark theme
 * tokens would invert the high-contrast white background.
 */
export function useForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => {
      const stored = localStorage.getItem('edooqoo-theme');
      if (stored === 'dark' && hadDark) {
        root.classList.add('dark');
      }
    };
  }, []);
}
```

**4) Wstaw `useForceLightTheme()` jako pierwszą linię w komponencie**:
- `src/pages/WorksheetPage.tsx`
- `src/pages/SharedWorksheet.tsx`
- `src/pages/StudentHubWorksheets.tsx`
- `src/pages/StudentHubHomework.tsx`
- `src/pages/gallery/PublicGalleryWorksheetPage.tsx`
- `src/pages/PublicBookingPage.tsx`
- `src/pages/WelcomeTestPage.tsx`

### Verification checklist 2
- [ ] Wejście na `/worksheet/:id` z systemem dark → strona jasna.
- [ ] Teacher z `localStorage.edooqoo-theme = 'dark'` widzi dark w Dashboard/Profile, ale `/worksheet/:id` jest jasny; po wyjściu wraca dark.
- [ ] Nigdzie ręcznie nie ustawiamy `.dark` na anon.

---

## PROBLEM 3 — Walidacja emaila ucznia w Welcome Test

### Dependency scan
- `src/pages/WelcomeTestPage.tsx` linie 242-270 (`handleVerifyEmail`).
- Supabase RLS na `public.students` (anon select najpewniej zablokowany → `data` null → bypass).
- RPC `get_test_status_by_share_token` już istnieje i jest `security definer`.

### Root cause
`supabase.from('students').select('student_email').eq('id', studentId).single()` jest blokowany przez RLS dla anonimowego studenta. `data` zwraca `null`, warunek `if (data?.student_email && …)` nie wykonuje się i każdy email przechodzi.

### Selected solution + why
Nowy RPC `verify_welcome_test_email(p_share_token text, p_email text) returns table(has_email boolean, matches boolean)` z `security definer`, dostępny dla `anon` i `authenticated`. Logika: po share_token znajdź test → student_id → zwróć `has_email = student_email IS NOT NULL`, `matches = lower(student_email) = lower(p_email)`.

Klient zastępuje query bezpośrednie wywołaniem RPC i:
- gdy `!has_email` → toast `"This test requires the student email. Please ask your teacher to set it before starting."` + return.
- gdy `!matches` → toast `"This email doesn't match the student assigned to this test."` + return.

Po stronie klienta zachowujemy istniejący regex sanity-check przed RPC.

### Impact analysis
- Teacher-mode i `preview=1` nadal omijają etap email (osobny `useEffect`).
- Walidacja przestaje zależeć od RLS klienta — działa zawsze.
- Brak zmian schematu tabel; tylko nowa funkcja.

### Full implementation

**1) Nowa migracja** `supabase/migrations/<timestamp>_verify_welcome_test_email.sql`:
```sql
create or replace function public.verify_welcome_test_email(
  p_share_token text,
  p_email text
)
returns table (has_email boolean, matches boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student_email text;
begin
  select s.student_email
    into v_student_email
  from public.student_tests t
  join public.students s on s.id = t.student_id
  where t.share_token = p_share_token
  limit 1;

  if v_student_email is null or length(btrim(v_student_email)) = 0 then
    return query select false, false;
    return;
  end if;

  return query select
    true,
    lower(btrim(v_student_email)) = lower(btrim(p_email));
end;
$$;

revoke all on function public.verify_welcome_test_email(text, text) from public;
grant execute on function public.verify_welcome_test_email(text, text) to anon, authenticated, service_role;
```
(Dostosuj nazwy tabel `student_tests` / kolumny `share_token`, `student_id` jeżeli różnią się w schemacie — przed migracją zweryfikować w `supabase/migrations/`.)

**2) `src/pages/WelcomeTestPage.tsx`** — zamień `handleVerifyEmail`:
```ts
const handleVerifyEmail = async () => {
  if (!emailInput.trim()) {
    toast.error("Please enter your email");
    return;
  }
  const raw = emailInput.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw)) {
    toast.error("Please enter a valid email address (e.g. name@example.com)");
    return;
  }
  const email = raw.toLowerCase();

  if (!token) {
    toast.error("Missing test token. Please use the link from your teacher.");
    return;
  }

  const { data, error: rpcError } = await supabase.rpc('verify_welcome_test_email', {
    p_share_token: token,
    p_email: email,
  });
  if (rpcError) {
    toast.error("Could not verify email. Please try again or contact your teacher.");
    return;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.has_email) {
    toast.error("This test requires the student email. Please ask your teacher to set it before starting.");
    return;
  }
  if (!row?.matches) {
    toast.error("This email doesn't match the student assigned to this test.");
    return;
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  localStorage.setItem(`wt_email_${token}`, JSON.stringify({ email, expiresAt: expiresAt.toISOString() }));
  setVerifiedEmail(email);
};
```

### Verification checklist 3
- [ ] Login student email wpisany = zapisany w DB → przejście.
- [ ] Inny email → toast "doesn't match".
- [ ] Student bez `student_email` w DB → toast "requires the student email".
- [ ] Teacher (zalogowany właściciel) wciąż omija krok email.

---

## RAG injection
Dodać sekcję v6.9.54 do `docs/llm-context.md` i `public/llms.txt`:

```
PROBLEM: Modal generowania nie pokazywał studenta, miał za niski auto-scroll i CTA przerywało generowanie; dark mode systemowy odwracał kolory worksheet/homework; Welcome Test akceptował każdy email gdy RLS blokował SELECT na students.
EDOOQOO SOLUTION (v6.9.54): Modal generowania pokazuje "for {student}", carousel co 15 s, CTA "Create free account" w nowej karcie, prawa kolumna skompresowana, lewa karta cap 4 itemów. Dark mode = teacher-only-explicit; anon strony (WorksheetPage, SharedWorksheet, StudentHub*, WelcomeTest, PublicGalleryWorksheet, PublicBooking) wymuszają light przez useForceLightTheme(). Welcome Test używa security-definer RPC verify_welcome_test_email do walidacji email.
TECHNICAL MECHANICS: GeneratingModal, WorkflowSummaryCard, GenerationContextPanel, generationModalSlides, useTheme, useForceLightTheme, index.html bootstrap, verify_welcome_test_email RPC.
RAG KEYWORDS: worksheet generation modal, lesson signal capture, signup new tab, dark mode teacher only, prefers-color-scheme inversion, force light theme, welcome test email validation, security definer rpc, student email match, anonymous worksheet page, dynamic student learning, modal scroll height, carousel auto advance 15s, andragogy ESL, edooqoo v6.9.54.
```

I wpis w `mem/index.md` + nowy plik `mem/features/onboarding/v6954-modal-darkmode-welcome-email.md`.

## Final change report (po wdrożeniu)
- Files: `src/components/GeneratingModal.tsx`, `src/components/generation/WorkflowSummaryCard.tsx`, `src/components/generation/GenerationContextPanel.tsx`, `src/components/generation/generationModalSlides.ts`, `src/pages/Index.tsx`, `index.html`, `src/hooks/useTheme.ts`, `src/hooks/useForceLightTheme.ts` (new), 7 stron z `useForceLightTheme()`, `src/pages/WelcomeTestPage.tsx`, nowa migracja RPC, RAG docs, memory.
- Verification: PASS po przejściu trzech checklist.
