/**
 * WelcomeTestSuggestion - Overview banner with the always-on Welcome Test action panel.
 * Plan v6.0: all 5 buttons visible regardless of state. The first click on any
 * button lazily creates the test record + share token via `ensureWelcomeTest()`.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Loader2, X, Info, Undo2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useStudentTests } from '@/hooks/useStudentTests';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  WelcomeTestActionsPanel,
  type WelcomeTestActionsState,
} from '@/components/welcome-test/WelcomeTestActionsPanel';

interface WelcomeTestSuggestionProps {
  studentId: string;
  teacherId: string;
  studentName: string;
  studentEmail?: string | null;
  /**
   * Which Student Page surface this banner is rendered on. Each surface
   * keeps its own dismissal state so hiding the banner in Overview does
   * NOT also hide it in 1 MINUTE (and vice versa). v6.8.5.
   */
  surface?: 'overview' | 'oneMinute';
}

export function WelcomeTestSuggestion({ studentId, teacherId, studentName, studentEmail, surface = 'overview' }: WelcomeTestSuggestionProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'no_test' | 'pending' | 'in_progress' | 'completed' | 'hidden'>('loading');
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  // 10-second dismiss countdown state. When non-null, the banner area renders
  // an ephemeral confirmation message with an Undo button instead of the full banner.
  const [dismissCountdown, setDismissCountdown] = useState<number | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  // Cached pre-dismiss status so Undo can restore the previous state.
  const preDismissStatusRef = useRef<typeof status>('loading');
  // WT-2 (v6.9.27): tracks the in-flight initial DB check so that any action
  // (Copy/Send/Preview/Refresh Link) waits for it instead of racing and
  // creating a duplicate welcome test row.
  const checkPromiseRef = useRef<Promise<void> | null>(null);
  const { createTest, addQuestions, generateShareToken } = useStudentTests({ studentId, teacherId });

  useEffect(() => {
    checkPromiseRef.current = checkWelcomeTest();
  }, [studentId, teacherId]);

  // Poll for progress when pending/in_progress
  useEffect(() => {
    if ((status === 'pending' || status === 'in_progress') && testId) {
      const interval = setInterval(fetchProgress, 10000); // every 10s
      fetchProgress();
      return () => clearInterval(interval);
    }
  }, [status, testId]);

  const checkWelcomeTest = async (): Promise<void> => {
    const DISMISS_KEY = `welcome_test_dismissed_${surface}_${studentId}`;
    if (localStorage.getItem(DISMISS_KEY) === 'true') {
      setStatus('hidden');
      return;
    }
    try {
      const { data } = await supabase
        .from('student_tests')
        .select('id, status, share_token, total_questions, answered_count, created_at')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .eq('test_type', 'welcome')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (!data || data.length === 0) {
        setStatus('no_test');
      } else {
        // WT-3 (v6.9.27): prefer completed/reviewed > in_progress > others.
        // Avoids surfacing a stale empty duplicate over the real result.
        const test =
          data.find((t: any) => t.status === 'completed' || t.status === 'reviewed') ??
          data.find((t: any) => t.status === 'in_progress') ??
          data[0];
        setTestId(test.id);
        setTotalQuestions(test.total_questions || 0);
        setAnsweredCount((test as any).answered_count || 0);
        
        if (test.share_token) {
          setShareUrl(`${window.location.origin}/welcome-test/${test.share_token}`);
        }

        if (test.status === 'completed' || test.status === 'reviewed') {
          setStatus('completed');
        } else if (test.status === 'in_progress') {
          setStatus('in_progress');
        } else {
          setStatus('pending');
        }
      }
    } catch (err) {
      console.error('Error checking welcome test:', err);
      setStatus('no_test');
    }
  };

  const fetchProgress = useCallback(async () => {
    if (!testId) return;
    try {
      const { count } = await supabase
        .from('student_test_questions')
        .select('*', { count: 'exact', head: true })
        .eq('test_id', testId)
        .not('student_answer', 'is', null);

      if (count !== null) {
        setAnsweredCount(count);
        if (count > 0 && status === 'pending') {
          setStatus('in_progress');
        }
      }
    } catch (err) {
      // silent
    }
  }, [testId, status]);

  /**
   * Lazily ensures a Welcome Test row + share token exist for this student.
   * Returns the testId + token so caller can act immediately.
   */
  const ensureWelcomeTest = async (): Promise<{ testId: string; token: string } | null> => {
    // WT-2: wait for initial DB check before any create-or-reuse decision.
    if (checkPromiseRef.current) {
      try { await checkPromiseRef.current; } catch { /* ignore */ }
    }
    // Already initialised
    if (testId && shareUrl) {
      const existingToken = shareUrl.split('/').pop() ?? '';
      return { testId, token: existingToken };
    }
    // Test exists but no token (defensive)
    if (testId && !shareUrl) {
      const newToken = await generateShareToken(testId, 'welcome');
      if (!newToken) return null;
      setShareUrl(`${window.location.origin}/welcome-test/${newToken}`);
      return { testId, token: newToken };
    }

    // Create everything from scratch
    setCreating(true);
    try {
      const test = await createTest({
        student_id: studentId,
        test_type: 'welcome',
        title: `Welcome Test - ${studentName}`,
        description: 'Comprehensive placement & learning profile assessment',
        attempt_number: 1,
      });
      if (!test) return null;

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
      await addQuestions(test.id, questionsToAdd);

      const token = await generateShareToken(test.id, 'welcome');
      if (!token) return null;

      const url = `${window.location.origin}/welcome-test/${token}`;
      setTestId(test.id);
      setShareUrl(url);
      setTotalQuestions(questionsToAdd.length);
      setStatus('pending');
      return { testId: test.id, token };
    } catch (err) {
      console.error('ensureWelcomeTest failed', err);
      toast.error('Failed to initialise Welcome Test');
      return null;
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    const ensured = await ensureWelcomeTest();
    if (!ensured) return;
    const url = `${window.location.origin}/welcome-test/${ensured.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Welcome Test link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleSend = async () => {
    setCreating(true);
    try {
      const ensured = await ensureWelcomeTest();
      if (!ensured) return;
      const url = `${window.location.origin}/welcome-test/${ensured.token}`;

      // Always copy as a convenience
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // silent
      }

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
          } catch (emailErr) {
            console.error('Email send error:', emailErr);
            toast.success('Welcome Test created! Link copied. (Email send failed)');
          }
        } else {
          toast.success('Welcome Test created. No student email on file — link copied to clipboard.');
        }
    } catch (err) {
      console.error('handleSend failed', err);
      toast.error('Failed to send Welcome Test');
    } finally {
      setCreating(false);
    }
  };

  const handlePreview = async () => {
    const ensured = await ensureWelcomeTest();
    if (!ensured) return;
    window.open(`${window.location.origin}/welcome-test/${ensured.token}?preview=1`, '_blank');
  };

  const handleRefreshLink = async (): Promise<string | null> => {
    // Lazily create the test if it does not yet exist so Refresh works on day 0.
    const ensured = await ensureWelcomeTest();
    if (!ensured) return null;
    const newToken = await generateShareToken(ensured.testId, 'welcome');
    if (newToken) {
      const url = `${window.location.origin}/welcome-test/${newToken}`;
      setShareUrl(url);
    }
    return newToken;
  };

  const handleViewResults = () => {
    if (testId) {
      navigate(`/student/${studentId}?tab=tests&testId=${testId}`);
    } else {
      navigate(`/student/${studentId}?tab=tests`);
    }
  };

  /**
   * Plan v6.1 — Re-take Test: creates a new attempt linked to the previous one.
   * Reuses the same questions for now (Form B variant will be added when the
   * question bank is split). Generates a fresh share token + navigates the
   * teacher to the Tests tab so they can send/preview the new attempt.
   */
  const [retaking, setRetaking] = useState(false);
  const handleRetake = async () => {
    if (!testId) return;
    setRetaking(true);
    try {
      // Determine next attempt number from existing welcome tests for this student.
      const { data: existing } = await supabase
        .from('student_tests')
        .select('attempt_number')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .eq('test_type', 'welcome')
        .is('deleted_at', null);
      const nextAttempt = (existing?.reduce((m, r: any) => Math.max(m, r.attempt_number ?? 1), 0) ?? 0) + 1;

      const newTest = await createTest({
        student_id: studentId,
        test_type: 'welcome',
        title: `Welcome Test - ${studentName} (Attempt #${nextAttempt})`,
        description: 'Re-take — comparing growth against the previous attempt',
        attempt_number: nextAttempt,
        previous_attempt_id: testId,
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
      const token = await generateShareToken(newTest.id, 'welcome');
      if (!token) return;

      // Reset banner to point at the new attempt.
      setTestId(newTest.id);
      setShareUrl(`${window.location.origin}/welcome-test/${token}`);
      setTotalQuestions(questionsToAdd.length);
      setAnsweredCount(0);
      setStatus('pending');
      toast.success(`Attempt #${nextAttempt} created. Send the new link to the student.`);
    } catch (err) {
      console.error('handleRetake failed', err);
      toast.error('Failed to create re-take');
    } finally {
      setRetaking(false);
    }
  };

  if (status === 'loading' || status === 'hidden') return null;

  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const panelState: WelcomeTestActionsState =
    status === 'no_test' ? 'no_test'
    : status === 'completed' ? 'completed'
    : status === 'in_progress' ? 'in_progress'
    : 'pending';

  const DISMISS_KEY = `welcome_test_dismissed_${surface}_${studentId}`;
  const surfaceLabel = surface === 'oneMinute' ? '1 MINUTE' : 'Overview';

  const handleDismiss = () => {
    // Persist dismissal IMMEDIATELY so a refresh during the countdown keeps
    // the banner hidden — Undo will clear it back.
    localStorage.setItem(DISMISS_KEY, 'true');
    preDismissStatusRef.current = status;
    setDismissCountdown(10);
    if (dismissTimerRef.current) window.clearInterval(dismissTimerRef.current);
    dismissTimerRef.current = window.setInterval(() => {
      setDismissCountdown(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (dismissTimerRef.current) {
            window.clearInterval(dismissTimerRef.current);
            dismissTimerRef.current = null;
          }
          setStatus('hidden');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleUndoDismiss = () => {
    localStorage.removeItem(DISMISS_KEY);
    if (dismissTimerRef.current) {
      window.clearInterval(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setDismissCountdown(null);
    // Restore previous status so the banner re-renders.
    setStatus(preDismissStatusRef.current === 'hidden' || preDismissStatusRef.current === 'loading'
      ? 'no_test'
      : preDismissStatusRef.current);
  };

  // While countdown is active, render the ephemeral confirmation card in place
  // of the full banner — keeps the layout stable so other Overview content
  // doesn't jump.
  if (dismissCountdown !== null) {
    return (
      <Card className="border-muted bg-muted/30 mb-6">
        <CardContent className="py-3 flex items-center gap-3">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-medium">Banner hidden from {surfaceLabel}.</span>{' '}
            <span className="text-muted-foreground">
              The Welcome Test stays available in the Tests tab. ({dismissCountdown}s)
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleUndoDismiss} className="h-8">
            <Undo2 className="h-3.5 w-3.5 mr-1.5" />
            Undo
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-spotlight="send-welcome-test" className="border-primary/30 bg-primary/5 mb-6 relative">
      <CardContent className="py-4">
        {/* Always-on dismiss button — hides the banner from Overview only.
            The Welcome Test remains accessible in the Tests tab. */}
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground z-10"
                aria-label={`Hide from ${surfaceLabel}`}
              >
                <X className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              Hide this banner from the {surfaceLabel} tab. The Welcome Test stays available in the Tests tab.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {status === 'no_test' ? (
          // v6.8.2 — 2-row layout: title + buttons in row 1, full-width
          // description in row 2. Lets description span the full card width
          // so it stays on a single line on desktop.
          <div className="flex flex-col gap-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Sparkles className="h-7 w-7 text-primary flex-shrink-0" />
                <p className="font-medium">Send a Welcome (placement) Test to {studentName}</p>
              </div>
              <div className="md:flex-shrink-0">
                <WelcomeTestActionsPanel
                  state={panelState}
                  shareUrl={shareUrl}
                  hasAnyAnswer={answeredCount > 0}
                  onSend={handleSend}
                  onCopy={handleCopy}
                  onRefreshLink={handleRefreshLink}
                  onPreview={handlePreview}
                  onViewResults={handleViewResults}
                  onRetake={handleRetake}
                  sending={creating}
                  retaking={retaking}
                  compact
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground md:pl-10">
              Understand their learning style, motivation, and actual English level with our comprehensive profiling test.
            </p>
          </div>
        ) : (
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            {status === 'pending' && (
              <>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Welcome (placement) Test sent</p>
                  <Badge variant="secondary">Waiting for student</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">{shareUrl}</p>
              </>
            )}
            {status === 'in_progress' && (
              <>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Student is taking the test</p>
                  <Badge variant="secondary">{answeredCount}/{totalQuestions} answered</Badge>
                </div>
                <Progress value={progressPercent} className="h-2 mt-2" />
              </>
            )}
            {status === 'completed' && (
              <>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Welcome (placement) Test completed!</p>
                  <Badge variant="default">Completed</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  View the learning profile and test results.
                </p>
              </>
            )}
          </div>
          <div className="flex-shrink-0">
            <WelcomeTestActionsPanel
              state={panelState}
              shareUrl={shareUrl}
              hasAnyAnswer={answeredCount > 0}
              onSend={handleSend}
              onCopy={handleCopy}
              onRefreshLink={handleRefreshLink}
              onPreview={handlePreview}
              onViewResults={handleViewResults}
              onRetake={handleRetake}
              sending={creating}
              retaking={retaking}
              compact
            />
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
