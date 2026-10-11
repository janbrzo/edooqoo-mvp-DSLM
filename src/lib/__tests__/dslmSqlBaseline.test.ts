import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The DSLM event and metric engine lived only in the production database.
 * Every function and trigger of that pipeline must have a definition in
 * supabase/migrations so changes are reviewable (AGENTS.md, Answers & Evaluation).
 */
const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
  .join('\n');

const PIPELINE_FUNCTIONS = [
  'add_student_event', 'compute_skill_metric', 'refresh_skill_metrics_on_event', 'backfill_skill_metrics',
  'extract_skill_category', 'extract_micro_skill',
  'log_homework_answer_to_events', 'log_worksheet_answer_to_events', 'log_flashcard_review_event',
  'log_knowledge_entry_event', 'log_test_answer_event', 'update_homework_event_with_ai_evaluation',
  'save_homework_answer', 'save_worksheet_answer', 'get_student_homework_answers', 'get_worksheet_student_answers',
  'get_worksheet_live_answers', 'needs_ai_evaluation', 'queue_worksheet_ai_evaluation',
  'update_homework_answer_by_share_token', 'log_homework_submitted_event', 'log_welcome_test_event_by_share_token',
  'save_flashcard_progress',
  'save_homework_answer_by_share_token', 'get_student_homework_answers_by_share_token',
  'save_worksheet_answer_by_share_token', 'get_worksheet_student_answers_by_share_token',
];

const PIPELINE_TRIGGERS = [
  'trg_refresh_skill_metrics', 'trg_homework_answer_to_events', 'trg_worksheet_answer_to_events',
  'trigger_log_flashcard_review_event', 'trigger_log_knowledge_entry_event', 'trigger_log_test_answer_event',
];

describe('DSLM pipeline SQL is versioned in migrations', () => {
  it.each(PIPELINE_FUNCTIONS)('function %s is defined', (fn) => {
    expect(sql).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`, 'i'));
  });

  it.each(PIPELINE_TRIGGERS)('trigger %s is defined', (tg) => {
    expect(sql).toMatch(new RegExp(`CREATE TRIGGER ${tg}\\b`, 'i'));
  });
});
