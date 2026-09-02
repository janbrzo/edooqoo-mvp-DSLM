# v6.9.109 — `/dashboard` → „Today”: pełny plan wdrożenia

Plan implementacyjny zaakceptowanego układu. Zawiera kolejność prac, pełne specyfikacje komponentów i hooków, gotowe sygnatury, zapytania, warunki brzegowe, listę usunięć oraz weryfikację. Wszystkie decyzje projektowe są podjęte — implementacja ma być mechaniczna.

Stan zweryfikowany przed planem: polityki RLS na `calendar_slots`, `homework_assignments`, `student_knowledge_entries`, `homework_notifications`, `calendar_notifications` pozwalają nauczycielowi czytać własne wiersze (`auth.uid() = teacher_id`) — **żadna migracja nie jest potrzebna**. `DemoDataSet` ma już `calendarSlots`, `homework`, `knowledgeEntries`. `onboarding_progress` w `profiles` istnieje i jest obsługiwany przez `useOnboardingProgress`.

---

## Faza 0 — utrwalenie wizji i roadmapy (30 min)

1. `docs/ux/target-teacher-experience.md` — angielska wersja zaakceptowanej wizji „One Job Per Screen” (diagnoza, 7 zasad, 3 poziomy: Today / Student Workspace / Deep Views, Guided mode, warstwa wizualna, metryki sukcesu). Nagłówek: `Status: NORTH STAR — approved 2026-09-02`. Kolejne plany UX linkują ten plik.
2. `docs/ux/dashboard-today-spec.md` — angielska wersja układu z sekcji 2–3 tego planu (ASCII, strefy, reguły). To jest spec, do którego wraca się przy modyfikacjach.
3. `roadmap.md` — sekcja `## UX North Star`:
   - `[ ] Dashboard → Today (v6.9.109)` — ten plan
   - `[ ] Student Workspace (3 tabs + snapshot, DSLM as deep view)`
   - `[ ] Guided mode beyond dashboard`

---

## Faza 1 — warstwa danych (3 hooki, bez UI)

Wspólne reguły dla wszystkich trzech hooków:
- `@tanstack/react-query`, `staleTime: 60_000`, `refetchOnWindowFocus: false`.
- `teacherId` z `useAuthUser()`; `enabled: !!teacherId || isDemoMode`.
- Demo: pierwsza linia `queryFn` to `if (isDemoMode) return deriveFromDemo(demoData)` — zero zapytań do Supabase (reguła pamięci o UUID).
- Błąd zapytania → `devWarn` + pusta tablica (dashboard nie może się wywrócić przez sekcję pomocniczą).

### 1.1 `src/hooks/useNextUpStudents.ts`

```ts
import type { Tables } from '@/integrations/supabase/types';
type Student = Tables<'students'>;

export interface NextUpStudent {
  id: string;
  name: string;
  englishLevel: string | null;
  mainGoal: string | null;
  nextLesson: { date: string; time: string } | null; // slot_date 'YYYY-MM-DD', start_time 'HH:MM:SS'
  focusSignal: string | null;                        // latest weakness/mistake/practice title
}

export function useNextUpStudents(students: Student[], limit = 3): {
  items: NextUpStudent[];
  loading: boolean;
}
```

Zapytania (tylko gdy `students.length > 0`; `ids = students.map(s => s.id)`):

```ts
const today = format(new Date(), 'yyyy-MM-dd');
const in7 = format(addDays(new Date(), 7), 'yyyy-MM-dd');

const [slotsRes, signalsRes] = await Promise.all([
  supabase.from('calendar_slots')
    .select('student_id, slot_date, start_time')
    .eq('teacher_id', teacherId)
    .eq('status', 'booked')
    .in('student_id', ids)
    .gte('slot_date', today)
    .lte('slot_date', in7)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true }),
  supabase.from('student_knowledge_entries')
    .select('student_id, title, metadata, created_at')
    .eq('teacher_id', teacherId)
    .in('student_id', ids)
    .eq('category', 'Skill Assessment')
    .is('deleted_at', null)
    .eq('is_outdated', false)
    .order('created_at', { ascending: false })
    .limit(Math.max(ids.length * 5, 20)),
]);
```

