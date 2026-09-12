# M1 — `workspaceTabs.ts` + alias tests (no UI)

Phase M1 of the Student Workspace (v6.9.111). One new pure module and one test file. No component, route, or visual change. After M1 the app looks and behaves exactly as today; M7 is the phase that plugs the module into `StudentPage`.

Scope guard: nothing in `src/pages/StudentPage.tsx`, no route change, no `studentPrepPath()` change (that moves to `?tab=prep` in M7), no worksheet engine, no backend.

---

## 1. What this module is for

Every `?tab=` link that exists in emails, bookmarks, notification handlers and internal navigation has to keep landing on a meaningful screen after the page drops from 7 (+4 hidden) tabs to 4. M1 builds that translation layer as a single pure function, fully unit-tested, before any UI depends on it. The rule is: one place decides what a URL means, and it is testable without a browser.

---

## 2. New file: `src/lib/students/workspaceTabs.ts`

Pure TypeScript. No React, no Supabase, no `window`. Mirrors the style of `quickAccess.ts`.

### 2.1 Exported types

```ts
export type WorkspaceTab = 'prep' | 'timeline' | 'library' | 'model';
export type LibrarySection = 'worksheets' | 'flashcards' | 'homework';
export type TimelineFilter =
  | 'all' | 'lessons' | 'worksheets' | 'homework' | 'notes' | 'tests';

export interface ResolvedTab {
  tab: WorkspaceTab;
  section?: LibrarySection;
  filter?: TimelineFilter;
  view?: string;
  changed: boolean;
}
```

`changed` is `true` whenever the raw input was not already a canonical tab value (legacy alias, unknown value, or missing). M7 uses it as the single condition for a `replace: true` URL rewrite, so history never grows and Back never loops.

### 2.2 Exported constants

- `WORKSPACE_TABS: readonly WorkspaceTab[]` — `['prep','timeline','library','model']`, the render order of the tab strip.
- `TAB_ALIASES: Record<string, { tab, section?, filter?, view? }>` — the full legacy map, exactly as specified:

| legacy | tab | extras |
|---|---|---|
| `overview` | `prep` | — |
| `dslm` | `model` | — (caller keeps `view`/`focus` from the URL) |
| `1minute` | `model` | — |
| `progress` | `model` | `view=pathway` |
| `skills` | `model` | `view=skills` |
| `knowledge` | `model` | `view=profile` |
| `events` | `model` | `view=profile` |
| `worksheets` | `library` | `section=worksheets` |
| `flashcards` | `library` | `section=flashcards` |
| `homework` | `timeline` | `filter=homework` |
| `tests` | `timeline` | `filter=tests` |
| `calendar` | `timeline` | `filter=lessons` |

- `PRESERVED_PARAMS: readonly string[]` — `['set','intake','view','focus','testId','_']`. Params that must survive any rewrite.
- `DEFAULT_TAB: WorkspaceTab` = `'prep'`.

### 2.3 Exported functions

```ts
export function isWorkspaceTab(value: string | null | undefined): value is WorkspaceTab;
export function resolveTab(raw: string | null | undefined): ResolvedTab;
export function resolveWorkspaceParams(params: URLSearchParams): {
  resolved: ResolvedTab;
  next: URLSearchParams;
  changed: boolean;
};
export function studentTabPath(studentId: string, tab: WorkspaceTab, extra?: Record<string, string>): string;
```

Behaviour, decided now so implementation has no open questions:

1. `resolveTab` trims and lowercases the input before matching, so `?tab=DSLM` and `?tab=%20tests` resolve correctly.
2. Canonical values pass through untouched with `changed: false` and no extras.
3. Known aliases return the mapped tab plus their extras with `changed: true`.
4. `null`, `''`, and unknown strings return `{ tab: 'prep', changed: true }`.
5. `resolveTab` never throws and never reads global state.

`resolveWorkspaceParams` is the URL-level wrapper M7 will call with the live `searchParams`:

