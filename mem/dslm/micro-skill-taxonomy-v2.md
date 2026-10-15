---
name: Micro-skill taxonomy v2
description: Pillar 1.1 decision, extract_micro_skill changes are additive only; existing rules never reordered or changed
type: constraint
---
- extract_micro_skill v2 (Pillar 1.1, 2026-10-15) only adds rules that catch names v1 sent to grammar_other/other.
- Never change or reorder an existing rule: a skill name must never move between two real topics, or metrics split.
- New micro skills: used_to_would, question_forms, subject_verb_agreement, parts_of_speech, telephoning, negotiation, email_register, diplomatic_language, meetings, presentations, business_communication, functional_language.
- After a taxonomy change, re-sync stored student_skill_metrics.micro_skill only for rows leaving grammar_other/other. Guarded by src/lib/__tests__/microSkillTaxonomyV2.test.ts.