Agregacja po stronie klienta:
- `nextLessonByStudent`: pierwszy slot na `student_id` (dane już posortowane).
- `focusByStudent`: pierwszy wpis, którego `metadata.skill_subtype ∈ {'weakness','mistake','practice'}`.
- Sortowanie: uczniowie z `nextLesson` rosnąco po `date + time`; potem reszta w kolejności wejściowej (`useStudents` już sortuje po `updated_at desc`). `slice(0, limit)`.

Demo: `demoData.calendarSlots` filtrowane po `status === 'booked'` i 7 dniach; `demoData.knowledgeEntries` filtrowane po kategorii i `skill_subtype`. Ta sama funkcja agregująca (`aggregateNextUp(students, slots, signals, limit)` wyeksportowana, testowalna).

`queryKey: ['dashboard-next-up', teacherId, ids.join(','), isDemoMode]`.

### 1.2 `src/hooks/useDashboardAttention.ts`

```ts
export type AttentionKind = 'homework_to_review' | 'welcome_test_done' | 'booking_new';

export interface AttentionItem {
  id: string;            // `${kind}:${sourceId}`
  kind: AttentionKind;
  text: string;          // English sentence, student name resolved
  ctaLabel: 'Review' | 'See results' | 'Open calendar';
  href: string;
  createdAt: string;
}

export function useDashboardAttention(students: Student[], limit = 5): {
  items: AttentionItem[];
  loading: boolean;
}
```

Zapytania równolegle:

```ts
supabase.from('homework_assignments')
  .select('id, title, student_id, completed_at')
  .eq('teacher_id', teacherId)
  .not('completed_at', 'is', null)
  .is('reviewed_at', null)
  .order('completed_at', { ascending: false })
  .limit(limit);

supabase.from('homework_notifications')
  .select('id, student_id, message, created_at')
  .eq('teacher_id', teacherId)
  .eq('notification_type', 'welcome_test_completed')
  .eq('is_read', false)
  .order('created_at', { ascending: false })
  .limit(limit);

supabase.from('calendar_notifications')
  .select('id, message, student_name, slot_id, created_at')
  .eq('teacher_id', teacherId)
  .eq('is_resolved', false)
  .order('created_at', { ascending: false })
  .limit(limit);
```

Mapowanie:
- homework → `text: \`${name} submitted "${title}"\``, `href: /homework/${id}/review`, `createdAt: completed_at`. Nazwa z `students.find(s => s.id === student_id)?.name ?? 'A student'`.
- welcome test → `text: \`${name} finished the Welcome Test\``, `href: /student/${student_id}?tab=tests`.
- booking → `text: message` (już po angielsku z backendu), `href: /calendar`.

Scalenie, sort `createdAt desc`, `slice(0, limit)`. Demo: `demoData.homework.filter(h => h.completed_at && !h.reviewed_at)`; pozostałe dwa źródła puste.

`queryKey: ['dashboard-attention', teacherId, isDemoMode]`.

### 1.3 `src/hooks/useDashboardCounts.ts`

```ts
export function useDashboardCounts(): {
  worksheetsCount: number;
  lessonsThisWeek: number;
  loading: boolean;
}
```
- `worksheetsCount`: `supabase.from('worksheets').select('id', { count: 'exact', head: true }).eq('teacher_id', teacherId).is('deleted_at', null)`. Demo: `demoData.worksheets.length`.
- `lessonsThisWeek`: reużycie `useUpcomingLessonsCount()` (bez zmian; zwraca 0 w błędzie).
- `studentsCount` nie jest tu — bierzemy `students.length` z `useStudents` w komponencie.

---

## Faza 2 — komponenty dashboardu

Wszystkie w `src/components/dashboard/`. Tokeny kolorów wyłącznie semantyczne. Każda sekcja to `<section aria-labelledby={headingId}>` z nagłówkiem `h2` w stylu `text-xs font-semibold uppercase tracking-wider text-muted-foreground`.

### 2.1 `DashboardHeader.tsx`

```ts
interface Props {
  firstName: string | null;
  studentsCount: number;
  lessonsThisWeek: number;
  onAddStudent: () => void;
}
```
- Powitanie: `getGreeting(new Date().getHours())` → `Good morning` (<12) / `Good afternoon` (<18) / `Good evening`. Wyjście: `<h1 className="text-2xl font-semibold tracking-tight">Good evening, Jan.</h1>`; fallback `Teacher`.
- Podtytuł `<p className="text-sm text-muted-foreground">`: `3 students · 2 lessons this week`. Liczba pojedyncza/mnoga przez prosty helper `plural(n, 'student')`. Gdy `lessonsThisWeek === 0`: `3 students · no lessons booked this week`.
- Prawa strona: `<Button variant="outline" size="sm" onClick={onAddStudent}><UserPlus className="mr-2 h-4 w-4" />Add student</Button>`.
- Layout: `flex flex-wrap items-start justify-between gap-4`.

