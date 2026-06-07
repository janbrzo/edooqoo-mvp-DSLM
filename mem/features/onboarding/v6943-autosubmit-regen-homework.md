---
name: v6.9.43 — Auto-submit, retake email, regen-roadmap UX, homework modal collapse
description: Direct-submit bypass for 1-Minute Prep auto-generate, retake-aware email subject/body, stack-first Welcome Test banners, confirm + isRegeneration for roadmap regen, Collapsible sections in Create Homework modal.
type: feature
---

## P1 — Auto-submit from 1-Minute Prep
`WorksheetForm` auto-submit gate and 1500 ms watchdog no longer call `formRef.current?.requestSubmit()` (silently blocked by HTML5 validation on required `<select>` / inputs). They call `submitForm(topic)` directly, with topic recovered from state → sessionStorage → DOM `[name="lessonTopic"]`. `<form>` also gains `noValidate`.

## P2 — Welcome Test retake email + banner layouts
- `sendWelcomeTestEmail` accepts `attemptNumber`; pushes `retakeNumber` to `send-test-email`. Subject becomes `… sent you a retake (Retake N) of the Welcome Test`; HTML body gets a purple `This is Retake N.` info box above the standard content. Call sites: `StudentTestsTab.runRetake`, `WelcomeTestSuggestion.handleRetake`, `TestDetailsView.handleRetake`.
- `WelcomeTestSuggestion` + `StudentTestsTab` retake card switched to stack-first layout: icon+title+status row → URL truncate row → actions row with `flex-wrap` (right-aligned on `sm`/`lg`). `47/58 answered` moved inline next to status badge.

## P3 — Regenerate Learning Roadmap
- `GenerateRoadmapDialog` accepts `isRegeneration`; title `Regenerate Learning Roadmap`, archive-warning description, CTA `Regenerate roadmap`.
- `MacroTimeline.openRegenFlow` opens an `AlertDialog` (when `phases.length > 0`) before the guided dialog. Empty state still goes directly to the guided dialog.
- Duplicate `GenerateRoadmapDialog` mount removed (the empty-state branch instance). Only the bottom mount remains, parameterised with `isRegeneration={phases.length > 0}`.
- Variability of regenerated phases (3A in original plan) intentionally NOT implemented per user instruction.

## P4 — Create Homework modal fits 1080p
`CreateHomeworkModal` introduces local `HomeworkSection` (Collapsible). Sections: Student (open), Exercises from Worksheet (open), Generate Additional Exercises (closed), Deadline (closed), Reminder (closed). Each header shows a summary chip so collapsed state still communicates context.

## Sanctity
No Worksheet Generation Engine, generation prompt, RLS, DB schema, pacing, or auth changes.

RAG keywords: requestSubmit blocked HTML5 validation, submitForm direct call, noValidate worksheet form, retakeNumber send-test-email, purple retake banner, sendWelcomeTestEmail attemptNumber, stack-first welcome test banner layout, isRegeneration GenerateRoadmapDialog, openRegenFlow AlertDialog, duplicate dialog removed MacroTimeline, HomeworkSection Collapsible.