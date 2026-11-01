import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { execFile, execFileSync } from 'node:child_process';
import { chownSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { promisify } from 'node:util';

// Isolated PostgreSQL only. This suite never connects to the hosted project.
const run = promisify(execFile);
const dir = mkdtempSync('/tmp/homework-mistake-sql-');
const uid = process.getuid?.();
let started = false;
// Resolve wrappers/symlinks so PostgreSQL can locate its packaged extension libraries.
const executable = (cmd: string) => {
  try { return realpathSync(execFileSync('which', [cmd], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()); }
  catch {
    // Ubuntu CI keeps server binaries outside PATH; never fall back to a hosted connection.
    const root = '/usr/lib/postgresql';
    if (existsSync(root)) for (const version of readdirSync(root).sort().reverse()) {
      const path = `${root}/${version}/bin/${cmd}`;
      if (existsSync(path)) return realpathSync(path);
    }
    throw new Error(`Local PostgreSQL binary ${cmd} is required for isolated transaction tests.`);
  }
};
const asUser = (cmd: string, args: string[]) => uid === 0 ? ['runuser', ['-u', 'nobody', '--', executable(cmd), ...args]] as const : [executable(cmd), args] as const;
const sqlArgs = ['-h', dir, '-p', '55437', '-U', 'nobody', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'];
function sql(value: string) { return execFileSync('psql', [...sqlArgs, '-c', value], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
const teacher = '00000000-0000-4000-8000-000000000001';
const student = '00000000-0000-4000-8000-000000000002';
const homework = '00000000-0000-4000-8000-000000000003';
const cards = JSON.stringify([{ exercise_index: 0, question_index: 0, front_text: 'Choose a polite request', back_text: 'Could you send it?' }]);
function save(owner: string | null = teacher, snapshotOverride = '', cardPayload = cards) {
  return `SET request.jwt.claim.role='service_role'; WITH s AS (SELECT public.load_homework_mistake_source('${homework}') AS v), p AS (
    SELECT ((v->'homework') - 'id' - 'title' - 'share_token') || jsonb_build_object('answers',v->'answers') AS snapshot FROM s)
    SELECT public.save_homework_mistake_flashcards('${homework}',${owner ? `'${owner}'` : 'NULL'},'proof','learner@example.test',${snapshotOverride || 'snapshot'},'${cardPayload}'::jsonb) FROM p;`;
}
describe('Homework mistake transaction, actual migrations in isolated PostgreSQL', () => {
  beforeAll(() => {
    if (uid === 0) chownSync(dir, 65534, 65534);
    const [init, args] = asUser('initdb', ['-D', `${dir}/data`, '--auth=trust', '--no-locale', '-U', 'nobody']);
    execFileSync(init, [...args], { stdio: 'pipe' });
    const [ctl, ctlArgs] = asUser('pg_ctl', ['-D', `${dir}/data`, '-l', `${dir}/server.log`, '-o', `-k ${dir} -p 55437 -h ''`, '-w', 'start']);
    execFileSync(ctl, [...ctlArgs], { stdio: 'pipe' });
    started = true;
    sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
      CREATE TABLE public.profiles(id uuid PRIMARY KEY);
      CREATE TABLE public.students(id uuid PRIMARY KEY,teacher_id uuid,student_email text,deleted_at timestamptz);
      CREATE TABLE public.homework_assignments(id uuid PRIMARY KEY,teacher_id uuid,student_id uuid,title text,share_token text,selected_exercises jsonb,attempt int,reviewed_at timestamptz,completed_at timestamptz,completed_by_teacher boolean);
      CREATE TABLE public.homework_student_answers(homework_id uuid,student_email text,exercise_index int,exercise_type text,answers jsonb,is_submitted boolean,eval_trigger text,item_evaluations jsonb);
      CREATE TABLE public.flashcard_sets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),teacher_id uuid,student_id uuid,title text,description text,is_bidirectional boolean,back_type text,share_token text,share_expires_at timestamptz,allow_student_contributions boolean DEFAULT true,deleted_at timestamptz);
      CREATE TABLE public.flashcard_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),set_id uuid,front_text text,back_text text,front_example text,source_type text,created_by_student boolean,card_position int,deleted_at timestamptz);
      CREATE TABLE public.student_events(id uuid); CREATE TABLE public.student_skill_metrics(id uuid); CREATE TABLE public.flashcard_progress(id uuid);`);
    for (const name of readdirSync('supabase/migrations').filter(name => name.startsWith('20261031095842_') || name.startsWith('20261031100129_')).sort()) sql(readFileSync(`supabase/migrations/${name}`, 'utf8'));
  }, 30000);
  beforeEach(() => sql(`SET request.jwt.claim.role='service_role'; TRUNCATE profiles,students,homework_assignments,homework_student_answers,flashcard_sets,flashcard_cards,homework_mistake_sets,homework_mistake_cards CASCADE;
    INSERT INTO profiles VALUES('${teacher}'); INSERT INTO students VALUES('${student}','${teacher}','learner@example.test',NULL);
    INSERT INTO homework_assignments VALUES('${homework}','${teacher}','${student}','Requests','proof','[]',1,'2026-10-31T10:00:00Z','2026-10-30T10:00:00Z',false);
    INSERT INTO homework_student_answers VALUES('${homework}',' LEARNER@example.test ',0,'multiple-choice','{"0":"Send it!"}',true,'submit_homework','[{"question_index":0,"hasValue":true,"mastery":0}]');`));
  afterAll(() => {
    try { if (started) { const [ctl,args] = asUser('pg_ctl', ['-D',`${dir}/data`,'-m','immediate','-w','stop']); execFileSync(ctl,[...args],{stdio:'pipe'}); } } finally { rmSync(dir,{recursive:true,force:true}); }
  });
  it('canonical normalized loading sees the assigned answer, and timestamps allow equivalent Z representation', () => {
    expect(sql(`SET request.jwt.claim.role='service_role'; SELECT jsonb_array_length(load_homework_mistake_source('${homework}')->'answers');`).split('\n').at(-1)).toBe('1');
    const response = JSON.parse(sql(save(teacher, `snapshot || '{"reviewed_at":"2026-10-31T10:00:00Z","completed_at":"2026-10-30T10:00:00Z"}'`)).split('\n').at(-1) ?? '{}');
    expect(response.created_count).toBe(1);
  });
  it('repeated teacher and learner conversion returns one shared set and one card', () => {
    const a = JSON.parse(sql(save()).split('\n').at(-1) ?? '{}'); const b = JSON.parse(sql(save(null)).split('\n').at(-1) ?? '{}');
    expect(a.created_count).toBe(1); expect(b.created_count).toBe(0); expect(b.existing_count).toBe(1); expect(b.set_id).toBe(a.set_id);
    expect(sql('SELECT count(*) FROM flashcard_cards;')).toBe('1');
  });
  it('concurrent teacher/learner conversion creates exactly one source card', async () => {
    const responses = await Promise.all([run('psql',[...sqlArgs,'-c',save()]),run('psql',[...sqlArgs,'-c',save(null)])]);
    const values = responses.map(value => JSON.parse(value.stdout.trim().split('\n').at(-1) ?? '{}'));
    expect(values.map(value => value.created_count).sort()).toEqual([0,1]); expect(sql('SELECT count(*) FROM homework_mistake_sets;')).toBe('1'); expect(sql('SELECT count(*) FROM flashcard_cards;')).toBe('1');
  });
  it('anonymous and authenticated cannot invoke either privileged function', () => {
    expect(sql(`SELECT has_function_privilege('anon','public.load_homework_mistake_source(uuid)','EXECUTE'),has_function_privilege('authenticated','public.save_homework_mistake_flashcards(uuid,uuid,text,text,jsonb,jsonb)','EXECUTE');`)).toBe('f|f');
    expect(() => sql(`SET request.jwt.claim.role='authenticated'; SELECT load_homework_mistake_source('${homework}');`)).not.toThrow();
    expect(() => sql(`SET ROLE authenticated; SELECT load_homework_mistake_source('${homework}');`)).toThrow(/permission denied/);
  });
  it('foreign owner, wrong token and unpublished learner review do not write', () => {
    expect(() => sql(save('00000000-0000-4000-8000-000000000009'))).toThrow(/not_allowed/);
    expect(() => sql(save(null).replace("'proof'","'wrong'"))).toThrow(/not_allowed/);
    sql('UPDATE homework_assignments SET reviewed_at=NULL;'); expect(() => sql(save(null))).toThrow(/not_reviewed/);
    expect(sql('SELECT count(*) FROM flashcard_cards;')).toBe('0');
  });
  it('source revision mismatch and reopened work cannot create stale practice', () => {
    expect(() => sql(save(teacher,"snapshot || '{\"attempt\":2}'"))).toThrow(/source_changed/);
    sql('UPDATE homework_assignments SET completed_at=NULL;'); expect(() => sql(save())).toThrow(/not_reviewed/);
  });
  it('invalid source rolls back the whole batch and empty set', () => {
    expect(() => sql(save(teacher,'',cards.replace('"question_index":0','"question_index":9')))).toThrow(/invalid_source/);
    expect(sql('SELECT count(*) FROM flashcard_sets;')).toBe('0');
  });
  it('disabled contributions and deleted sets block learner retries', () => {
    sql(save()); sql('UPDATE flashcard_sets SET allow_student_contributions=false;'); expect(() => sql(save(null))).toThrow(/contributions_disabled/);
    sql('UPDATE flashcard_sets SET deleted_at=now();'); expect(() => sql(save())).toThrow(/set_unavailable/);
  });
  it('expired sets are not silently recreated', () => {
    sql(save()); sql("UPDATE flashcard_sets SET share_expires_at=now()-interval '1 day';");
    expect(() => sql(save(null))).toThrow(/set_unavailable/);
    expect(sql('SELECT count(*) FROM flashcard_sets;')).toBe('1');
  });
  it('retry preserves teacher-edited card text', () => {
    sql(save()); sql("UPDATE flashcard_cards SET front_text='Teacher curated request';"); sql(save(null));
    expect(sql('SELECT front_text FROM flashcard_cards;')).toBe('Teacher curated request');
  });
  it('a new attempt keeps separate source provenance and the previous practice card', () => {
    sql(save()); sql('UPDATE homework_assignments SET attempt=2;');
    const result = JSON.parse(sql(save(null)).split('\n').at(-1) ?? '{}');
    expect(result.created_count).toBe(1);
    expect(sql('SELECT count(*) FROM homework_mistake_sets;')).toBe('2');
    expect(sql('SELECT count(*) FROM flashcard_cards;')).toBe('2');
  });
  it('creating cards does not write events, mastery or repetition progress', () => {
    sql(save()); expect(sql('SELECT (SELECT count(*) FROM student_events),(SELECT count(*) FROM student_skill_metrics),(SELECT count(*) FROM flashcard_progress);')).toBe('0|0|0');
  });
  it('creation, mixed retries and failed batch preserve existing lifecycle, answers and learning rows', () => {
    sql(`INSERT INTO student_events VALUES('${teacher}'); INSERT INTO student_skill_metrics VALUES('${student}'); INSERT INTO flashcard_progress VALUES('${homework}');`);
    const state = () => sql(`SELECT jsonb_build_object(
      'homework',(SELECT jsonb_agg(to_jsonb(h)) FROM homework_assignments h),
      'answers',(SELECT jsonb_agg(to_jsonb(a)) FROM homework_student_answers a),
      'events',(SELECT jsonb_agg(to_jsonb(e)) FROM student_events e),
      'metrics',(SELECT jsonb_agg(to_jsonb(m)) FROM student_skill_metrics m),
      'progress',(SELECT jsonb_agg(to_jsonb(p)) FROM flashcard_progress p));`);
    const before = state();
    sql(save()); expect(state()).toBe(before);
    sql(save(null)); expect(state()).toBe(before);
    expect(() => sql(save(teacher,'',cards.replace('"question_index":0','"question_index":9')))).toThrow(/invalid_source/);
    expect(state()).toBe(before);
  });
  it('a valid first card followed by an invalid card rolls back the entire transaction', () => {
    const batch = JSON.stringify([...JSON.parse(cards), { exercise_index: 0, question_index: 9, front_text: 'Invalid later item', back_text: 'Never saved' }]);
    expect(() => sql(save(teacher, '', batch))).toThrow(/invalid_source/);
    expect(sql('SELECT (SELECT count(*) FROM flashcard_sets),(SELECT count(*) FROM flashcard_cards),(SELECT count(*) FROM homework_mistake_sets),(SELECT count(*) FROM homework_mistake_cards);')).toBe('0|0|0|0');
  });
  it.each([
    { field: 'answers', change: 'UPDATE homework_student_answers SET answers=\'{"0":"Could you send it?"}\';' },
    { field: 'ratings', change: 'UPDATE homework_student_answers SET item_evaluations=\'[{"question_index":0,"hasValue":true,"mastery":100}]\';' },
    { field: 'exercises', change: 'UPDATE homework_assignments SET selected_exercises=\'[{"type":"discussion"}]\';' },
    { field: 'review', change: "UPDATE homework_assignments SET reviewed_at='2026-11-01T12:00:00Z';" },
    { field: 'completion', change: "UPDATE homework_assignments SET completed_at='2026-11-01T11:00:00Z';" },
  ])('a changed $field source after extraction rejects a stale snapshot', ({ change }) => {
    const snapshot = sql(`SET request.jwt.claim.role='service_role'; SELECT ((v->'homework') - 'id' - 'title' - 'share_token') || jsonb_build_object('answers',v->'answers') FROM (SELECT load_homework_mistake_source('${homework}') v) s;`).split('\n').at(-1) ?? '{}';
    sql(change);
    expect(() => sql(save(teacher, `'${snapshot.replace(/'/g, "''")}'::jsonb`))).toThrow(/source_changed/);
    expect(sql('SELECT count(*) FROM flashcard_cards;')).toBe('0');
  });
  it.each([
    "UPDATE homework_assignments SET share_token='rotated';",
    "UPDATE students SET student_email='reassigned@example.test';",
    'UPDATE students SET deleted_at=now();',
    "UPDATE students SET teacher_id='00000000-0000-4000-8000-000000000009';",
  ])('changed learner proof is revalidated at save: %s', change => {
    sql(change);
    expect(() => sql(save(null))).toThrow(/not_allowed/);
    expect(sql('SELECT count(*) FROM flashcard_cards;')).toBe('0');
  });
  it('soft-deleted source cards cannot be silently recreated on retry', () => {
    sql(save()); sql('UPDATE flashcard_cards SET deleted_at=now();');
    expect(() => sql(save(null))).toThrow(/card_unavailable/);
    expect(sql('SELECT count(*) FROM flashcard_cards;')).toBe('1');
  });
  it('teacher RLS reads its mappings, not another teacher mappings', () => {
    sql(save());
    expect(sql(`SET request.jwt.claim.sub='${teacher}'; SET ROLE authenticated; SELECT count(*) FROM homework_mistake_sets;`).split('\n').at(-1)).toBe('1');
    expect(sql(`SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000009'; SET ROLE authenticated; SELECT count(*) FROM homework_mistake_sets;`).split('\n').at(-1)).toBe('0');
  });
  it('both provenance tables deny anonymous reads and authenticated mutation', () => {
    for (const table of ['homework_mistake_sets','homework_mistake_cards']) {
      expect(sql(`SELECT has_table_privilege('anon','public.${table}','SELECT'),has_table_privilege('authenticated','public.${table}','INSERT'),has_table_privilege('authenticated','public.${table}','UPDATE'),has_table_privilege('authenticated','public.${table}','DELETE');`)).toBe('f|f|f|f');
      expect(() => sql(`SET ROLE anon; SELECT count(*) FROM ${table};`)).toThrow(/permission denied/);
    }
    sql(save());
    expect(sql(`SET request.jwt.claim.sub='${teacher}'; SET ROLE authenticated; SELECT count(*) FROM homework_mistake_cards;`).split('\n').at(-1)).toBe('1');
    expect(sql(`SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000009'; SET ROLE authenticated; SELECT count(*) FROM homework_mistake_cards;`).split('\n').at(-1)).toBe('0');
  });
});