### 2.2 `GuidedStepsBar.tsx`

```ts
interface Props {
  steps: { key: 'add_student' | 'generate_worksheet' | 'create_homework'; label: string; done: boolean }[];
  onShowEverything: () => void;
}
```
- Render: `<div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">`.
- Krok: ikona `CheckCircle2` (done, `text-primary`) lub `Circle` (`text-muted-foreground`), numer + etykieta. Pierwszy niedokończony krok ma `font-medium text-foreground`, reszta `text-muted-foreground`.
- Etykiety stałe: `1 Add a student`, `2 Prepare a lesson`, `3 Send homework`.
- Prawa strona: `<Button variant="link" size="sm" className="ml-auto text-xs" onClick={onShowEverything}>Show everything</Button>`.
- `role="list"`, każdy krok `role="listitem"`, ikony `aria-hidden`.

### 2.3 `NextUpSection.tsx` + `NextUpCard.tsx`

```ts
// NextUpSection
interface Props { items: NextUpStudent[]; loading: boolean; }
// NextUpCard
interface Props { item: NextUpStudent; }
```
- Siatka: `grid gap-3` + `sm:grid-cols-${min(items.length, 2)} lg:grid-cols-${min(items.length, 3)}` — użyć mapy klas (`{1:'', 2:'sm:grid-cols-2', 3:'sm:grid-cols-2 lg:grid-cols-3'}`), nie interpolacji, żeby Tailwind je wygenerował.
- Loading: 3 × `Skeleton` `h-40`.
- Karta (`Card className="border-border transition-colors hover:border-primary/40"`, `CardContent className="flex h-full flex-col gap-3 p-4"`):
  1. `<div className="flex items-center justify-between gap-2">` — `<Link to={/student/${id}} className="truncate font-semibold hover:underline">{name}</Link>` + `Badge variant="secondary"` z poziomem (tylko gdy jest).
  2. Termin: `nextLesson ? formatLesson(nextLesson) : 'No lesson booked'`. `formatLesson` → `EEE HH:mm` (np. `Tue 18:00`), a gdy data to dziś → `Today HH:mm`, jutro → `Tomorrow HH:mm`. Ikona `CalendarClock h-3.5 w-3.5`. Klasa `text-sm text-muted-foreground`.
  3. Focus (`text-sm line-clamp-2`): 
     - `focusSignal` → `<span className="text-muted-foreground">Struggled with:</span> {focusSignal}`
     - inaczej `mainGoal` → `Goal: {formatGoal(mainGoal)}` (przenieść `formatGoal` z `StudentCard` do `src/lib/students/formatGoal.ts`)
     - inaczej → `No signals yet — start with a worksheet`.
  4. `<Button className="mt-auto w-full" onClick={() => navigate(\`/student/${id}?tab=dslm\`)} aria-label={\`Prepare next lesson for ${name}\`}>Prepare next lesson<ArrowRight className="ml-2 h-4 w-4" /></Button>` — jedyny `variant="default"`.
- Uwaga techniczna: `StudentPage` czyta `?tab=` przez `handleTabChange`/`activeTab` — sprawdzić nazwę parametru w kodzie przy implementacji (jeśli strona używa `location.hash` lub innego klucza, dopasować); docelowo po przebudowie strony ucznia link będzie prowadził do zakładki Prep.

### 2.4 `AttentionSection.tsx`

```ts
interface Props { items: AttentionItem[]; loading: boolean; onOpenInbox: () => void; }
```
- `if (!loading && items.length === 0) return null;` — brak sekcji, brak „all caught up”.
- Nagłówek: `Needs your attention ({items.length})`.
- `<ul className="divide-y divide-border rounded-lg border border-border">`; wiersz `li className="flex items-center gap-3 px-4 py-3"`:
  - ikona wg `kind`: `ClipboardCheck` / `GraduationCap` / `CalendarPlus`, `className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"`, `aria-hidden`.
  - `<span className="min-w-0 flex-1 truncate text-sm">{text}</span>`
  - `<Button asChild variant="ghost" size="sm"><Link to={href}>{ctaLabel}</Link></Button>`
