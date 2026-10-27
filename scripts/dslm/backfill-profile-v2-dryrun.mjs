/**
 * DRY RUN of the profile v2 backfill (decision D15). Read-only: it never writes.
 *
 * For every student_learning_profiles row it recomputes the v2/v3 columns
 * (traits, learning_path, divergences, answer_behaviour, signal_coverage) from the
 * STORED answers with the shared Edge Function code, then prints a before/after
 * table with counts. Student ids are shortened to 8 characters; no names, emails
 * or answer text are printed.
 *
 * Run (the shared code is TypeScript, so use vite-node):
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
 *     npx vite-node --config vitest.config.ts scripts/dslm/backfill-profile-v2-dryrun.mjs [--out report.md] [--include-current]
 *   npx vite-node --config vitest.config.ts scripts/dslm/backfill-profile-v2-dryrun.mjs --input export.json [--out report.md]
 *
 * --input is a JSON array of { profile, test, rows } (a SQL export of
 * student_learning_profiles, its student_tests row and its student_test_questions
 * rows). The service role key is read only from the environment, never from
 * arguments or the file, and only GET requests are ever sent.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { recomputeProfile, renderMarkdown } from './profileV2Recompute.ts';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function restGet(path) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or pass --input <export.json>.');
  const res = await fetch(`${base.replace(/\/$/, '')}/rest/v1/${path}`, {
    method: 'GET',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`GET ${path.split('?')[0]} failed: HTTP ${res.status}`);
  return res.json();
}

async function loadFromRest() {
  const profiles = await restGet('student_learning_profiles?select=*&order=updated_at.asc');
  const entries = [];
  for (const profile of profiles) {
    let test = null;
    let rows = [];
    if (profile.welcome_test_id) {
      const tests = await restGet(`student_tests?id=eq.${profile.welcome_test_id}&select=total_questions,attempt_number`);
      test = tests[0] ?? null;
      rows = await restGet(
        `student_test_questions?test_id=eq.${profile.welcome_test_id}&select=question_index,question_data,student_answer,element_type,is_correct,time_spent_seconds&order=question_index.asc`,
      );
    }
    entries.push({ profile, test, rows });
  }
  return entries;
}

const inputPath = opt('--input');
const entries = inputPath ? JSON.parse(readFileSync(inputPath, 'utf8')) : await loadFromRest();
const asOf = inputPath ? `export ${inputPath.split('/').pop()}` : new Date().toISOString();

const results = entries.map((e) => recomputeProfile(e));
const markdown = renderMarkdown(results, asOf, flag('--include-current'));

const out = opt('--out');
if (out) writeFileSync(out, markdown);
else process.stdout.write(markdown);
