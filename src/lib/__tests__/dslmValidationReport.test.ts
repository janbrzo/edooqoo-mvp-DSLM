import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(__dirname, '../../../supabase/migrations/20261027090100_dslm_validation_report.sql');
const sql = readFileSync(FILE, 'utf8');
/** Code without line comments and without string literals. */
const code = sql
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .replace(/\$q\$[\s\S]*?\$q\$/g, ' ')
  .replace(/'[^']*'/g, "''");

describe('dslm_validation_report migration', () => {
  it('is a STABLE SECURITY DEFINER function with a fixed search_path', () => {
    expect(sql).toMatch(/FUNCTION public\.dslm_validation_report\(\)/);
    expect(sql).toMatch(/RETURNS jsonb/);
    expect(sql).toMatch(/\bSTABLE\b/);
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
  });

  it('takes no arguments and so no student ids', () => {
    expect(sql).not.toMatch(/dslm_validation_report\([^)]+\)/);
  });

  it('contains no data changing or schema changing keywords', () => {
    const all = sql.replace(/'[^']*'/g, "''");
    for (const kw of ['insert', 'update', 'delete', 'drop', 'truncate', 'alter']) {
      expect(all, kw).not.toMatch(new RegExp(`\\b${kw}\\b`, 'i'));
    }
  });

  it('revokes from public, anon and authenticated and grants only service_role', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.dslm_validation_report\(\) FROM PUBLIC, anon, authenticated;/);
    const grants = sql.match(/GRANT [^;]*;/g) ?? [];
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatch(/TO service_role;$/);
    expect(grants[0]).not.toMatch(/anon|authenticated|PUBLIC/);
  });

  it('guards the optional decision log with to_regclass and dynamic SQL', () => {
    expect(sql).toMatch(/to_regclass\('public\.dslm_decision_log'\)/);
    expect(sql).toMatch(/EXECUTE\s+\$q\$/);
    // the optional table is referenced only inside the dynamic statement
    expect(code).not.toMatch(/dslm_decision_log\s+(WHERE|e\b)/);
  });

  it('has no apostrophes in line comments', () => {
    for (const line of sql.split('\n')) {
      const idx = line.indexOf('--');
      if (idx >= 0 && !/'[^']*--/.test(line.slice(0, idx + 2))) {
        expect(line.slice(idx), line).not.toContain("'");
      }
    }
  });

  it('selects no PII columns and never reads the students table', () => {
    expect(code).not.toMatch(/\b(name|email|student_email|teacher_email)\b/i);
    expect(code).not.toMatch(/public\.students\b/);
  });

  it('returns every agreed section with n, min_n and sufficient', () => {
    for (const s of ['mark_done_pairs', 'ai_raise', 'pacing_decisions', 'flashcard_decay_check', 'wt_level_vs_mastery', 'skill_key_coverage', 'prediction_error']) {
      expect(sql).toContain(`'${s}'`);
    }
    for (const n of ['150', '100', '30', '40']) expect(sql).toMatch(new RegExp(`'min_n', ${n}`));
    expect(sql).toMatch(/'0\.03'/);
  });
});
