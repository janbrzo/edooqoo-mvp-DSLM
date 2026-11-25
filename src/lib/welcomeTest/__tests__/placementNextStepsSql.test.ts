import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { execFile, execFileSync } from 'node:child_process';
import { chownSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { promisify } from 'node:util';

// Isolated PostgreSQL only. This suite never connects to the hosted project.
const run = promisify(execFile);
const dir = mkdtempSync('/tmp/placement-next-steps-sql-');
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
const sqlArgs = ['-h', dir, '-p', '55438', '-U', 'nobody', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'];
function sql(value: string) { return execFileSync('psql', [...sqlArgs, '-c', value], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }

const learner = '00000000-0000-4000-8000-000000000002';
const testId = '00000000-0000-4000-8000-000000000003';
const reportId = '00000000-0000-4000-8000-000000000004';
const owner = '00000000-0000-4000-8000-000000000005';
const sentinel = '00000000-0000-0000-0000-000000000000';
const lessons = [1,2,3].map(n => ({topic: `Status updates ${n}`, difficulty: 'A2', exercises: ['reading'], exerciseFocusMap: {}, focusSkills: ['past_simple'], focusSkillKeys: ['past_simple'], estimatedImpact: {}}));
const reserve = () => JSON.parse(sql("SELECT reserve_placement_next_steps('teacher-token');"));
const finish = (lease: string, values = lessons) => sql(`SELECT finish_placement_next_steps('teacher-token','${lease}','${JSON.stringify(values)}','{}',NULL,false);`);
describe('Placement lesson reservations, actual migrations in isolated PostgreSQL', () => {
  beforeAll(() => {
    if (uid === 0) chownSync(dir,65534,65534);
    const [init,args] = asUser('initdb',['-D',`${dir}/data`,'--auth=trust','--no-locale','-U','nobody']); execFileSync(init,[...args],{stdio:'pipe'});
    const [ctl,ctlArgs] = asUser('pg_ctl',['-D',`${dir}/data`,'-l',`${dir}/server.log`,'-o',`-k ${dir} -p 55438 -h ''`,'-w','start']); execFileSync(ctl,[...ctlArgs],{stdio:'pipe'}); started=true;
    sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.students(id uuid PRIMARY KEY,teacher_id uuid,deleted_at timestamptz);
      CREATE TABLE public.student_tests(id uuid PRIMARY KEY,student_id uuid,status text);
      CREATE TABLE public.student_learning_profiles(student_id uuid,welcome_test_id uuid);
      CREATE TABLE public.public_placement_reports(id uuid PRIMARY KEY,report_token text,expires_at timestamptz,claimed_by uuid,unclaimed_student_id uuid,unclaimed_test_id uuid);
      CREATE TABLE public.future_worksheet_suggestions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid,teacher_id uuid,sequence_number int,suggested_topic text,suggested_goal text,suggested_additional_info text,suggested_grammar_focus text,suggested_exercises text[],suggested_exercise_focus_map jsonb,rationale text,source text,suggestion_kind text,focus_skill_names text[],difficulty_level text,estimated_impact jsonb,generation_context jsonb,deleted_at timestamptz);`);
    for (const name of readdirSync('supabase/migrations').filter(n => n.startsWith('20261125065507_') || n.startsWith('20261125065528_')).sort()) sql(readFileSync(`supabase/migrations/${name}`,'utf8'));
  },30000);
  afterAll(() => {
    try { if(started) { const [ctl,args]=asUser('pg_ctl',['-D',`${dir}/data`,'-m','immediate','-w','stop']);execFileSync(ctl,[...args],{stdio:'pipe'}); } } finally { rmSync(dir,{recursive:true,force:true}); }
  });
  beforeEach(() => sql(`TRUNCATE public_placement_reports,students,student_tests,student_learning_profiles,future_worksheet_suggestions;
    INSERT INTO students VALUES('${learner}','${sentinel}',NULL);
    INSERT INTO student_tests VALUES('${testId}','${learner}','reviewed');
    INSERT INTO student_learning_profiles VALUES('${learner}','${testId}');
    INSERT INTO public_placement_reports(id,report_token,expires_at,unclaimed_student_id,unclaimed_test_id) VALUES('${reportId}','teacher-token',now()+interval '7 days','${learner}','${testId}');`));
  it('requires a reviewed exact placement test and an unexpired teacher token', () => {
    expect(reserve().status).toBe('reserved');
    sql("UPDATE public_placement_reports SET placement_next_steps=NULL; UPDATE student_tests SET status='completed';");expect(reserve().status).toBe('not_ready');
    sql("UPDATE student_tests SET status='reviewed'; UPDATE public_placement_reports SET expires_at=now()-interval '1 day';");expect(reserve().status).toBe('expired');
    expect(sql("SELECT reserve_placement_next_steps('student-token')->>'status';")).toBe('unavailable');
  });
  it('reserves once under simultaneous requests and stores exactly three lessons atomically', async () => {
    const responses=await Promise.all([run('psql',[...sqlArgs,'-c',"SELECT reserve_placement_next_steps('teacher-token');"]),run('psql',[...sqlArgs,'-c',"SELECT reserve_placement_next_steps('teacher-token');"])]);
    const states=responses.map(r=>JSON.parse(r.stdout.trim()));expect(states.map(s=>s.status).sort()).toEqual(['reserved','running']);
    const reservation=states.find(s=>s.status==='reserved');finish(reservation.lease);
    expect(sql('SELECT count(*) FROM future_worksheet_suggestions;')).toBe('3');
    expect(reserve().suggestions).toHaveLength(3);
    expect(()=>finish(reservation.lease)).toThrow(/reservation unavailable/);
    expect(sql('SELECT count(*) FROM future_worksheet_suggestions;')).toBe('3');
  });
  it('a failed later proposal rolls back all three inserts', () => {
    const r=reserve();expect(()=>finish(r.lease,[...lessons.slice(0,2),{...lessons[2],difficulty:'INVALID'}])).toThrow(/Invalid lesson proposal/);
    expect(sql('SELECT count(*) FROM future_worksheet_suggestions;')).toBe('0');
  });
  it('claim during generation writes the same three suggestions under the new owner', () => {
    const r=reserve();sql(`UPDATE students SET teacher_id='${owner}'; UPDATE public_placement_reports SET claimed_by='${owner}';`);finish(r.lease);
    expect(sql(`SELECT count(*) FROM future_worksheet_suggestions WHERE teacher_id='${owner}' AND student_id='${learner}';`)).toBe('3');
  });
  it('anon and authenticated cannot reserve or finish generation', () => {
    expect(sql("SELECT has_function_privilege('anon','public.reserve_placement_next_steps(text)','EXECUTE'),has_function_privilege('authenticated','public.finish_placement_next_steps(text,uuid,jsonb,jsonb,text,boolean)','EXECUTE');")).toBe('f|f');
  });
  it('a persisted denial never acquires a second reservation', () => {
    const r=reserve();sql(`SELECT finish_placement_next_steps('teacher-token','${r.lease}',NULL,'{}','Provider denied',true);`);expect(reserve()).toMatchObject({status:'failed',terminal:true,attempts:1});
  });
});
