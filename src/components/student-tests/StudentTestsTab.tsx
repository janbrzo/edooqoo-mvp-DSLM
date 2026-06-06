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

  // WT-3 (v6.9.27): prefer completed/reviewed > in_progress > others so the
  // surfaced welcome test is the meaningful one, not an empty duplicate.
  const welcomeTest = useMemo(() => {
    const ws = tests.filter(t => t.test_type === 'welcome');
    return ws.find(t => t.status === 'completed' || t.status === 'reviewed')
        ?? ws.find(t => t.status === 'in_progress')
        ?? ws[0];
  }, [tests]);
  const hasWelcomeTest = !!welcomeTest;

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
        .from('students').select('name').eq('id', studentId).maybeSingle();
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

  /** Plan v6.1 — Re-take: clones the welcome test as a new attempt linked to the previous one. */
  const [retaking, setRetaking] = useState(false);
  // v6.9.39 P2 — confirmation modal when the current attempt isn't completed.
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
      const nextAttempt = ((welcomeTest as any).attempt_number ?? 1) + 1;
      const { data: student } = await supabase
        .from('students').select('name').eq('id', studentId).maybeSingle();
      const newTest = await createTest({
        student_id: studentId,
        test_type: 'welcome',
        title: `Welcome Test - ${student?.name || studentName || 'Student'} (Attempt #${nextAttempt})`,
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
      await generateShareToken(newTest.id, 'welcome');
      refetch();
      toast.success(`Attempt #${nextAttempt} created. Use Send/Copy to share with the student.`);
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

  const welcomeShareUrl = welcomeTest?.share_token
    ? `${window.location.origin}/welcome-test/${welcomeTest.share_token}`
    : null;

  const welcomePanelState: WelcomeTestActionsState = welcomeTest
    ? (welcomeTest.status === 'completed' || welcomeTest.status === 'reviewed'
        ? 'completed'
        : welcomeTest.status === 'in_progress'
          ? 'in_progress'
          : 'pending')
    : 'no_test';

  const welcomeAnsweredCount = welcomeTest?.answered_count ?? 0;
  const welcomeStatusLabel = welcomeTest
    ? TEST_STATUS_CONFIG[welcomeTest.status]?.label
    : 'Not sent yet';
  const welcomeStatusClass = welcomeTest
    ? `${TEST_STATUS_CONFIG[welcomeTest.status]?.bgColor} ${TEST_STATUS_CONFIG[welcomeTest.status]?.color}`
    : 'bg-muted text-muted-foreground';

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

      {/* Plan v6.0 — single Welcome Test card, always rendered with all 5 actions */}
      <Card className={`border-primary/30 ${!hasWelcomeTest ? 'border-dashed' : ''}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => welcomeTest && setSelectedTestId(welcomeTest.id)}>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{welcomeTest?.title ?? 'Welcome (placement) Test'}</h3>
                <p className="text-sm text-muted-foreground">
                  Welcome Test • {welcomeTest ? getWelcomeTestTotal(welcomeTest) : ALL_WELCOME_TEST_QUESTIONS.length} questions
                  {welcomeTest && (welcomeTest as any).attempt_number > 1 && (
                    <span className="ml-2 text-primary">· Attempt #{(welcomeTest as any).attempt_number}</span>
                  )}
                </p>
                {welcomeTest && (
                  <TestDates
                    createdAt={welcomeTest.created_at}
                    completedAt={(welcomeTest as any).completed_at}
                    reviewedAt={(welcomeTest as any).reviewed_at}
                    className="mt-1"
                  />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {welcomeTest && welcomeTest.score_percentage !== null && (
                <div className="text-right mr-2">
                  <div className="text-lg font-bold">{welcomeAnsweredCount}/{getWelcomeTestTotal(welcomeTest)}</div>
                  <div className="text-xs text-muted-foreground">answered</div>
                </div>
              )}
              <Badge className={welcomeStatusClass}>{welcomeStatusLabel}</Badge>
              <WelcomeTestActionsPanel
                state={welcomePanelState}
                shareUrl={welcomeShareUrl}
                hasAnyAnswer={welcomeAnsweredCount > 0}
                onCopy={handleCopyLink}
                onSend={handleSendEmail}
                onRefreshLink={handleRefreshWelcomeLink}
                onPreview={handlePreviewTest}
                onViewResults={welcomeTest ? () => setSelectedTestId(welcomeTest.id) : undefined}
                onRetake={welcomeTest ? handleRetake : undefined}
                sending={creatingPreview}
                retaking={retaking}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
            <AlertDialogTitle>Create another Welcome Test attempt?</AlertDialogTitle>
            <AlertDialogDescription>
              The current attempt is not completed yet. Re-take usually makes sense
              about 30 days after the previous test is finished — that's enough time
              for new learning signals to accumulate. Creating another attempt now
              will leave the previous one open and may cause confusion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmRetakeOpen(false); void runRetake(); }}>
              Create new attempt anyway
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