- Pod listą: `<button className="text-xs text-muted-foreground hover:text-foreground" onClick={onOpenInbox}>View all in notifications</button>`. `onOpenInbox` dispatchuje `window.dispatchEvent(new CustomEvent('unifiedBell:open'))`; w `UnifiedBell` dodać listener ustawiający `open=true` (wzorzec identyczny z `dslm:openSubsection`).

### 2.5 `EverythingElseSection.tsx` + `RecentWorksheetRow.tsx`

```ts
interface EverythingElseProps {
  studentsCount: number;
  worksheetsCount: number;
  showWorksheets: boolean;          // false in guided mode before first worksheet
  recentWorksheets: WorksheetListItem[];
  students: Student[];
  onRename: (w) => void;
  onRefetch: () => void;
}
```
- Kafle: `<nav className="grid grid-cols-1 gap-3 sm:grid-cols-3">`, każdy `<Link className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-muted/50">` z ikoną + etykietą + `ChevronRight`. Etykiety: `All students (n)` → `/students`; `Worksheets (n)` → `/worksheets` (ukryty gdy `!showWorksheets`); `Calendar` → `/calendar`.
- Collapsible „Recent worksheets (5)”:
  - `open` z `localStorage['edooqoo.dashboard.recentOpen'] === '1'`, domyślnie zwinięte; `onOpenChange` zapisuje.
  - Trigger: `<Button variant="ghost" size="sm" className="px-0 text-sm text-muted-foreground"><ChevronRight className={cn('mr-1 h-4 w-4 transition-transform', open && 'rotate-90')} />Recent worksheets ({n})</Button>` z `aria-expanded`.
  - Ukryty gdy `!showWorksheets` lub `recentWorksheets.length === 0`.
- `RecentWorksheetRow`:
  ```ts
  interface Props { worksheet; studentName: string | null; onRename; onRefetch; }
  ```
  `<li className="flex items-center gap-3 px-3 py-2">` → `<Link to={/worksheet/${id}} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{title}</Link>`, `<Badge variant="outline" className="shrink-0 text-xs">{studentName ?? 'Unassigned'}</Badge>`, `<MediaBadges size="sm" />`, po prawej `DropdownMenu`:
  - trigger `<Button variant="ghost" size="icon" aria-label={\`Actions for ${title}\`} className="h-8 w-8 min-h-11 min-w-11 sm:min-h-8 sm:min-w-8"><MoreHorizontal /></Button>`
  - pozycje: `Rename` (→ `onRename(worksheet)` → istniejący `RenameDialog` w `Dashboard`), `Assign to student` (otwiera `StudentSelector` — jeśli komponent wymaga własnego triggera, opakować w `DropdownMenuItem onSelect={e => e.preventDefault()}`), `Duplicate` (wywołanie logiki `DuplicateWorksheetButton` — wyodrębnić handler do `src/services/worksheetService/duplicateService.ts` jeśli jeszcze nie jest eksportowany; jest tam `duplicateService.ts`), `Copy share link` (dzisiejszy handler z `Dashboard.tsx` przeniesiony 1:1), `DropdownMenuSeparator`, `Delete` (`className="text-destructive"`, otwiera istniejący dialog `DeleteWorksheetButton` — użyć jego trybu kontrolowanego lub przenieść `AlertDialog` do wiersza).
  - W demo: pozycje mutujące wywołują `showDemoBlockedToast` (dzisiejsze zachowanie).

### 2.6 `EmptyDashboard.tsx`

```ts
interface Props { onAddStudent: () => void; }
```
`<section className="rounded-xl border border-dashed border-border px-6 py-16 text-center">` → `Users h-10 w-10 mx-auto text-muted-foreground`, `<h2 className="mt-4 text-xl font-semibold">Add your first student</h2>`, `<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Edooqoo builds the learner context once, then every weekly prep starts from it.</p>`, `<Button className="mt-6" onClick={onAddStudent}><UserPlus .../>Add your first student</Button>`, `<Link to="/demo" className="mt-3 block text-xs text-muted-foreground hover:text-foreground">See a sample student instead</Link>`. W demo (`isDemoMode`) link do `/demo` nie renderuje się.

### 2.7 `CompactStatsBar.tsx` — zmiana na potrzeby Profile

