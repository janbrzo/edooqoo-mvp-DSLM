---
name: Homework and worksheet answer autosave
description: Per-exercise debounced autosave with flush on submit; fixes lost answers
type: feature
---
- Autosave is a 1.5 s debounce per exercise (`createPendingSaves`, src/lib/answers/pendingSaves.ts), used by useInteractiveHomework and useInteractiveSharedWorksheet.
- Editing exercise B never cancels the pending save of exercise A; blur saves the current exercise directly.
- `submitHomework` flushes every pending save before `submit_homework_answers`; unmount flushes too.
- Found on a QA run: fast clicks across exercises lost odd-one-out and multiple choice answers (single shared timer, no flush on submit).
- Covered by src/lib/answers/__tests__/pendingSaves.test.ts.
