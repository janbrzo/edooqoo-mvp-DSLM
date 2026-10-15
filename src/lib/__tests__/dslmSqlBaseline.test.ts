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
  'add_student_event', 'add_student_event_internal', 'compute_skill_metric', 'refresh_skill_metrics_on_event', 'backfill_skill_metrics',
  'extract_skill_category', 'extract_micro_skill',
  'log_homework_answer_to_events', 'log_worksheet_answer_to_events', 'log_flashcard_review_event',
  'log_knowledge_entry_event', 'log_test_answer_event',
  'save_homework_answer', 'save_worksheet_answer', 'get_student_homework_answers', 'get_worksheet_student_answers',
  'get_worksheet_live_answers', 'needs_ai_evaluation', 'queue_worksheet_ai_evaluation',
  'update_homework_answer_by_share_token', 'log_homework_submitted_event', 'log_welcome_test_event_by_share_token',
  'save_flashcard_progress',
  'save_homework_answer_by_share_token', 'get_student_homework_answers_by_share_token',
  'save_worksheet_answer_by_share_token', 'get_worksheet_student_answers_by_share_token',
  'save_mark_done_evaluation', 'delete_mark_done_evaluation',
  'submit_homework_answers', 'submit_homework_answers_by_share_token',
  'claim_pending_ai_evaluations', 'list_worksheet_answers_needing_ai_evaluation', 'mark_worksheet_answer_not_evaluable',
  'reconcile_welcome_test_events', 'supersede_previous_welcome_test_events', 'calculate_test_results',
  'list_homework_answers_needing_ai_evaluation', 'claim_homework_answer_ai_attempt', 'mark_homework_answer_ai_not_evaluable',
  'worksheet_answers_differ', 'keep_ai_alternative_ratings',
];

const PIPELINE_TRIGGERS = [
  'trg_refresh_skill_metrics', 'trg_homework_answer_to_events', 'trg_worksheet_answer_to_events',
  'trigger_log_flashcard_review_event', 'trigger_log_knowledge_entry_event', 'trigger_log_test_answer_event',
  'trg_refresh_skill_metrics_on_update', 'trg_refresh_skill_metrics_on_delete',
];