- Nowy prop `variant?: 'bar' | 'list'` (domyślnie `'bar'`, zachowanie bez zmian).
- `variant="list"`: `<dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">`, każdy stat jako `dt` (pełna etykieta `full`) + `dd` (`text-lg font-semibold tabular-nums`). Bez `HubInfo`, bez tooltipów.
- Komponent przestaje być importowany w `Dashboard.tsx`.

---

## Faza 3 — `src/pages/Dashboard.tsx` (przepisanie)

Docelowa struktura (~160 linii):

```tsx
const Dashboard = () => {
  // auth + redirect (bez zmian)
  const { user, loading, isRegisteredUser } = useAuthFlow();
  const { tokenLeft, profile } = useTokenSystem(user?.id);           // tylko dla StickyNav
  const { profile: userProfile } = useProfile();
  const { students, loading: studentsLoading } = useStudents();
  const { worksheets, loading: historyLoading, refetch: refetchWorksheets, deleteWorksheet }
    = useWorksheetHistory(undefined, true, true);                    // listView, 5 pierwszych
  const { items: nextUp, loading: nextUpLoading } = useNextUpStudents(students);
  const { items: attention, loading: attentionLoading } = useDashboardAttention(students);
  const { worksheetsCount, lessonsThisWeek } = useDashboardCounts();
  const { progress, dismissOnboarding } = useOnboardingProgress();   // sprawdzić nazwę settera; jeśli brak — dodać `dismiss()`
  const { isDemoMode, showDemoBlockedToast } = useDemoContext();

  const guided = !isDemoMode && !progress.completed && !progress.dismissed && !progress.steps.generate_worksheet;
  const showWorksheets = !guided || !!progress.steps.generate_worksheet;

  // ?action=add-student (bez zmian), hasEverLoaded (bez zmian)
  // rename handler + RenameDialog (bez zmian)

  if (!hasEverLoaded && (...loading)) return <PageLoadingState label="Loading your dashboard" />;

  return (
    <AuthenticatedPageShell>
      <FreeWeekBanner />
      <StickyNav isRegisteredUser tokenLeft={tokenLeft} user={user} subscriptionType={...} onGenerateWorksheet={handleGenerateWorksheet} />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        <DashboardHeader firstName={userProfile?.first_name ?? null} studentsCount={students.length} lessonsThisWeek={lessonsThisWeek} onAddStudent={() => setAddStudentModalOpen(true)} />
        {students.length === 0 ? (
          <EmptyDashboard onAddStudent={() => setAddStudentModalOpen(true)} />
        ) : (
          <>
            {guided && <GuidedStepsBar steps={guidedSteps(progress.steps)} onShowEverything={dismissOnboarding} />}
            <NextUpSection items={nextUp} loading={nextUpLoading} />
            <AttentionSection items={attention} loading={attentionLoading} onOpenInbox={openBell} />
            <EverythingElseSection
              studentsCount={students.length}
              worksheetsCount={worksheetsCount}
              showWorksheets={showWorksheets}
              recentWorksheets={worksheets.slice(0, 5)}
              students={students}
              onRename={(w) => setRenameWorksheetData({ id: w.id, title: formatWorksheetTitle(w) })}
              onRefetch={refetchWorksheets}
              onDelete={handleDeleteWorksheet}
            />
          </>
        )}
      </main>
      <AddStudentDialog ... /> <RenameDialog ... />
    </AuthenticatedPageShell>
  );
};
```

Usunięte z pliku: `CompactStatsBar`, `NextPrepStrip`, `StudentCard`, `WorksheetHomeworkList`, `useWorksheetStats`, `useAllWorksheetHomework`, `useUpcomingLessonsCount` (przeniesiony do `useDashboardCounts`), stany `studentSearch`, `sortMode`, `selectedTimeFrame`, cały dwukolumnowy `grid`.

Uwaga: `AuthenticatedPageShell` nie renderuje `<main>` — dashboard sam renderuje jeden `<main>`; sprawdzić, że `App.tsx` nie opakowuje tras w drugi `<main>` (jest `</main>` w `App.tsx:240` — jeśli globalny `<main>` istnieje, użyć `<div>` w Dashboardzie zamiast drugiego `<main>`).

