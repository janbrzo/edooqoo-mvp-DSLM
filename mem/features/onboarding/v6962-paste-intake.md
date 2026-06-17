---
name: AI Paste-Intake for New Students
description: v6.9.62 — opt-in "Paste notes" toggle in AddStudentDialog calls extract-student-profile (Lovable Gateway, gemini-2.5-flash) and applies via atomic apply_intake_extraction RPC into existing entities, with audit + undo-all via student_intake_extractions.
type: feature
---
- Edge function `extract-student-profile` is PURE-EXTRACT (no DB writes); returns `{extraction, model}` for client preview.
- AddStudentDialog renders `<PasteIntakeSection>` (opt-in Switch, independent of know/defer mode). After `addStudent` succeeds, calls `applyIntakeExtraction` which wraps SECURITY DEFINER RPC `apply_intake_extraction(p_student_id, p_payload, p_includes, p_raw_text, p_model)`.
- RPC is atomic: notes/signals → `student_knowledge_entries` (entry_source='ai-suggested', tags includes 'intake_paste'); goals → `student_progress_goals` with `source='ai_paste_intake'` and `accepted_at=now()` only when confidence>=0.75 else NULL; english_level / main_goal / main_goal_target_date / native_language → UPDATE `students` only when target field is NULL (or native default 'Spanish') AND confidence>=0.75 (native: 0.8); pacing always lands as `pacing_proposals.status='pending'` with `trigger_type='manual'`, `trigger_details.source='ai_paste_intake'`. 60-second per-student throttle enforced server-side.
- Audit row in `student_intake_extractions` stores raw_text + extracted_json + created_entry_ids[] + created_goal_ids[] + created_pacing_proposal_id + applied_student_updates jsonb + pre_update_snapshot jsonb + status (applied|rolled_back). RLS scopes to `auth.uid()`.
- Rollback RPC `rollback_intake_extraction(p_extraction_id)` soft-archives entries/goals (archived_at=now), flips pending pacing proposal to rejected, restores students fields from pre_update_snapshot.
- StudentPage mounts `<IntakeExtractionBanner>` when `?intake=<id>` is present.
- HOW TO APPLY: never write DB rows from the edge function; never auto-apply pacing; always preserve evidence_quote verbatim from the paste; demo mode blocks via `useDemoContext.showDemoBlockedToast`.
