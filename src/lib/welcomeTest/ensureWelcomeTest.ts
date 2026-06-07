/**
 * v6.9.36 — Canonical helper for ensuring a Welcome Test exists for a given
 * (student, teacher) pair and sending its share link by email. Plain async
 * functions (no React hooks) so they can be called from anywhere — including
 * UI dialogs that own their own navigation (e.g. AddStudentDialog inline
 * auto-send after creating a student).
 *
 * Workflow:
 *  1. Look up the most recent welcome test row.
 *  2. If none exists, INSERT one with `status: 'draft'` (DB CHECK constraint
 *     rejects 'pending') and seed the canonical question bank exactly once.
 *  3. Generate a 90-day share token via `generate_test_share_token` RPC.
 *  4. Bump status to `assigned` and stamp `assigned_at` (the RPC only writes
 *     the token; status is owned by the application layer).
 *  5. Return `{ testId, token, shareUrl }`.
 *
 * Sanctity: no Worksheet Generation Engine changes, no schema changes, no
 * new RLS. All reads/writes go through existing RLS-protected policies.
 */
import { supabase } from '@/integrations/supabase/client';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';

export interface EnsureWelcomeTestArgs {
  studentId: string;
  teacherId: string;
  studentName: string;
}

export interface EnsuredWelcomeTest {
  testId: string;
  token: string;
  shareUrl: string;
}

const WELCOME_TEST_TTL_HOURS = 90 * 24;

/** Build the canonical question rows once so both seed paths stay in sync. */
function buildSeedQuestions(testId: string) {
  return ALL_WELCOME_TEST_QUESTIONS.map((q: any, i: number) => ({
    test_id: testId,
    question_index: i,
    question_type: q.question_type,
    question_text: q.question_text,
    question_data: q.options ? { options: q.options } : {},
    correct_answer: q.correct_answer || '',
    explanation: q.description || null,
    element_type: q.element_type || null,
    difficulty_level: q.difficulty_level || 3,
    skill_tags: q.nano_skill ? [q.nano_skill] : [],
  }));
}

export async function ensureWelcomeTest(
  { studentId, teacherId, studentName }: EnsureWelcomeTestArgs,
): Promise<EnsuredWelcomeTest> {
  // 1. Latest existing welcome test (newest first, never .single()).
  const { data: existing, error: lookupErr } = await supabase
    .from('student_tests')
    .select('id, share_token, status')
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .eq('test_type', 'welcome')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1);
  if (lookupErr) throw lookupErr;

  let testId: string | null = existing?.[0]?.id ?? null;
  let token: string | null = existing?.[0]?.share_token ?? null;

  // 2. Create + seed if missing.
  if (!testId) {
    const { data: created, error: createErr } = await supabase
      .from('student_tests')
      .insert({
        student_id: studentId,
        teacher_id: teacherId,
        test_type: 'welcome',
        title: `Welcome Test - ${studentName}`,
        description: 'Comprehensive placement & learning profile assessment',
        status: 'draft',
        attempt_number: 1,
        total_questions: ALL_WELCOME_TEST_QUESTIONS.length,
      } as any)
      .select('id')
      .single();
    if (createErr || !created) throw createErr ?? new Error('Failed to create welcome test');
    testId = created.id;

    // Seed questions only if none exist (idempotent against retries).
    const { count: existingQs } = await supabase
      .from('student_test_questions')
      .select('id', { count: 'exact', head: true })
      .eq('test_id', testId);
    if (!existingQs || existingQs === 0) {
      const rows = buildSeedQuestions(testId);
      const { error: seedErr } = await supabase
        .from('student_test_questions')
        .insert(rows as any);
      if (seedErr) throw seedErr;
    }
  }

  // 3. Generate share token via RPC if missing.
  if (!token) {
    const { data: rpcToken, error: tokErr } = await supabase.rpc(
      'generate_test_share_token',
      { p_test_id: testId, p_teacher_id: teacherId, p_expires_hours: WELCOME_TEST_TTL_HOURS },
    );
    if (tokErr) throw tokErr;
    token = (rpcToken as string | null) ?? null;
  }
  if (!token) throw new Error('Failed to generate welcome test share token');

  // 4. Status hand-off: draft → assigned (RPC does NOT touch status).
  await supabase
    .from('student_tests')
    .update({ status: 'assigned', assigned_at: new Date().toISOString() } as any)
    .eq('id', testId)
    .in('status', ['draft']);

  return {
    testId: testId!,
    token,
    shareUrl: `${window.location.origin}/welcome-test/${token}`,
  };
}

export interface SendWelcomeTestEmailArgs {
  token: string;
  recipientEmail: string;
  studentName: string;
  teacherId: string;
  reminder?: boolean;
  /**
   * v6.9.42 — attempt number for retake-aware subject/body. 1 = initial,
   * 2+ = retake (retake index = attemptNumber - 1).
   */
  attemptNumber?: number;
}

export async function sendWelcomeTestEmail(
  { token, recipientEmail, studentName, teacherId, reminder = false, attemptNumber = 1 }: SendWelcomeTestEmailArgs,
): Promise<void> {
  // Use maybeSingle() so a missing profile does not bubble 406 console noise.
  const { data: teacher } = await supabase
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', teacherId)
    .maybeSingle();
  const teacherName = teacher
    ? [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') || teacher.email || ''
    : '';

  const retakeNumber = attemptNumber > 1 ? attemptNumber - 1 : 0;
  const titleSuffix = retakeNumber > 0 ? ` (Retake ${retakeNumber})` : '';

  const { error } = await supabase.functions.invoke('send-test-email', {
    body: {
      shareToken: token,
      recipientEmail,
      testTitle: `Welcome Test${titleSuffix} - ${studentName}`,
      teacherName,
      testType: 'welcome',
      reminder,
      retakeNumber,
    },
  });
  if (error) throw error;
}