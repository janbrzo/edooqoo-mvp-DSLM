---
name: Student Knowledge Quick Capture + AI Classify
description: v6.9.8 frictionless note input — teacher writes free text, AI classifies via Lovable AI Gateway in background; never blocks teacher
type: feature
---
Quick Add modal = textarea + optional tags only. `useStudentKnowledge.addEntry` inserts as `category='Notes'` then fire-and-forgets `classify-knowledge-entry` edge function (`google/gemini-2.5-flash`, tool-call schema). Patches row when `confidence>=0.6`. Columns: `ai_classified`, `ai_confidence`, `archived_at`, `used_in_worksheet_id`. Advanced metadata editing stays in `StudentKnowledgeSidePanel`.

v6.9.9 additions: `StudentKnowledgeSection` exposes 3 tabs — Timeline / By Skill (groups Skill Assessment by `metadata.nano_skill`) / For Next Lesson (uses `useOneMinutePrep`). EntryCard shows `Sparkles "AI organized"` badge when `ai_classified && ai_confidence >= 0.6`. Manual archive button on `Next Lesson Ideas` cards calls `archiveEntry(id)` → sets `archived_at`; `useOneMinutePrep` filters `archived_at IS NULL` so they disappear from prep view.

**How to apply**: never re-introduce required category picker in Quick Add. Auto-link `used_in_worksheet_id` from worksheet generation pipeline is intentionally NOT implemented (manual button only) to avoid touching `worksheetService`.
