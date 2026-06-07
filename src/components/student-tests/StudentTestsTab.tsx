/**
 * Student Tests Tab - Main component for viewing and managing tests
 * Round 8: Removed Create AI-Powered Test - only Welcome Test remains
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Loader2, Eye, Sparkles, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStudentTests } from '@/hooks/useStudentTests';
import { TEST_STATUS_CONFIG } from '@/types/studentTests';
import type { StudentTest } from '@/types/studentTests';
import { TestDetailsView } from './TestDetailsView';
import { WelcomeTestComparisonView } from '@/components/welcome-test/WelcomeTestComparisonView';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';
import { getWelcomeTestTotal } from '@/utils/welcomeTestNumbering';
import { TestDates } from './TestDates';
import { toast } from 'sonner';
import {
  WelcomeTestActionsPanel,
  type WelcomeTestActionsState,
} from '@/components/welcome-test/WelcomeTestActionsPanel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { sendWelcomeTestEmail } from '@/lib/welcomeTest/ensureWelcomeTest';

interface StudentTestsTabProps {
  studentId: string;
  teacherId: string;
  studentName?: string;
}

export function StudentTestsTab({ studentId, teacherId, studentName }: StudentTestsTabProps) {
  const { tests, loading, getTestStats, refetch, createTest, addQuestions, generateShareToken } = useStudentTests({ studentId, teacherId });
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [creatingPreview, setCreatingPreview] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const stats = getTestStats();

  // v6.9.40 P2 — Each Welcome Test attempt is now its own card. The
  // "latest" attempt (highest attempt_number, fallback created_at) owns the
  // action panel for sending/retake; older ones are read-only entries.
  const welcomeAttempts = useMemo(() => {
    const ws = tests.filter(t => t.test_type === 'welcome');
    return [...ws].sort((a, b) => {
      const an = (a as any).attempt_number ?? 1;
      const bn = (b as any).attempt_number ?? 1;
      if (an !== bn) return bn - an;
      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    });
  }, [tests]);
  const welcomeTest = welcomeAttempts[0]; // latest attempt drives banners + retake
  const hasWelcomeTest = !!welcomeTest;

  const welcomeCardTitle = (t: StudentTest): string => {
    const n = (t as any).attempt_number ?? 1;
    return n <= 1 ? 'Initial Welcome Test' : `Welcome Test — Retake ${n - 1}`;
  };

  // WT-6 (v6.9.27): only count COMPLETED/reviewed attempts so the Compare
  // button no longer surfaces "2 tests" when only one is actually finished.
  const welcomeAttemptsCount = useMemo(
    () => tests.filter(t =>
      t.test_type === 'welcome' && (t.status === 'completed' || t.status === 'reviewed')
    ).length,
    [tests],
  );

  /** Plan v6.0 — lazy-creates a Welcome Test + share token if missing. */
  const ensureWelcomeTest = useCallback(async (): Promise<{ testId: string; token: string } | null> => {
    let testToUse = welcomeTest;
    if (!testToUse) {
      const { data: student } = await supabase
        .from('students').select('name, student_email').eq('id', studentId).maybeSingle();
      testToUse = await createTest({
        student_id: studentId,
        test_type: 'welcome',
        title: `Welcome Test - ${student?.name || studentName || 'Student'}`,
        description: 'Comprehensive placement & learning profile assessment',
        attempt_number: 1,
      });
      if (!testToUse) return null;
      const questionsToAdd = ALL_WELCOME_TEST_QUESTIONS.map(q => ({
        question_type: q.question_type as any,
        question_text: q.question_text,
        question_data: (q.options ? { options: q.options } : {}) as any,
        correct_answer: (q.correct_answer || '') as any,
        explanation: q.description || undefined,
        element_type: q.element_type as any,
        difficulty_level: q.difficulty_level,
        skill_tags: q.nano_skill ? [q.nano_skill] : [],
      }));
      await addQuestions(testToUse.id, questionsToAdd);
    }
    let token = testToUse.share_token;
    if (!token) {
      token = await generateShareToken(testToUse.id, 'welcome');
    }
    if (!token) return null;
    refetch();
    return { testId: testToUse.id, token };
  }, [welcomeTest, studentId, studentName, createTest, addQuestions, generateShareToken, refetch]);

  const handlePreviewTest = async () => {
    setCreatingPreview(true);
    try {
      const ensured = await ensureWelcomeTest();
      if (ensured) {
        window.open(`${window.location.origin}/welcome-test/${ensured.token}?preview=1`, '_blank');
      }
    } catch (err) {
      console.error('Error creating preview:', err);
    } finally {
      setCreatingPreview(false);
    }
  };

  const handleCopyLink = async () => {
    const ensured = await ensureWelcomeTest();
    if (!ensured) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/welcome-test/${ensured.token}`);
      toast.success('Welcome (placement) Test link copied');
    } catch { toast.error('Failed to copy'); }
  };

  const handleSendEmail = async () => {
    const ensured = await ensureWelcomeTest();
    if (!ensured) return;
    const { data: student } = await supabase
      .from('students').select('student_email, name').eq('id', studentId).maybeSingle();
    if (!student?.student_email) {
      try { await navigator.clipboard.writeText(`${window.location.origin}/welcome-test/${ensured.token}`); } catch {}
      toast.message('No student email on file — link copied to clipboard.');
      return;
    }
    const { data: teacher } = await supabase
      .from('profiles').select('first_name, last_name, email').eq('id', teacherId).single();
    const teacherName = teacher
      ? [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') || teacher.email || ''
      : '';
    try {
      await supabase.functions.invoke('send-test-email', {
        body: {
          shareToken: ensured.token,
          recipientEmail: student.student_email,
          testTitle: `Welcome Test - ${student.name || studentName || 'Student'}`,
          teacherName,
          testType: 'welcome',
        },
      });
      toast.success('Welcome (placement) Test sent to the student.');
    } catch (err) {
      console.error('send-test-email failed', err);
      toast.error('Failed to send email');
    }
  };

  const sortedTests = [...tests].sort((a, b) => {
    if (a.test_type === 'welcome' && b.test_type !== 'welcome') return -1;
    if (a.test_type !== 'welcome' && b.test_type === 'welcome') return 1;
    return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
  });

  const handleRefreshWelcomeLink = async (): Promise<string | null> => {
    const ensured = await ensureWelcomeTest();
    if (!ensured) return null;
    const newToken = await generateShareToken(ensured.testId, 'welcome');
    if (newToken) refetch();
    return newToken;
  };

  /** v6.9.40 — Re-take always uses the latest attempt as previous, and asks
   *  for confirmation when the latest attempt is not yet completed. */
  const [retaking, setRetaking] = useState(false);
  const [confirmRetakeOpen, setConfirmRetakeOpen] = useState(false);
  const handleRetake = () => {
    if (!welcomeTest) return;
    const completed = welcomeTest.status === 'completed' || welcomeTest.status === 'reviewed';
    if (!completed) {
      setConfirmRetakeOpen(true);
      return;
    }
    void runRetake();
  };
  const runRetake = async () => {
    if (!welcomeTest) return;
    setRetaking(true);
    try {
      // Always derive next attempt from the MAX across all welcome rows
      // (not just the currently-displayed completed one). Prevents collisions
      // when older retakes exist as separate cards.
      const maxAttempt = welcomeAttempts.reduce(
        (m, t) => Math.max(m, ((t as any).attempt_number ?? 1)), 0,
      );
      const nextAttempt = maxAttempt + 1;
      const { data: student } = await supabase
        .from('students').select('name').eq('id', studentId).maybeSingle();
      const newTest = await createTest({
        student_id: studentId,
        test_type: 'welcome',
        title: `Welcome Test - ${student?.name || studentName || 'Student'} (Retake ${nextAttempt - 1})`,
        description: 'Re-take — comparing growth against the previous attempt',
        attempt_number: nextAttempt,
        previous_attempt_id: welcomeTest.id,
      });
      if (!newTest) return;
      const questionsToAdd = ALL_WELCOME_TEST_QUESTIONS.map(q => ({
        question_type: q.question_type as any,
        question_text: q.question_text,
        question_data: (q.options ? { options: q.options } : {}) as any,
        correct_answer: (q.correct_answer || '') as any,
        explanation: q.description || undefined,
        element_type: q.element_type as any,
        difficulty_level: q.difficulty_level,
        skill_tags: q.nano_skill ? [q.nano_skill] : [],
      }));
      await addQuestions(newTest.id, questionsToAdd);
      const newToken = await generateShareToken(newTest.id, 'welcome');
      refetch();
      // v6.9.41 P3 — auto-email the new retake link.
      const studentEmail = (student as any)?.student_email as string | null | undefined;
      if (newToken && studentEmail) {
        try {
          await sendWelcomeTestEmail({
            token: newToken,
            recipientEmail: studentEmail,
            studentName: student?.name || studentName || 'Student',
            teacherId,
            attemptNumber: nextAttempt,
          });
          toast.success(`Retake ${nextAttempt - 1} created and emailed to the student.`);
        } catch (mailErr) {
          console.error('retake email failed', mailErr);
          if (newToken) {
            try { await navigator.clipboard.writeText(`${window.location.origin}/welcome-test/${newToken}`); } catch {}
          }
          toast.success(`Retake ${nextAttempt - 1} created. Email failed — link copied to clipboard.`);
        }
      } else {
        if (newToken) {
          try { await navigator.clipboard.writeText(`${window.location.origin}/welcome-test/${newToken}`); } catch {}
        }
        toast.success(`Retake ${nextAttempt - 1} created. No student email on file — link copied to clipboard.`);
      }
      window.dispatchEvent(new CustomEvent('student-tests:refresh', { detail: { studentId } }));
    } catch (err) {
      console.error('handleRetake failed', err);
      toast.error('Failed to create re-take');
    } finally {
      setRetaking(false);
    }
  };

  // v6.9.39 P2 — refresh list whenever any retake path fires the event.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.studentId && detail.studentId !== studentId) return;
      refetch();
    };
    window.addEventListener('student-tests:refresh', handler as EventListener);
    return () => window.removeEventListener('student-tests:refresh', handler as EventListener);
  }, [studentId, refetch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading tests...</span>
      </div>
    );
  }

  if (selectedTestId) {
    return (
      <TestDetailsView
        testId={selectedTestId}
        teacherId={teacherId}
        studentId={studentId}
        onBack={() => {
          setSelectedTestId(null);
          refetch();
        }}
      />
    );
  }

  if (showComparison) {
    return (
      <WelcomeTestComparisonView
        studentId={studentId}
        teacherId={teacherId}
        studentName={studentName}
        onBack={() => setShowComparison(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Tests</h2>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-muted-foreground">
            {stats.total} tests • {stats.completed} completed
          </p>
          {welcomeAttemptsCount >= 2 && (
            <Button variant="outline" size="sm" onClick={() => setShowComparison(true)}>
              <TrendingUp className="h-4 w-4 mr-1" />
              Compare attempts ({welcomeAttemptsCount})
            </Button>
          )}
        </div>
      </div>

      {/* v6.9.40 P2 — one card per Welcome Test attempt. Latest attempt owns
          the full WelcomeTestActionsPanel; older attempts are read-only. */}
      {!hasWelcomeTest && (
        <Card className="border-primary/30 border-dashed">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Welcome (placement) Test</h3>
                  <p className="text-sm text-muted-foreground">
                    Welcome Test • {ALL_WELCOME_TEST_QUESTIONS.length} questions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-muted text-muted-foreground">Not sent yet</Badge>
                <WelcomeTestActionsPanel
                  state="no_test"
                  shareUrl={null}
                  hasAnyAnswer={false}
                  onCopy={handleCopyLink}
                  onSend={handleSendEmail}
                  onRefreshLink={handleRefreshWelcomeLink}
                  onPreview={handlePreviewTest}
                  sending={creatingPreview}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {welcomeAttempts.map((attempt, idx) => {
        const isLatest = idx === 0;
        const attemptNumber = (attempt as any).attempt_number ?? 1;
        const cardTitle = welcomeCardTitle(attempt);
        const statusCfg = TEST_STATUS_CONFIG[attempt.status];
        const statusLabel = statusCfg?.label ?? attempt.status;
        const statusClass = `${statusCfg?.bgColor ?? 'bg-muted'} ${statusCfg?.color ?? 'text-muted-foreground'}`;
        const answered = attempt.answered_count ?? 0;
        const total = getWelcomeTestTotal(attempt);
        const shareUrl = attempt.share_token
          ? `${window.location.origin}/welcome-test/${attempt.share_token}`
          : null;
        const panelState: WelcomeTestActionsState =
          attempt.status === 'completed' || attempt.status === 'reviewed' ? 'completed'
          : attempt.status === 'in_progress' ? 'in_progress'
          : 'pending';
        return (
          <Card key={attempt.id} className={`border-primary/30 ${isLatest ? '' : 'opacity-90'}`}>
            <CardContent className="py-4 space-y-3">
              {/* v6.9.42 — stack-first: title block full width, then actions row. */}
              <div
                className="flex items-start gap-3 min-w-0 cursor-pointer"
                onClick={() => setSelectedTestId(attempt.id)}
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold break-words">{cardTitle}</h3>
                    {isLatest && welcomeAttempts.length > 1 && (
                      <Badge variant="outline" className="text-[10px] shrink-0">Latest</Badge>
                    )}
                    <Badge className={`${statusClass} shrink-0`}>{statusLabel}</Badge>
                    {attempt.score_percentage !== null && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        · {answered}/{total} answered
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Welcome Test • {total} questions
                    {attemptNumber > 1 && (
                      <span className="ml-2 text-primary">· Attempt #{attemptNumber}</span>
                    )}
                  </p>
                  <TestDates
                    createdAt={attempt.created_at}
                    completedAt={(attempt as any).completed_at}
                    reviewedAt={(attempt as any).reviewed_at}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-start lg:justify-end">
                {isLatest ? (
                  <WelcomeTestActionsPanel
                    state={panelState}
                    shareUrl={shareUrl}
                    hasAnyAnswer={answered > 0}
                    onCopy={handleCopyLink}
                    onSend={handleSendEmail}
                    onRefreshLink={handleRefreshWelcomeLink}
                    onPreview={handlePreviewTest}
                    onViewResults={() => setSelectedTestId(attempt.id)}
                    onRetake={handleRetake}
                    sending={creatingPreview}
                    retaking={retaking}
                    compact
                    className="justify-start lg:justify-end"
                  />
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setSelectedTestId(attempt.id)}>
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Tests list (non-welcome) */}
      {sortedTests.filter(t => t.test_type !== 'welcome').length === 0 && !hasWelcomeTest ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tests yet</h3>
            <p className="text-muted-foreground">
              Send the Welcome Test to this student to get started with placement & profiling.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sortedTests.filter(t => t.test_type !== 'welcome').map((test) => (
            <TestCard 
              key={test.id} 
              test={test} 
              onClick={() => setSelectedTestId(test.id)}
            />
          ))}
        </div>
      )}

      {/* Info about Welcome Test */}
      <Card className="bg-muted/30 border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Welcome Test
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• <strong>Comprehensive Placement</strong> - estimates CEFR level from grammar, vocabulary, reading & writing tasks</p>
          <p>• <strong>Learning Profile</strong> - discovers motivation, anxiety, learning style & preferences</p>
          <p>• <strong>AI Analysis</strong> - generates teaching recommendations from open-ended answers</p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmRetakeOpen} onOpenChange={setConfirmRetakeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create another Welcome Test retake?</AlertDialogTitle>
            <AlertDialogDescription>
              The latest attempt is still open. Retakes are usually useful after
              8–12 weeks of lessons or after a clear learning block has finished.
              Creating another one now will leave multiple unfinished links active
              and can confuse the student.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current attempt</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmRetakeOpen(false); void runRetake(); }}>
              Create retake anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TestCardProps {
  test: StudentTest;
  onClick: () => void;
}

function TestCard({ test, onClick }: TestCardProps) {
  const statusConfig = TEST_STATUS_CONFIG[test.status];
  const isWelcome = test.test_type === 'welcome';

  return (
    <Card 
      className={`hover:shadow-md transition-shadow cursor-pointer ${isWelcome ? 'border-primary/30' : ''}`}
      onClick={onClick}
    >
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {isWelcome ? <Sparkles className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-semibold">{test.title}</h3>
              <p className="text-sm text-muted-foreground">
                {isWelcome ? 'Welcome (placement) Test' : test.test_type} • {isWelcome ? getWelcomeTestTotal(test) : (test.total_questions || 0)} questions
              </p>
              <TestDates
                createdAt={test.created_at}
                completedAt={(test as any).completed_at}
                reviewedAt={(test as any).reviewed_at}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {test.score_percentage !== null && (
              <div className="text-right">
                {isWelcome ? (
                  <>
                    <div className="text-lg font-bold">{test.answered_count || test.correct_answers || 0}/{getWelcomeTestTotal(test)}</div>
                    <div className="text-xs text-muted-foreground">answered</div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">{test.score_percentage.toFixed(0)}%</div>
                    <div className="text-xs text-muted-foreground">
                      {test.correct_answers}/{test.total_questions} correct
                    </div>
                  </>
                )}
              </div>
            )}
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>
              {statusConfig.label}
            </Badge>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