describe('DSLM pipeline SQL is versioned in migrations', () => {
  it.each(PIPELINE_FUNCTIONS)('function %s is defined', (fn) => {
    expect(sql).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`, 'i'));
  });

  it.each(PIPELINE_TRIGGERS)('trigger %s is defined', (tg) => {
    expect(sql).toMatch(new RegExp(`CREATE TRIGGER ${tg}\\b`, 'i'));
  });
});

/** Body of the newest migration that (re)defines a function, by file name order. */
const latestDefinition = (fn: string): string => {
  const re = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`, 'i');
  const file = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
    .filter((f) => re.test(readFileSync(join(MIGRATIONS, f), 'utf8'))).pop();
  return file ? readFileSync(join(MIGRATIONS, file), 'utf8') : '';
};

describe('Mark done supersedes the student event (decision D2)', () => {
  it('the latest compute_skill_metric skips worksheet ratings rated again by Mark done', () => {
    const body = latestDefinition('compute_skill_metric');
    expect(body).toMatch(/se\.event_source = 'worksheet' AND EXISTS/);
    expect(body).toMatch(/md\.event_type = 'mark_done_evaluation'/);
  });
});

describe('Flashcard review events (iteration 4)', () => {
  it('the first review (an INSERT by the upsert) is logged too', () => {
    expect(sql).toMatch(/CREATE TRIGGER trigger_log_flashcard_review_event\s+AFTER INSERT OR UPDATE ON public\.flashcard_progress/);
  });
  it('event mastery is the review outcome; the card state is kept separately', () => {
    const body = latestDefinition('log_flashcard_review_event');
    expect(body).toMatch(/v_raw_mastery := CASE WHEN NEW\.last_quality_rating >= 2 THEN 100 ELSE 0 END/);
    expect(body).toMatch(/'card_state_mastery', v_state_mastery/);
  });
});

describe('Iteration 6: backfill with audit and legacy RPC revoke', () => {
  const read = (f: string) => readFileSync(join(MIGRATIONS, f), 'utf8');
  it('the backfill records every change in dslm_backfill_audit', () => {
    const body = read('20261012200000_dslm_backfill_v1.sql');
    expect(body).toMatch(/CREATE TABLE IF NOT EXISTS public\.dslm_backfill_audit/);
    for (const step of ['A_zero_score_stored_as_70', 'B_welcome_test_event_mastery', 'C_metric_recompute']) {
      expect(body).toContain(step);
    }
  });
  it('the legacy answer RPCs are revoked from client roles only after the token RPCs exist', () => {
    const body = read('20261012200100_revoke_legacy_student_answer_rpcs.sql');
    expect(body).toMatch(/save_homework_answer_by_share_token/);
    expect(body).toMatch(/REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
    for (const fn of ['save_homework_answer', 'get_student_homework_answers', 'save_worksheet_answer', 'get_worksheet_student_answers']) {
      expect(body).toContain(`'${fn}'`);
    }
  });
});

describe('Iteration 7: ownership checks on DSLM write paths', () => {
  const read = (f: string) => readFileSync(join(MIGRATIONS, f), 'utf8');
  const body = read('20261014090000_event_and_homework_answer_access.sql');

  it('add_student_event requires the caller to be the student\'s teacher (or the service role)', () => {
    const fn = latestDefinition('add_student_event');
    expect(fn).toBe(body);
    expect(body).toMatch(/auth\.uid\(\) = p_teacher_id/);
    expect(body).toMatch(/s\.id = p_student_id AND s\.teacher_id = p_teacher_id/);
    expect(body).toMatch(/REVOKE EXECUTE ON FUNCTION public\.add_student_event_internal\([^)]*\) FROM PUBLIC, anon, authenticated/);
  });

  it('wrappers that authorise their own caller use the internal function', () => {
    for (const fn of ['log_homework_submitted_event', 'log_welcome_test_event_by_share_token', 'save_mark_done_evaluation']) {
      // Newest definition may live in a later migration: assert on its body, not on the file.
      const def = latestDefinition(fn);
      const start = def.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`));
      const fnBody = def.slice(start, def.indexOf('$function$;', start));
      expect(fnBody).toContain('public.add_student_event_internal(');
      expect(fnBody).not.toMatch(/public\.add_student_event\(/);
    }
  });

  it('homework answer updates and submits need the share token and the assigned email', () => {
    expect(latestDefinition('update_homework_answer_by_share_token')).toBe(body);
    expect(body).toMatch(/has_homework_student_access\(p_share_token, p_homework_id, p_student_email\)/);
    expect(read('20261014090100_revoke_legacy_submit_homework.sql'))
      .toMatch(/REVOKE EXECUTE ON FUNCTION public\.submit_homework_answers\(uuid, text\) FROM PUBLIC, anon, authenticated/);
  });

  it('the dead homework AI evaluation trigger is dropped', () => {
    expect(body).toMatch(/DROP TRIGGER IF EXISTS trigger_update_homework_ai_evaluation/);
    expect(body).toMatch(/DROP FUNCTION IF EXISTS public\.update_homework_event_with_ai_evaluation\(\)/);
  });
});

describe('Iteration 8: compute_skill_metric v3', () => {
  const read = (f: string) => readFileSync(join(MIGRATIONS, f), 'utf8');
  const fn = latestDefinition('compute_skill_metric');
  const upsert = fn.slice(fn.indexOf('ON CONFLICT (student_id, teacher_id, skill_name) DO UPDATE SET'));

  it('is defined by 20261015090000 (the newest definition)', () => {
    expect(fn).toBe(read('20261015090000_compute_skill_metric_v3.sql'));
  });

  it('serialises recomputes per student, teacher and skill with an advisory lock before reading events', () => {
    expect(fn).toMatch(/pg_advisory_xact_lock\(\s*hashtextextended\(p_student_id::text \|\| '\|' \|\| p_teacher_id::text \|\| '\|' \|\| p_skill_name, 0\)/);
    expect(fn.indexOf('pg_advisory_xact_lock')).toBeLessThan(fn.indexOf('FROM student_events'));
  });

  it('aggregates the ratings of one event and skill into one point', () => {
    expect(fn).toMatch(/AVG\(\(nsr->>'mastery'\)::numeric\) AS mastery_val/);
    expect(fn).toMatch(/GROUP BY se\.id, se\.created_at/);
  });

  it('refreshes first_event_at on conflict', () => {
    expect(upsert).toMatch(/first_event_at = EXCLUDED\.first_event_at/);
  });

  it('reports insufficient_data below 4 points and keeps the +-10 rule', () => {
    expect(fn).toMatch(/v_trend TEXT := 'insufficient_data'/);
    expect(fn).toMatch(/IF v_total_events >= 4 THEN/);
    expect(fn).toMatch(/v_recent_avg > v_older_avg \+ 10/);
    expect(fn).toMatch(/v_recent_avg < v_older_avg - 10/);
  });

  it('keeps the history ascending with the last 20 points and the date key', () => {
    expect(fn).toMatch(/ORDER BY l\.created_at, l\.event_id\), '\[\]'::jsonb\)/);
    expect(fn).toMatch(/ORDER BY p\.created_at DESC, p\.event_id DESC\s+LIMIT 20/);
    expect(fn).toMatch(/'date', to_char\(l\.created_at, 'YYYY-MM-DD'\)/);
    expect(fn).toMatch(/'event_id', l\.event_id/);
    expect(fn).not.toMatch(/ORDER BY elem->>'date'/);
  });

  it('Mark done supersedes the whole exercise: any rated item, not only the same skill', () => {
    const md = fn.slice(fn.indexOf("md.event_type = 'mark_done_evaluation'"));
    const clause = md.slice(0, md.indexOf(')\n    )\n  GROUP BY'));
    expect(clause).toMatch(/md\.event_payload->>'exercise_index' = se\.event_payload->>'exercise_index'/);
    expect(clause).not.toMatch(/mr->>'name' = p_skill_name/);
    expect(clause).toMatch(/\(mr->>'hasValue'\)::boolean = true/);
  });

  it('keeps the decay, the flashcard branch and the row deletion', () => {
    expect(fn).toMatch(/exp\(-0\.03 \*/);
    expect(fn).toMatch(/p_skill_name LIKE 'flashcard:%'/);
    expect(fn).toMatch(/DELETE FROM public\.student_skill_metrics/);
  });

  it('a Mark done event refreshes the skills of its worksheet exercise, in a fixed lock order', () => {
    const trig = latestDefinition('refresh_skill_metrics_on_event');
    expect(trig).toBe(fn);
    const body = trig.slice(trig.indexOf('FUNCTION public.refresh_skill_metrics_on_event'));
    expect(body).toMatch(/event_type = 'mark_done_evaluation'/);
    expect(body).toMatch(/w\.event_source = 'worksheet'/);
    expect(body).toMatch(/ORDER BY skill_name/);
  });

  it('the recompute migration audits changed rows, is resumable and needs v3', () => {
    const body = read('20261015090100_recompute_skill_metrics_v3.sql');
    expect(body).toContain('D_metric_recompute_v3');
    expect(body).toMatch(/pg_advisory_xact_lock/);
    expect(body).toMatch(/mastery_history->0 \? 'event_id'/);
    expect(body).toMatch(/v_batch integer := 500/);
    expect(body).toMatch(/INSERT INTO public\.dslm_backfill_audit/);
  });
});

describe('Iteration 8: metric engine v3 review fixes', () => {
  const v3 = readFileSync(join(MIGRATIONS, '20261015090000_compute_skill_metric_v3.sql'), 'utf8');

  it('the metric update trigger also fires when created_at is restored', () => {
    expect(v3).toMatch(/AFTER UPDATE OF event_payload, mastery, created_at ON public\.student_events/);
    expect(v3).toMatch(/OLD\.created_at IS DISTINCT FROM NEW\.created_at/);
  });

  it('compute_skill_metric is not executable by client roles', () => {
    expect(v3).toMatch(/REVOKE ALL ON FUNCTION public\.compute_skill_metric\(uuid, uuid, text, text\) FROM PUBLIC, anon, authenticated/);
    expect(v3).toMatch(/GRANT EXECUTE ON FUNCTION public\.compute_skill_metric\(uuid, uuid, text, text\) TO service_role/);
  });

  it('a pure re-save of a worksheet answer keeps its eval_trigger label', () => {
    const save = readFileSync(join(MIGRATIONS, '20261015090400_homework_ai_queue_and_worksheet_save.sql'), 'utf8');
    expect(save.match(/eval_trigger = CASE WHEN v_changed THEN NULL ELSE worksheet_student_answers\.eval_trigger END/g)?.length).toBe(2);
  });

  it('migrations of this iteration have no apostrophes in line comments (SQL Editor splitter)', () => {
    for (const f of readdirSync(MIGRATIONS).filter((n) => n.startsWith('20261015'))) {
      const lines = readFileSync(join(MIGRATIONS, f), 'utf8').split('\n');
      const bad = lines.filter((l) => /^\s*--.*'/.test(l));
      expect({ f, bad }).toEqual({ f, bad: [] });
    }
  });
});
