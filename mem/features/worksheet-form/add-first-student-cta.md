---
name: Worksheet form add-first-student CTA
description: Authenticated teachers with zero students see clickable Add CTA instead of locked tooltip
type: feature
---

In `src/components/WorksheetForm/index.tsx`, the student selector slot has three states:

1. `userId && students.length > 0` → real `<Select>` with `No student (generic)` + truncated student items.
2. `userId && students.length === 0` → clickable dashed-border anchor `<a href="/dashboard?action=add-student">Add your first student</a>`. Dashboard auto-opens AddStudentDialog from this query (see v6.9.8).
3. `!userId` (anon) → original `Lock` tooltip "Log in to assign worksheets to students".

Never collapse states 2 and 3 back into a single locked tooltip. Anon UX and teacher-zero-students UX have different intents.

Selector item label is `No student (generic)` — short to fit the 23%-width column. All `<SelectItem>` content uses `truncate`.
