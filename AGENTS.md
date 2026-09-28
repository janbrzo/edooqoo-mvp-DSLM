# AGENTS.md — Technical Rules

One rule per entry, with a one-line why. Replace an existing rule instead of adding a second one on the same topic.

## Student Workspace

- Student Workspace tab state lives only in the URL and is resolved via `src/lib/students/workspaceTabs.ts`; legacy `?tab=` aliases are permanent — because sent emails and bookmarks carry them.
