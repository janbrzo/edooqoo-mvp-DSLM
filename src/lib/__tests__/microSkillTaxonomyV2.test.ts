import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Pillar 1.1: extract_micro_skill v2 must be additive. Every WHEN rule of the
 * v1 baseline must still exist in the newest definition, and in the same order,
 * so no existing skill name changes its micro skill.
 */
const MIGRATIONS = join(__dirname, '../../../supabase/migrations');
const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const fnBody = (file: string): string => {
  const src = readFileSync(join(MIGRATIONS, file), 'utf8');
  const start = src.search(/CREATE OR REPLACE FUNCTION public\.extract_micro_skill\(/i);
  if (start < 0) return '';
  const open = src.indexOf('$function$', start);
  const close = src.indexOf('$function$', open + 10);
  return src.slice(open, close);
};
const whenRules = (body: string) =>
  body.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('WHEN '));

const baseline = whenRules(fnBody('20261012090000_dslm_pipeline_baseline.sql'));
const latestFile = files.filter((f) => fnBody(f)).pop()!;
const latest = whenRules(fnBody(latestFile));

describe('extract_micro_skill v2 is additive', () => {
  it('baseline has rules', () => expect(baseline.length).toBeGreaterThan(100));

  it('keeps every v1 rule in the original relative order', () => {
    let cursor = -1;
    for (const rule of baseline) {
      const idx = latest.indexOf(rule, cursor + 1);
      expect(idx, rule).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it('adds the adult professional communication domains', () => {
    for (const ms of ['telephoning', 'negotiation', 'email_register', 'diplomatic_language', 'meetings', 'presentations']) {
      expect(latest.some((r) => r.endsWith(`'${ms}'`))).toBe(true);
    }
  });
});
