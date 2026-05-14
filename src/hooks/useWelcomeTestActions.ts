/**
 * useWelcomeTestActions — v6.9.15c
 *
 * Reusable subset of WelcomeTestSuggestion's ensure-and-send flow. Lets any
 * surface (Roadmap warnings, etc.) ensure a Welcome Test exists and dispatch
 * the email without duplicating logic.
 *
 * - `ensure()`: idempotently creates the test row, seeds questions, generates
 *   a share token, and returns `{ testId, token, shareUrl }`.
 * - `send()`: ensure() + email via send-test-email + clipboard copy fallback.
 * - `getStatus()`: latest test status snapshot for this (student, teacher).
 */
import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStudentTests } from '@/hooks/useStudentTests';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';

interface UseWelcomeTestActionsProps {
  studentId: string;
  teacherId: string;
  studentName: string;
  studentEmail?: string | null;
}

export interface WelcomeTestSnapshot {
  testId: string | null;
  token: string | null;
  shareUrl: string | null;
  /** raw status from `student_tests.status` (or null when no test row). */
  status: 'pending' | 'in_progress' | 'completed' | 'reviewed' | null;
}

export function useWelcomeTestActions({
  studentId, teacherId, studentName, studentEmail,
}: UseWelcomeTestActionsProps) {
  const { createTest, addQuestions, generateShareToken } = useStudentTests({ studentId, teacherId });
  const [busy, setBusy] = useState(false);

  const getStatus = useCallback(async (): Promise<WelcomeTestSnapshot> => {
    const { data } = await supabase
      .from('student_tests')
      .select('id, status, share_token')
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .eq('test_type', 'welcome')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!data || data.length === 0) {
      return { testId: null, token: null, shareUrl: null, status: null };
    }
    const row = data[0] as any;
    const token = row.share_token ?? null;
    return {
      testId: row.id,
      token,
      shareUrl: token ? `${window.location.origin}/welcome-test/${token}` : null,
      status: row.status ?? 'pending',
    };
  }, [studentId, teacherId]);

  const ensure = useCallback(async (): Promise<WelcomeTestSnapshot | null> => {
    setBusy(true);
    try {
      const current = await getStatus();
      if (current.testId && current.token) return current;
      // Create row + seed questions if missing.
      let testId = current.testId;
      if (!testId) {
        const test = await createTest({
          student_id: studentId,
          test_type: 'welcome',
          title: `Welcome Test - ${studentName}`,
          description: 'Comprehensive placement & learning profile assessment',
          attempt_number: 1,
        });
        if (!test) return null;
        testId = test.id;
        const questionsToAdd = ALL_WELCOME_TEST_QUESTIONS.map((q: any) => ({
          question_type: q.question_type as any,
          question_text: q.question_text,
          question_data: (q.options ? { options: q.options } : {}) as any,
          correct_answer: (q.correct_answer || '') as any,
          explanation: q.description || undefined,
          element_type: q.element_type as any,
          difficulty_level: q.difficulty_level,
          skill_tags: q.nano_skill ? [q.nano_skill] : [],
        }));
        await addQuestions(testId, questionsToAdd);
      }
      const newToken = await generateShareToken(testId, 'welcome');
      if (!newToken) return null;
      return {
        testId,
        token: newToken,
        shareUrl: `${window.location.origin}/welcome-test/${newToken}`,
        status: current.status ?? 'pending',
      };
    } catch (err) {
      console.error('useWelcomeTestActions.ensure failed', err);
      toast.error('Failed to initialise Welcome Test');
      return null;
    } finally {
      setBusy(false);
    }
  }, [studentId, teacherId, studentName, createTest, addQuestions, generateShareToken, getStatus]);

  const send = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const ensured = await ensure();
      if (!ensured?.shareUrl) return false;
      try { await navigator.clipboard.writeText(ensured.shareUrl); } catch { /* ignore */ }
      if (studentEmail) {
        try {
          const { data: teacher } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', teacherId)
            .single();
          const teacherName = teacher
            ? [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') || teacher.email || ''
            : '';
          await supabase.functions.invoke('send-test-email', {
            body: {
              shareToken: ensured.token,
              recipientEmail: studentEmail,
              testTitle: `Welcome Test - ${studentName}`,
              teacherName,
              testType: 'welcome',
            },
          });
          toast.success('Welcome Test sent to the student.');
          return true;
        } catch (emailErr) {
          console.error('useWelcomeTestActions.send email error', emailErr);
          toast.success('Welcome Test created. Link copied. (Email send failed)');
          return true;
        }
      } else {
        toast.success('Welcome Test created. No student email on file — link copied to clipboard.');
        return true;
      }
    } finally {
      setBusy(false);
    }
  }, [ensure, studentEmail, studentName, teacherId]);

  return { ensure, send, getStatus, busy };
}