- reads `tab`, runs `resolveTab`;
- builds `next` containing `tab=<canonical>`, then the resolved `section`/`filter`/`view` when the alias supplies one, then every param from `PRESERVED_PARAMS` present in the input;
- a `view` already present in the input wins over an alias-supplied `view`, so `?tab=dslm&view=goals&focus=add-goal-modal` (AddStudentDialog, OnboardingChecklist) keeps landing on the goals sub-view with its spotlight intact;
- a `section`/`filter` already present and valid in the input wins over the alias default;
- `changed` is `true` when the serialized `next` differs from the serialized input, compared on sorted key/value pairs so param order alone never triggers a rewrite;
- input `URLSearchParams` is never mutated; a new instance is returned.

`studentTabPath` produces canonical links for later phases: `/student/<id>?tab=<tab>` plus any extras, so no component has to hand-build query strings again.

---

## 3. New file: `src/lib/students/__tests__/workspaceTabs.test.ts`

Vitest, same shape as `quickAccess.test.ts`. Coverage, roughly 30 cases:

1. Each of the four canonical values resolves to itself with `changed: false`.
2. Every one of the twelve aliases resolves to the tab and extras in the table — one assertion per row, so a future edit to the map cannot silently drop a route.
3. `null`, `''`, `'   '`, `'nonsense'` → `prep`, `changed: true`.
4. Case and whitespace: `'DSLM'`, `' tests '` resolve like their clean forms.
5. `resolveWorkspaceParams` preserves each param in `PRESERVED_PARAMS`: `?tab=flashcards&set=abc` → `tab=library&section=flashcards&set=abc`; `?tab=tests&testId=t1` → `tab=timeline&filter=tests&testId=t1`.
6. Explicit `view` beats alias `view`: `?tab=progress&view=goals` keeps `view=goals`.
7. Idempotence: feeding the output of `resolveWorkspaceParams` back in returns `changed: false` — this is the property that guarantees no rewrite loop in M7.
8. Canonical input with no extras leaves the params untouched (`changed: false`).
9. `studentTabPath('abc','prep')` → `/student/abc?tab=prep`; with extras → appended in a stable order.

Run: `bunx vitest run src/lib/students/__tests__/workspaceTabs.test.ts`.

---

## 4. Real-URL check against current producers

The test file includes one table-driven case per URL shape actually emitted in the project today, so M1 proves compatibility before any UI moves:

| producer | URL | expected |
|---|---|---|
| welcome-test email, `UnifiedBell`, `useDashboardAttention`, `HomeworkNotificationBadge`, `WelcomeTestPage` | `?tab=tests` | `timeline` + `filter=tests` |
| `WelcomeTestSuggestion` | `?tab=tests&testId=x` | `timeline` + `filter=tests` + `testId=x` |
| `quickAccess`, `NextUpCard`, `SlotDetailModal`, `PacingProposalsBell` | `?tab=dslm` | `model` |
| `NextStepsPresetBanner` | `?tab=dslm&view=pathway` | `model` + `view=pathway` |
| `AddStudentDialog` | `?tab=dslm&view=goals&focus=add-goal-modal&_=1` | `model` + `view=goals` + `focus` + `_` |
| `OnboardingChecklist` | `?tab=dslm&view=pathway&focus=pick-idea` | `model` + `view=pathway` + `focus` |
| `ViewFlashcardSetsModal` | `?tab=flashcards` | `library` + `section=flashcards` |
| bookmarks | `?tab=overview` / `?tab=worksheets` / `?tab=homework` / `?tab=calendar` | `prep` / `library+worksheets` / `timeline+homework` / `timeline+lessons` |

---

## 5. Verification

1. `bunx tsgo --noEmit -p tsconfig.app.json` — clean.
2. `bunx vitest run src/lib/students/` — new suite plus the existing 12 `quickAccess` tests green.
3. Manual confirmation that no other file imports the new module yet (`rg -n "workspaceTabs" src/` returns only the module and its test).
4. `/demo` unchanged — M1 touches no rendered code; the Playwright pass is a regression guard only.

## 6. Out of scope for M1

`StudentPage.tsx` edits, tab strip changes, `studentPrepPath()` change, `React.lazy`, RAG updates (`docs/llm-context.md`, `public/llms.txt`, memory — all reserved for M8). `roadmap.md` M1 checkbox is ticked at the end of this phase.