`guidedSteps(steps)`:
```ts
[
  { key: 'add_student',        label: 'Add a student',    done: !!steps.add_student },
  { key: 'generate_worksheet', label: 'Prepare a lesson', done: !!steps.generate_worksheet },
  { key: 'create_homework',    label: 'Send homework',    done: !!steps.create_homework },
]
```
`create_homework` pozostaje deprecated w `ACTIVE_KEYS` (procent w `OnboardingChecklist` bez zmian); `checkSteps` w `useOnboardingProgress` musi nadal ustawiać `create_homework` — sprawdzić, czy istnieje detekcja (`homework_assignments` count > 0); jeśli została usunięta, przywrócić jako jedno zapytanie `head: true`.

---

## Faza 4 — nowa trasa `/students` (`src/pages/AllStudentsPage.tsx`)

Przejmuje funkcje usunięte z dashboardu bez N+1.

- Dane: `useStudents()` + jedno zapytanie agregujące `useStudentsOverview(ids)`:
  ```ts
  supabase.from('worksheets').select('student_id').eq('teacher_id', teacherId).is('deleted_at', null).in('student_id', ids)
  ```
  → mapa `worksheetCountByStudent` (liczenie po stronie klienta; przy >1000 worksheetów użyć `count` per uczeń dopiero po kliknięciu — na dziś limit 1000 wystarcza, odnotować w komentarzu). Plus reużycie `useNextUpStudents(students, students.length)` dla następnej lekcji.
- UI: `StickyNav` (z `NavStudentSwitcher` — trasa ≠ `/dashboard`, więc pamięć na to pozwala), nagłówek `Students (n)` + `Add student`, pole `Input` „Search students…” (`aria-label`), `Select` sortowania: `Recently active` (domyślnie) / `Name A–Z` / `Name Z–A` / `Next lesson`.
- Lista: `<ul className="divide-y divide-border rounded-lg border border-border">`, wiersz `StudentRow`: imię (link), `Badge` poziomu, cel (`formatGoal`), `Next: Tue 18:00` lub `—`, `{n} worksheets`, po prawej `Button variant="ghost" size="sm"` → `Open`. Bez zwijania, bez własnych hooków w wierszu.
- Stan pusty i „No students matching …” jak dziś.
- `PageSeo`: `title="Students — Edooqoo"`, `noindex` (strona zalogowanego).
- `App.tsx`: `<Route path="/students" element={<AllStudentsPage />} />` (lazy, obok `/worksheets`).
- `StudentCard.tsx`: po zmianie nieużywany na dashboardzie; sprawdzić `rg StudentCard` — jeśli brak innych importów, usunąć.

---

## Faza 5 — `/profile`: karta „Usage”

W `src/pages/Profile.tsx` między kartą „Token Usage Details” a „Plan & Billing”:
```tsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5" />Usage</CardTitle>
    <CardDescription>Your activity at a glance</CardDescription>
  </CardHeader>
  <CardContent>
    <CompactStatsBar variant="list" tokenLeft={...} thisMonthCount={thisMonthCount} totalWorksheets={profile?.total_worksheets_created ?? 0} studentsCount={students.length} activeHomeworkCount={activeHomework} upcomingLessonsCount={upcoming} />
    <p className="mt-4 text-xs text-muted-foreground">Student Hub: your students log in with just their email at <a href="https://edooqoo.com/my" ...>edooqoo.com/my</a>.</p>
  </CardContent>
</Card>
```
Hooki w Profile: `useWorksheetStats` (przenosi się tu z dashboardu), `useStudents`, `useUpcomingLessonsCount`, `activeHomework` — jedno zapytanie `homework_assignments` `count: 'exact', head: true` z `is('completed_at', null)` (zamiast dotychczasowego liczenia z pełnej listy).

`AddStudentDialog.tsx`: pod polem e-mail jedno zdanie `text-xs text-muted-foreground`: „With an email, your student gets access to worksheets, homework and flashcards at edooqoo.com/my — no password needed.” (informacja o Hubie przenosi się tam, gdzie nauczyciel podejmuje decyzję).

---

## Faza 6 — `App.tsx` i `UnifiedBell`

- `OnboardingChecklist`: renderować warunkowo — utworzyć mały wrapper `OnboardingChecklistGate` z `useLocation()`; `if (pathname === '/dashboard') return null; return <OnboardingChecklist />;`. Na innych trasach bez zmian.
- `UnifiedBell.tsx`: `useEffect` z listenerem `unifiedBell:open` → `setOpen(true)`.

---

