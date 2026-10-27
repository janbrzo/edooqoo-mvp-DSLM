import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Deleting a homework supersedes its DSLM events (kept for history, ignored by
 * compute_skill_metric) instead of leaving them feeding the metrics.
 */
const sql = readFileSync(join(__dirname, '../../../supabase/migrations/20261027110000_homework_events_on_delete.sql'), 'utf8');

describe('homework delete trigger', () => {
  it('supersedes (never deletes) the homework events of the deleted assignment', () => {
    expect(sql).toMatch(/SET superseded_at = now\(\)\s+WHERE event_source = 'homework'\s+AND source_id = p_homework_id\s+AND superseded_at IS NULL/);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('fires after a homework is deleted and never blocks the delete', () => {
    expect(sql).toMatch(/AFTER DELETE ON public\.homework_assignments\s+FOR EACH ROW/);
    expect(sql).toMatch(/EXCEPTION WHEN OTHERS THEN[\s\S]*RAISE WARNING[\s\S]*RETURN OLD;/);
  });

  it('is not callable by clients', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.supersede_homework_events\(uuid\) FROM PUBLIC, anon, authenticated;/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.supersede_homework_events_on_homework_delete\(\) FROM PUBLIC, anon, authenticated;/);
  });
});
