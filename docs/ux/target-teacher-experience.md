# Target Teacher Experience — "One Job Per Screen"

Status: NORTH STAR — approved 2026-09-02
Scope: authenticated teacher surfaces (`/dashboard`, `/student/:id`, deep views). Student Hub (`/my`) is out of scope.

This document is the single reference for every UX plan touching the authenticated teacher app. Sprint-level specs (e.g. `dashboard-today-spec.md`) refine it; they must not contradict it.

---

## 1. Diagnosis

Teachers report that they "do not fully understand how Edooqoo works" after logging in. The cause is not feature count — every element is relevant to 1-Minute Prep — but the absence of hierarchy.

Verified current state:

- `/dashboard` renders in parallel: a 6-tile stats bar, a "Next Prep" strip, two equal-weight columns (students with search/sort; worksheets with 5 action icons per card), collapsible homework lists, banners, and a sticky nav with its own generate CTA.
- `/student/:id` shows 7 equal tabs (Overview, 1 MINUTE, Worksheets, Homework, Flashcards, Calendar, Tests) plus 4 more tab panels reachable only by code (progress, skills, knowledge, events). Below the `lg` breakpoint the 7 tabs collapse to 7 unlabeled icons.
- The Overview tab alone is a full screen: welcome-test banner, 1-Minute Prep card, Student Hub banner, a 3-column grid of cards including edit and type-to-confirm delete.
- The "1 MINUTE" tab opens the DSLM view: ~450 lines, ~30 sub-components, its own always-visible sub-navigation.
- The same capability is named three ways in one view: "1 MINUTE" (tab), DSLM (feature), "1-Minute Prep" (promise / card).

Root cause (one sentence): the interface is organised around **system objects** (students, worksheets, homework, flashcards, calendar, DSLM) instead of the teacher's **single recurring ritual** — "prepare the next lesson for this student in a minute" — so every screen asks the teacher to assemble the process from equal-weight drawers.

The most prominent element of the product promise ("1 MINUTE", second tab) leads to the most complex view in the product. That inversion is the core defect.

---

## 2. Principles (non-negotiable during implementation)

1. **One job per screen.** Every screen answers "what am I doing here" in one sentence; everything else is visually subordinate.
2. **Ritual, not modules.** Navigation mirrors the weekly teacher cycle (prepare → teach → close), not the data model.
3. **Progressive disclosure, never deletion.** Nothing is removed. Advanced surfaces move one level deeper and stay one click away.
4. **One primary action per screen.**
5. **One name per thing.** "1-Minute Prep" is the ritual. "Learning model" is DSLM. The tab label "1 MINUTE" disappears.
6. **New teachers see less than experienced ones.** Disclosure is driven by usage, not by instructions.
7. **A number appears only when it drives a decision.**

---

## 3. Information architecture — three levels

```text
LEVEL 1  TODAY              "what do I do now"          /dashboard
LEVEL 2  STUDENT WORKSPACE  "everything about them"      /student/:id
LEVEL 3  DEEP VIEWS         "proof and archive"          /student/:id/model, /students, /worksheets, /calendar, /profile
```

Homework, flashcards, tests, progress, knowledge and events stop being top-level navigation entities. They become layers inside Level 2.

---

## 4. Level 1 — `/dashboard` → "Today"

One job: **point the teacher to the next move.** Single column, three zones.

1. **Next up** — 1–3 student cards ordered by next booked lesson (fallback: last activity). Card: name, lesson time, one line "what was hard recently", one button **Prepare next lesson**. This is the only primary CTA on the page.
2. **Needs your attention** — max 5 items that require a reaction (submitted homework to review, completed Welcome Test, new booking). One action each. Empty → the zone does not render.
3. **Everything else** — one quiet row: `All students · Worksheets · Calendar`, plus a collapsed "Recent worksheets" list.

Moves: the 6-tile stats bar goes to `/profile` as "Usage" (tokens stay in the nav because they are a constraint, not a statistic). Student search/sort moves to `/students`. Worksheet card actions collapse into one `…` menu.

Empty state (0 students): one block, one primary action — "Add your first student" — with a secondary "See a sample student".

Detailed spec: `docs/ux/dashboard-today-spec.md`.

---

## 5. Level 2 — `/student/:id` → "Student Workspace"

One job: **prepare the next lesson and close the previous one.**

Three tabs plus a persistent context panel instead of 7 (+4 hidden) tabs:

```text
┌──────────────────────────────────────────────┬────────────────────┐
│  Anna Kowalska · B1 · next lesson Tue 18:00  │  STUDENT SNAPSHOT  │
│  [ Prep ]   [ Timeline ]   [ Library ]       │                    │
├──────────────────────────────────────────────┤  Level  B1         │
│                                              │  Goal   job intervw│
│   active tab content                         │  Deadline  12 Nov  │
│                                              │  Focus areas       │
│                                              │   · past simple    │
│                                              │   · phrasal verbs  │
│                                              │   · fluency        │
│                                              │  [Full learning    │
│                                              │   model →]         │
└──────────────────────────────────────────────┴────────────────────┘
```

- **Prep** (default; ~90% of time spent here). The only place a lesson is created: proposed next topic (today's `OneMinutePrepCard` + Next Lesson Ideas merged into one card), one primary **Generate worksheet** button, last worksheet with "Reuse / Continue", quick "Add note", welcome-test banner only when the profile is empty. Student Details, edit/delete, Hub info, meeting link and email settings move to the snapshot panel's `…` menu — they are settings, not work.
- **Timeline**. One chronological stream: lessons, generated worksheets, homework sent/returned, teacher notes, test results, mastery changes. Replaces the Homework, Tests, Calendar (student part) and Events tabs. Event-type filters as pills above the stream, not separate tabs.
- **Library**. This student's worksheets, flashcards, assigned homework. Archive and reuse; list density, not cards.
- **Student snapshot** (always visible on desktop, collapsible on mobile). Level, goal, deadline, three focus areas, link **Full learning model →**.

DSLM becomes a dedicated full-screen view ("Learning model") entered deliberately from the snapshot. Nothing is lost; it stops being the second tab a new teacher opens out of curiosity and bounces off.

---

## 6. Level 3 — Deep views

`/students` (full list with search/sort), `/worksheets`, `/calendar`, `/profile` (subscription, tokens, usage, integrations), `/student/:id/model` (DSLM). Visited rarely and on purpose. No conceptual change.

---

## 7. Guided mode (new accounts)

Signal: existing `profiles.onboarding_progress` (no new column). `guided = !completed && !dismissed && !steps.generate_worksheet`.

- Dashboard shows only Next up + Add student; "Worksheets" and "Recent worksheets" appear after the first generated worksheet.
- Student page starts with the Prep tab only; Timeline and Library unlock after the first worksheet.
- Snapshot shows only level and goal; "Full learning model" appears once there is a week of data.
- A three-step bar in the header: **1 Add a student → 2 Prepare a lesson → 3 Send homework**. Disappears when complete and never returns.
- "Show everything" disables guided mode permanently at any time.

---

## 8. Visual layer

- **Card = unit of work. List = archive.** Nothing in between.
- **Colour only for meaning.** Primary only on "Prepare / Generate". Amber = needs attention. Destructive only inside `…` menus, never as a visible trash icon next to a title.
- **Typography instead of frames.** A section is a heading plus spacing, not another `Card` inside a `Card`.
- **Icons always labelled** at Levels 1 and 2. Icon-only controls are allowed only in archives (Level 3).
- **Empty states are content**: each one says what to do to fill it.
- Semantic tokens only (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`). No `text-white`, `bg-white`, `text-gray-*`, `text-green-*`.

---

## 9. Success metrics

| Metric | Today | Target |
|---|---|---|
| Tabs on the student page | 7 visible (11 in code) | 3 + panel |
| Interactive elements on the first student screen | ~35 | < 12 |
| Interactive elements on `/dashboard` (3 students, recent list collapsed) | ~40 | ≤ 14 |
| Clicks from login to a generated lesson | 3–5 | 1–2 |
| Primary actions on the dashboard | ~5 | 1 |
| UI names for the same capability | 3 | 2 (1-Minute Prep, Learning model) |

Martha Test for this direction: a tutor with ten years of experience who has never seen Edooqoo opens a student page and knows, without reading anything, what to click to prepare tomorrow's lesson.

---

## 10. Sequencing

1. Dashboard → Today (`dashboard-today-spec.md`, v6.9.109).
2. Student Workspace: 7 tabs → 3 + snapshot, DSLM as a deep view.
3. Guided mode beyond the dashboard.
4. Visual pass (colour, typography, empty states) as a layer over the above.

Out of scope for all of the above: the worksheet generation engine, DSLM logic (entry point changes only), backend, RLS, migrations, SEO, Student Hub.
