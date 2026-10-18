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

  it('is defined by 20261017100000 (v3 plus the superseded-event filter)', () => {
    expect(fn).toBe(read('20261017100000_welcome_test_server_authority.sql'));
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

  it('allows insufficient_data in the trend check constraint', () => {
    // The metric upsert runs in the student_events trigger: a rejected trend
    // rolls back the event itself (2026-10-15 incident).
    const checks = [...sql.matchAll(/ADD CONSTRAINT student_skill_metrics_trend_check\s+CHECK \(([^;]+)\);/g)];
    expect(checks.length).toBeGreaterThan(0);
    expect(checks[checks.length - 1][1]).toMatch(/'insufficient_data'/);
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
    expect(trig).toBe(read('20261015090000_compute_skill_metric_v3.sql'));
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

describe('Welcome Test server authority and retake history (2026-10-17 audit)', () => {
  const file = readFileSync(join(MIGRATIONS, '20261017100000_welcome_test_server_authority.sql'), 'utf8');

  it('a retake marks older attempts superseded instead of deleting them (decision 1)', () => {
    const body = latestDefinition('supersede_previous_welcome_test_events');
    expect(body).toBe(file);
    expect(body).toMatch(/SET superseded_at = now\(\), superseded_by = t\.id/);
    expect(body).not.toMatch(/DELETE FROM public\.student_events e USING _welcome_superseded/);
  });

  it('compute_skill_metric ignores superseded events and the update trigger recomputes on supersede', () => {
    expect(latestDefinition('compute_skill_metric')).toBe(file);
    expect(file.match(/AND se\.superseded_at IS NULL/g)?.length).toBe(2);
    expect(file).toMatch(/AFTER UPDATE OF event_payload, mastery, created_at, superseded_at ON public\.student_events/);
  });

  it('calculate_test_results divides by scored items (guard tightened by 20261018100000)', () => {
    expect(file).toMatch(/v_current_status IS DISTINCT FROM 'in_progress'/);
    const body = latestDefinition('calculate_test_results');
    expect(body).toMatch(/v_score := CASE WHEN v_scored > 0/);
    expect(body).not.toMatch(/s\.total \* 100/);
  });

  it('the student answer RPC refuses closed or expired tests and the questions RPC hides the key', () => {
    expect(latestDefinition('save_test_answer_by_share_token')).toBe(file);
    expect(file).toMatch(/AND t\.status IN \('assigned', 'in_progress'\)/);
    expect(file).toMatch(/RETURN v_updated > 0;/);
    expect(latestDefinition('get_test_questions_by_share_token')).toBe(file);
    expect(file).toMatch(/jsonb_populate_record\(q, jsonb_build_object\('correct_answer', NULL\)\)/);
  });
});

describe('Pillar 1.1: additive micro-skill taxonomy (20261015201345)', () => {
  const body = readFileSync(join(MIGRATIONS, '20261015201345_c5c1929e-6931-46d3-b7bd-444dbf6a607b.sql'), 'utf8');

  it('is the latest extract_micro_skill definition and stays additive', () => {
    expect(latestDefinition('extract_micro_skill')).toBe(body);
    expect(body).toMatch(/every v1 rule kept in order/);
  });
});

describe('Pillar 1.2: canonical ratings at the event boundary (20261016074048)', () => {
  const body = readFileSync(join(MIGRATIONS, '20261016074048_b88b1f50-d5b7-4190-9d4a-6a5962a2016d.sql'), 'utf8');

  it('normalizes nano_skill_ratings on every student_events insert and payload update', () => {
    expect(body).toMatch(/CREATE TRIGGER trg_normalize_student_event_ratings BEFORE INSERT OR UPDATE OF event_payload, mastery, skill_ids\s+ON public\.student_events/);
    expect(body).toMatch(/NEW\.event_payload := jsonb_set\(NEW\.event_payload, '\{nano_skill_ratings\}', public\.normalize_dslm_ratings/);
  });

  it('the normalizer and knowledge classifier are service-role only', () => {
    for (const fn of ['normalize_dslm_ratings(jsonb)', 'normalize_student_event_ratings()', 'knowledge_entry_dslm_ratings(jsonb)', 'log_knowledge_entry_event()']) {
      expect(body).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated;`);
      expect(body).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`);
    }
  });

  it('knowledge classification re-logs the DSLM event on category/content/tags changes', () => {
    expect(body).toMatch(/CREATE TRIGGER trigger_log_knowledge_entry_event AFTER INSERT OR UPDATE OF category, content, tags, metadata, ai_classified, ai_confidence, deleted_at, is_outdated/);
  });
});

describe('Pillar 1.3: owner/service-only read-time state vector (20261017134759)', () => {
  // The functions were refined in follow-up migrations the same day (rounding
  // parity fix); assert on the latest definition, which must keep the contract.
  const body = latestDefinition('get_student_dslm_state_vector');

  it('both functions are defined in the Stage 1.3 migration family', () => {
    for (const f of ['20261017134759_4942ac57-81e4-47df-a362-f032f608f5f0.sql', '20261017134848_e57ec5ea-4827-4d2c-a99b-afe88e150d9a.sql', '20261017135037_f8cf555a-7b86-47a5-a998-915463827528.sql']) {
      expect(readFileSync(join(MIGRATIONS, f), 'utf8')).toMatch(/CREATE OR REPLACE FUNCTION public\.(dslm_effective_mastery|get_student_dslm_state_vector)\(/);
    }
    expect(latestDefinition('dslm_effective_mastery')).toBeTruthy();
  });

  it('pins one read timestamp per statement and excludes duplicate card metrics', () => {
    expect(body).toMatch(/v_now timestamptz := statement_timestamp\(\)/);
    expect(body).toMatch(/m\.skill_name NOT LIKE 'flashcard:%'/);
  });

  it('returns the version 1 contract with the four skill lists and a focus', () => {
    for (const key of ["'version', 1", "'strongest_skills'", "'critical_gaps'", "'decaying_skills'", "'recommended_focus'"]) {
      expect(body).toContain(key);
    }
  });

  it('is revoked from PUBLIC and anon; authenticated and service_role may execute', () => {
    expect(body).toMatch(/REVOKE ALL ON FUNCTION public\.get_student_dslm_state_vector\(uuid, uuid\) FROM PUBLIC, anon, authenticated/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_student_dslm_state_vector\(uuid, uuid\) TO authenticated, service_role/);
    expect(body).toMatch(/REVOKE ALL ON FUNCTION public\.dslm_effective_mastery\(numeric, timestamptz, timestamptz\) FROM PUBLIC, anon, authenticated/);
  });

  it('never writes: the migration contains no INSERT, UPDATE or DELETE on metrics', () => {
    expect(body).not.toMatch(/INSERT INTO public\.student_skill_metrics/);
    expect(body).not.toMatch(/UPDATE public\.student_skill_metrics/);
    expect(body).not.toMatch(/DELETE FROM public\.student_skill_metrics/);
  });
});

describe('Timestamp defaults (2026-10-17)', () => {
  it('no migration after the fix sets a column default with AT TIME ZONE', () => {
    const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f >= '20261017140000').sort();
    for (const f of files) {
      expect(readFileSync(join(MIGRATIONS, f), 'utf8')).not.toMatch(/DEFAULT\s*\(?\s*now\(\)\s*AT TIME ZONE/i);
    }
  });

  it('resets every Europe/Warsaw default to now()', () => {
    const fix = readFileSync(join(MIGRATIONS, '20261017140000_timestamp_defaults_utc.sql'), 'utf8');
    expect(fix.match(/ALTER COLUMN \w+ SET DEFAULT now\(\);/g)?.length).toBe(26);
  });
});

describe('calculate_test_results is owner or service role only (2026-10-18)', () => {
  it('the newest definition has no in-progress exception and anonymous EXECUTE is revoked', () => {
    const body = latestDefinition('calculate_test_results');
    expect(body).toBe(readFileSync(join(MIGRATIONS, '20261018100000_calculate_test_results_owner_only.sql'), 'utf8'));
    expect(body).not.toMatch(/'in_progress'/);
    expect(body).toMatch(/REVOKE ALL ON FUNCTION public\.calculate_test_results\(uuid\) FROM PUBLIC, anon;/);
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION public\.calculate_test_results\(uuid\) TO authenticated, service_role;/);
  });
});