## Faza 7 — dane demo (`src/data/demoData.ts`)

Aby `/demo` pokazywał pełny Today:
- `calendarSlots`: upewnić się, że dla 2 z 3 uczniów istnieje slot `status: 'booked'` z `slot_date` w najbliższych 7 dniach (generować relatywnie do `new Date()`, nie na sztywno).
- `knowledgeEntries`: dla każdego z 3 uczniów co najmniej 1 wpis `category: 'Skill Assessment'`, `metadata.skill_subtype: 'weakness'`, `title` np. `Past simple vs present perfect`, `Articles a/an/the`, `Linking words in emails`.
- `homework`: 1 wpis z `completed_at` ustawionym, `reviewed_at: null`, `student_id` pierwszego ucznia, `title: 'Phrasal verbs — follow-up'`.
- `teacher.onboarding_progress` pozostaje `completed: true` (demo nie pokazuje Guided mode).

---

## Faza 8 — porządki

Usunąć po potwierdzeniu `rg` braku importów: `NextPrepStrip.tsx`, `StudentCard.tsx`, `WorksheetHomeworkList.tsx` (uwaga: `AllWorksheetsPage.tsx` i `WorksheetHomeworkSection.tsx` go importują — **zostaje**, usuwamy tylko import z dashboardu). Zaktualizować `mem://features/dashboard/compact-stats-bar` (użycie w Profile) i dodać `mem://features/dashboard/today-layout`.

---

## Kolejność commitów (każdy zostawia aplikację działającą)

1. Faza 0 (docs + roadmap).
2. Faza 1 (3 hooki + `formatGoal` lib) — bez użycia w UI; typecheck.
3. Faza 2 komponenty + Faza 3 Dashboard — jeden commit, bo dashboard bez komponentów nie ma sensu.
4. Faza 4 `/students`.
5. Faza 5 Profile + AddStudentDialog.
6. Faza 6 App/UnifiedBell + Faza 7 demo.
7. Faza 8 porządki + RAG.

---

## Weryfikacja (Playwright, `/demo`, 1280 i 390 px)

1. `document.querySelectorAll('main button, main a, main input').length ≤ 14` przy 3 uczniach i zwiniętych Recent worksheets.
2. Liczba przycisków z tekstem `Prepare next lesson` = 3; żaden inny przycisk w `main` nie ma klasy wariantu `default` (sprawdzić przez brak `bg-primary` poza tymi trzema).
3. Kolejność kart Next up = kolejność dat slotów demo; trzecia karta ma `No lesson booked`.
4. Sekcja `Needs your attention (1)` zawiera wiersz homework z linkiem `/homework/<id>/review`.
5. Po podmianie `demoData.homework` na `[]` sekcja B nie istnieje w DOM.
6. `/students`: wyszukiwarka filtruje; sortowanie `Next lesson` działa. `/profile`: karta Usage z 6 wartościami.
7. 390 px: `document.documentElement.scrollWidth === window.innerWidth`; brak `.fixed` karty onboardingu na `/dashboard`.
8. Guided mode: test jednostkowy `guidedSteps()` + render `Dashboard` z mockiem `useOnboardingProgress` (`generate_worksheet: false`) → widoczny `GuidedStepsBar`, brak kafla Worksheets.
9. Test jednostkowy `aggregateNextUp()` (3 przypadki: z lekcją, bez lekcji, bez sygnału) i mapowania `useDashboardAttention` (3 rodzaje).
10. `bunx tsgo --noEmit -p tsconfig.app.json` = 0; konsola bez ostrzeżeń React na `/dashboard`.

---

## RAG

- `docs/llm-context.md`: sekcja `## v6.9.109 — Dashboard "Today" layout — PRODUCTION` w formacie PROBLEM / EDOOQOO SOLUTION / TECHNICAL MECHANICS (hooki, komponenty, `/students`, Guided mode, przeniesienie statystyk) / RAG KEYWORDS (15).
- `public/llms.txt`: aktualizacja jednego zdania opisu dashboardu w sekcji produktu; struktura pliku bez zmian.
- Nowe: `docs/ux/target-teacher-experience.md`, `docs/ux/dashboard-today-spec.md`.

## Poza zakresem

Strona ucznia, `StickyNav`, `CalendarPage`, `UnifiedBell` poza jednym listenerem, silnik worksheetów, DSLM, migracje, RLS, SEO.
