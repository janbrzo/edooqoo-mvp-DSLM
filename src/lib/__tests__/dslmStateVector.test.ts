import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { effectiveMastery } from '../../../supabase/functions/_shared/forgetting';

const migrations = join(__dirname, '../../../supabase/migrations');
const allSql = readdirSync(migrations).sort().filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(join(migrations, f), 'utf8'));
const definitions = allSql.filter(sql => /CREATE OR REPLACE FUNCTION public\.get_student_dslm_state_vector\(/i.test(sql));
const latest = definitions.at(-1) ?? '';
const latestHelper = allSql.filter(sql => /CREATE OR REPLACE FUNCTION public\.dslm_effective_mastery\(/i.test(sql)).at(-1) ?? '';
const serviceOnlyClosure = readFileSync(join(migrations, '20261018082946_f70f80f4-6caa-45ef-a5ac-cbd580b6a0a5.sql'), 'utf8');
const internalTables = ['app_internal_config', 'newsletter_subscribers', 'newsletter_rate_limits', 'dslm_event_errors', 'dslm_backfill_audit'];

describe('versioned student state vector contract', () => {
  it('has a read-only, invoker-authorized implementation with restricted execution', () => {
    expect(latest).toContain('STABLE SECURITY INVOKER');
    expect(latest).toContain("auth.uid() IS DISTINCT FROM p_teacher_id");
    expect(latest).toContain('s.deleted_at IS NULL');
    expect(latest).toContain('FROM PUBLIC, anon, authenticated');
    expect(latest).not.toMatch(/\b(INSERT INTO|UPDATE public\.|DELETE FROM)\b/i);
  });
});

// Actual PostgreSQL execution, not a duplicate TypeScript implementation.
// Set DSLM_TEST_PG_BIN on machines where PostgreSQL is not on PATH or in Nix.
const nixPg = existsSync('/nix/store') ? readdirSync('/nix/store')
  .filter(n => /-postgresql-17\./.test(n)).map(n => join('/nix/store', n, 'bin'))
  .find(p => existsSync(join(p, 'initdb'))) : undefined;
const pgBin = process.env.DSLM_TEST_PG_BIN ?? nixPg;
const owner = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';
const student = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const emptyStudent = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
let directory = '';
let started = false;
const root = process.getuid?.() === 0;
const pg = (name: string, args: string[]) => {
  if (!pgBin) throw new Error('PostgreSQL binaries required');
  const executable = join(pgBin, name);
  return execFileSync(root ? 'runuser' : executable,
    root ? ['-u', 'nobody', '--', executable, ...args] : args, { encoding: 'utf8' });
};
const query = (sql: string) => execFileSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
  '-h', directory, '-p', '55439', '-U', 'postgres', '-d', 'postgres', '-c', sql], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const asOwner = (sql: string) => query(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SET request.jwt.claim.role='authenticated'; ${sql}`);
const vector = (id = student) => JSON.parse(asOwner(`SELECT public.get_student_dslm_state_vector('${id}', '${owner}');`));

describe.skipIf(!pgBin)('student state vector in isolated PostgreSQL', () => {
  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'dslm-vector-'));
    if (root) execFileSync('chown', ['nobody:nogroup', directory]);
    pg('initdb', ['-D', join(directory, 'data'), '-U', 'postgres', '-A', 'trust', '--no-locale']);
    pg('pg_ctl', ['-D', join(directory, 'data'), '-l', join(directory, 'server.log'),
      '-o', `-k ${directory} -p 55439 -c listen_addresses=''`, '-w', 'start']);
    started = true;
    query(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
      CREATE TABLE public.students(id uuid PRIMARY KEY, teacher_id uuid, deleted_at timestamptz);
      GRANT SELECT ON public.students TO authenticated, service_role;
      ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
      CREATE POLICY owner ON public.students TO authenticated USING (teacher_id=auth.uid());
      CREATE TABLE public.student_skill_metrics(student_id uuid, teacher_id uuid, skill_name text, skill_category text,
        micro_skill text, current_mastery numeric, total_events int, trend text, last_event_at timestamptz);
      GRANT SELECT ON public.student_skill_metrics TO authenticated, service_role;
      ALTER TABLE public.student_skill_metrics ENABLE ROW LEVEL SECURITY;
      CREATE POLICY owner ON public.student_skill_metrics TO authenticated USING (teacher_id=auth.uid());
      CREATE INDEX ON public.student_skill_metrics(student_id,teacher_id);
      INSERT INTO public.students VALUES ('${student}','${owner}',null),('${emptyStudent}','${owner}',null);
      INSERT INTO public.student_skill_metrics VALUES
        ('${student}','${owner}','ns.gap','grammar','gap',0,4,'stable',now()),
        ('${student}','${owner}','ns.forgotten','grammar','forgotten',100,4,'stable',now()-interval '74 days'),
        ('${student}','${owner}','ns.regression','speaking','regression',85,4,'declining',now()),
        ('${student}','${owner}','ns.sparse','speaking','sparse',86,1,'declining',now()),
        ('${student}','${owner}','ns.missing','grammar','missing',null,4,'stable',now()),
        ('${student}','${owner}','ns.unrated','grammar','unrated',-1,4,'stable',now()),
        ('${student}','${owner}','flashcard:duplicate','vocabulary','gap',0,4,'stable',now());
      INSERT INTO public.student_skill_metrics SELECT '${student}','${owner}','ns.strong.'||n,'vocabulary','strong.'||n,90+n,4,'stable',now() FROM generate_series(1,7) n;`);
    query(latest);
    query(latestHelper);
    // Start with exposed ACLs, then execute the actual closure migration.
    for (const table of internalTables) {
      query(`CREATE TABLE public.${table}(value integer);
        GRANT ALL ON public.${table} TO PUBLIC, anon, authenticated, service_role;
        INSERT INTO public.${table} VALUES (1);`);
    }
    query(`CREATE FUNCTION public.consume_newsletter_rate_limit(text,text,integer,integer)
      RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;
      GRANT EXECUTE ON FUNCTION public.consume_newsletter_rate_limit(text,text,integer,integer)
      TO PUBLIC, anon, authenticated, service_role;`);
    query(serviceOnlyClosure);
  }, 30000);
  afterAll(() => {
    if (started) pg('pg_ctl', ['-D', join(directory, 'data'), '-m', 'immediate', '-w', 'stop']);
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  it('matches the shared forgetting curve at exact 14, 30, 74 and 134 day boundaries', () => {
    const now = new Date('2026-10-17T13:46:00Z');
    for (const days of [0, 14, 14.01, 30, 74, 134, 3650, -5]) {
      const last = new Date(now.getTime() - days * 86400000).toISOString();
      const actual = Number(query(`SELECT public.dslm_effective_mastery(80,'${last}','${now.toISOString()}');`));
      expect(actual).toBe(effectiveMastery(80, last, now));
    }
    expect(Number(query("SELECT public.dslm_effective_mastery(80,NULL,now());"))).toBe(80);
  });
  it('matches fractional mastery rounding inside grace and preserves undated raw values', () => {
    const now = new Date('2026-10-17T13:46:00Z');
    for (const mastery of [80.04, 80.06, 0, 100]) {
      for (const days of [0, 14, 14.01, 74, -5]) {
        const last = new Date(now.getTime() - days * 86400000).toISOString();
        expect(Number(query(`SELECT public.dslm_effective_mastery(${mastery},'${last}','${now.toISOString()}');`)))
          .toBe(effectiveMastery(mastery, last, now));
      }
    }
    expect(Number(query('SELECT public.dslm_effective_mastery(80.04,NULL,now());'))).toBe(80.04);
  });
  it('returns at most five strongest micro-skills strictly above 80', () => {
    const result = vector();
    expect(result.strongest_skills).toHaveLength(5);
    expect(result.strongest_skills[0].effective_mastery).toBe(97);
    expect(result.strongest_skills.every((s: { effective_mastery: number }) => s.effective_mastery > 80)).toBe(true);
  });
  it('retains real zero, excludes missing scores and duplicate card metrics', () => {
    const result = vector();
    expect(result.skill_count).toBe(11);
    expect(result.recommended_focus.skill_name).toBe('ns.gap');
    expect(result.recommended_focus.effective_mastery).toBe(0);
    expect(result.critical_gaps.map((s: { micro_skill: string }) => s.micro_skill)).toEqual(['gap','forgotten','regression']);
  });
  it('identifies mastered areas not practised for more than 30 days', () => {
    expect(vector().decaying_skills.map((s: { micro_skill: string }) => s.micro_skill)).toEqual(['forgotten']);
    expect(vector().decaying_skills[0].effective_mastery).toBe(75);
  });
  it('returns empty arrays and null focus for a genuinely empty history', () => {
    expect(vector(emptyStudent)).toMatchObject({ skill_count: 0, strongest_skills: [], critical_gaps: [], decaying_skills: [], recommended_focus: null });
  });
  it('denies anonymous callers, other teachers, nonexistent and deleted students', () => {
    expect(() => query(`SET ROLE anon; SELECT public.get_student_dslm_state_vector('${student}','${owner}');`)).toThrow();
    expect(() => query(`SET ROLE authenticated; SET request.jwt.claim.sub='${other}'; SET request.jwt.claim.role='authenticated'; SELECT public.get_student_dslm_state_vector('${student}','${owner}');`)).toThrow();
    expect(() => asOwner(`SELECT public.get_student_dslm_state_vector('${student}','${other}');`)).toThrow();
    expect(() => vector(other)).toThrow();
    query(`UPDATE public.students SET deleted_at=now() WHERE id='${emptyStudent}';`);
    expect(() => vector(emptyStudent)).toThrow();
    query(`UPDATE public.students SET deleted_at=null WHERE id='${emptyStudent}';`);
  });
  it('allows service reads only for a real student-teacher pair and never writes mastery', () => {
    const before = query('SELECT jsonb_agg(to_jsonb(m)) FROM public.student_skill_metrics m;');
    const result = JSON.parse(query(`SET ROLE service_role; SET request.jwt.claim.role='service_role'; SELECT public.get_student_dslm_state_vector('${student}','${owner}');`));
    expect(result.skill_count).toBe(11);
    expect(() => query(`SET ROLE service_role; SET request.jwt.claim.role='service_role'; SELECT public.get_student_dslm_state_vector('${student}','${other}');`)).toThrow();
    expect(query('SELECT jsonb_agg(to_jsonb(m)) FROM public.student_skill_metrics m;')).toBe(before);
  });
  it('reads more than 1000 rows without a REST pagination limit', () => {
    query(`INSERT INTO public.student_skill_metrics SELECT '${emptyStudent}','${owner}','ns.bulk.'||n,'grammar','bulk',60,4,'stable',now() FROM generate_series(1,1200) n;`);
    expect(vector(emptyStudent).skill_count).toBe(1200);
  });
  it('uses strict 80 and 50 thresholds and a 30-day elapsed-time boundary', () => {
    query(`DELETE FROM public.student_skill_metrics WHERE student_id='${emptyStudent}';
      INSERT INTO public.student_skill_metrics VALUES
      ('${emptyStudent}','${owner}','ns.at80','grammar','at80',80,4,'stable',now()),
      ('${emptyStudent}','${owner}','ns.at50','grammar','at50',50,4,'stable',now()),
      ('${emptyStudent}','${owner}','ns.review','grammar','review',100,4,'stable',now()-interval '31 days');`);
    const result = vector(emptyStudent);
    expect(result.critical_gaps).toEqual([]);
    expect(result.strongest_skills.map((s: { micro_skill: string }) => s.micro_skill)).toEqual(['review']);
    expect(result.recommended_focus).toMatchObject({ skill_name: 'ns.review', reason: 'spaced_review' });
    // Use the RPC statement clock itself to avoid crossing the strict boundary between statements.
    const boundary = JSON.parse(query(`
      INSERT INTO public.student_skill_metrics VALUES
      ('${emptyStudent}','${owner}','ns.boundary','grammar','boundary',100,4,'stable',statement_timestamp()-interval '30 days');
      SET ROLE authenticated; SET request.jwt.claim.sub='${owner}'; SET request.jwt.claim.role='authenticated';
      SELECT public.get_student_dslm_state_vector('${emptyStudent}','${owner}');`));
    expect(boundary.strongest_skills.some((s: { micro_skill: string }) => s.micro_skill === 'boundary')).toBe(true);
    expect(boundary.decaying_skills.some((s: { micro_skill: string }) => s.micro_skill === 'boundary')).toBe(false);
  });
  it('computes micro averages without weighting by repetition count and scopes category keys', () => {
    query(`DELETE FROM public.student_skill_metrics WHERE student_id='${emptyStudent}';
      INSERT INTO public.student_skill_metrics VALUES
      ('${emptyStudent}','${owner}','ns.a','grammar','shared',20,100,'stable',now()),
      ('${emptyStudent}','${owner}','ns.b','grammar','shared',60,1,'stable',now()),
      ('${emptyStudent}','${owner}','ns.c','speaking','shared',95,4,'stable',now());`);
    const result = vector(emptyStudent);
    expect(result.critical_gaps[0]).toMatchObject({ effective_mastery: 40, nano_skill_count: 2, skill_observation_count: 101 });
    expect(result.strongest_skills[0]).toMatchObject({ skill_category: 'speaking', effective_mastery: 95 });
    expect(result.recommended_focus.skill_name).toBe('ns.a');
  });
  it.each(internalTables)('%s denies client access and preserves service CRUD after closure', (table) => {
    for (const role of ['anon', 'authenticated']) {
      expect(() => query(`SET ROLE ${role}; SELECT * FROM public.${table};`)).toThrow();
      expect(query(`SELECT has_table_privilege('${role}','public.${table}','TRUNCATE');`)).toBe('f');
    }
    expect(query(`SET ROLE service_role; SELECT value FROM public.${table};`)).toBe('1');
    expect(query(`SET ROLE service_role; INSERT INTO public.${table} VALUES (2);
      UPDATE public.${table} SET value=3 WHERE value=2;
      SELECT value FROM public.${table} WHERE value=3;`)).toBe('3');
    query(`SET ROLE service_role; DELETE FROM public.${table} WHERE value=3;`);
    expect(query(`SET ROLE service_role; SELECT count(*) FROM public.${table};`)).toBe('1');
    expect(query(`SELECT polroles::regrole[]::text FROM pg_policy
      WHERE polrelid='public.${table}'::regclass;`)).toBe('{service_role}');
  });
  it('the newsletter limiter denies both client roles while remaining service-executable', () => {
    for (const role of ['anon', 'authenticated']) {
      expect(() => query(`SET ROLE ${role}; SELECT public.consume_newsletter_rate_limit('key','action',5,900);`)).toThrow();
    }
    expect(query(`SET ROLE service_role; SELECT public.consume_newsletter_rate_limit('key','action',5,900);`)).toBe('t');
  });
});