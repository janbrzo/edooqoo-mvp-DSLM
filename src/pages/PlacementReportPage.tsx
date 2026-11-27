import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Loader2, Send, Sparkles, TriangleAlert, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PlacementReportBody } from '@/components/welcome-test/PlacementReportBody';
import { TeacherPlacementDiagnosticView } from '@/components/welcome-test/TeacherPlacementDiagnosticView';
import { PlacementNextStepsSection } from '@/components/welcome-test/PlacementNextStepsSection';
import { PlacementLearningPathSection } from '@/components/welcome-test/PlacementLearningPathSection';
import { prefillPlacementLesson, rememberPlacementLesson, pendingPlacementLessonId, clearPendingPlacementLesson } from '@/lib/welcomeTest/placementLessonPrefill';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useDemoContext } from '@/contexts/DemoContext';
import { studentTabPath } from '@/lib/students/workspaceTabs';
import { PUBLIC_PLACEMENT_TEST_PATH } from '@/lib/welcomeTest/publicPlacementTest';
import {
  claimPlacementReport,
  clearPostSignupAddStudentIntent,
  forwardPlacementReport,
  getPlacementReport,
  generatePlacementNextSteps,
  generatePlacementLearningPath,
  PLACEMENT_REPORT_TOKEN_PATTERN,
  rememberPendingClaim,
  takePendingClaim,
  type PlacementReport,
  type PlacementLessonProposal,
} from '@/lib/welcomeTest/placementReportApi';

type LoadState = { status: 'loading' } | { status: 'error'; expired: boolean } | { status: 'ready'; report: PlacementReport };

export default function PlacementReportPage() {
  const { token = '' } = useParams();
  const [searchParams] = useSearchParams();
  const wantsClaim = searchParams.get('claim') === '1';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { loading: authLoading, isRegisteredUser } = useAuthFlow();
  const { isDemoMode } = useDemoContext();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [claiming, setClaiming] = useState(false);
  const [generatingLessons, setGeneratingLessons] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [generatingPath, setGeneratingPath] = useState(false);
  const [pathError, setPathError] = useState<string | null>(null);
  const activeToken = useRef(token);
  activeToken.current = token;
  const lessonRequestRunning = useRef(false);
  const pathRequestRunning = useRef(false);
  const wantsForward = searchParams.get('forward') === '1';
  const [forwardEmail, setForwardEmail] = useState('');
  const [forwarding, setForwarding] = useState(false);
  const [forwarded, setForwarded] = useState(false);
  const forward = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(forwardEmail.trim())) { toast.error("Enter your teacher's email."); return; }
    setForwarding(true);
    try { await forwardPlacementReport(token, forwardEmail.trim()); setForwarded(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not send the results.'); }
    finally { setForwarding(false); }
  };
  const autoClaimed = useRef(false);

  useEffect(() => {
    setState({ status: 'loading' });
    setLessonError(null);
    setGeneratingLessons(false);
    setPathError(null);
    setGeneratingPath(false);
    autoClaimed.current = false;
    if (!PLACEMENT_REPORT_TOKEN_PATTERN.test(token)) { setState({ status: 'error', expired: false }); return; }
    let cancelled = false;
    getPlacementReport(token)
      .then((report) => { if (!cancelled) setState({ status: 'ready', report }); })
      .catch((error) => { if (!cancelled) setState({ status: 'error', expired: error?.status === 410 }); });
    return () => { cancelled = true; };
  }, [token]);

  const pendingAnalysis = state.status === 'ready'
    && state.report.role === 'teacher'
    && Boolean(state.report.teacherDiagnostic)
    && state.report.teacherDiagnostic?.test?.status === 'completed'
    && !state.report.teacherDiagnostic?.learningProfile;
  const pendingLessons = state.status === 'ready' && state.report.role === 'teacher' && state.report.nextSteps?.status === 'running';
  const pendingPath = state.status === 'ready' && state.report.role === 'teacher' && state.report.learningPath?.status === 'running';

  useEffect(() => {
    if (!pendingAnalysis && !pendingLessons && !pendingPath) return;
    let cancelled = false;
    let ticks = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = () => {
      ticks += 1;
      getPlacementReport(token)
        .then((report) => {
          if (cancelled) return;
          setState({ status: 'ready', report });
          const stillPending = report.teacherDiagnostic?.test?.status === 'completed' && !report.teacherDiagnostic?.learningProfile;
          if ((stillPending || report.nextSteps?.status === 'running' || report.learningPath?.status === 'running') && ticks < 60) timer = setTimeout(poll, 3000);
        })
        .catch(() => {
          if (!cancelled && ticks < 60) timer = setTimeout(poll, 3000);
        });
    };
    timer = setTimeout(poll, 3000);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [pendingAnalysis, pendingLessons, pendingPath, token]);

  const generateLessons = async () => {
    if (isDemoMode) { toast.error('Not available in demo mode.'); return; }
    if (lessonRequestRunning.current || state.status !== 'ready' || state.report.role !== 'teacher') return;
    lessonRequestRunning.current = true;
    const requestToken = token;
    setGeneratingLessons(true);
    setLessonError(null);
    try {
      const nextSteps = await generatePlacementNextSteps(requestToken);
      if (activeToken.current !== requestToken) return;
      setState(previous => previous.status === 'ready' ? { ...previous, report: { ...previous.report, nextSteps } } : previous);
    } catch (error) {
      if (activeToken.current === requestToken) setLessonError(error instanceof Error ? error.message : 'Could not prepare lessons.');
    } finally {
      lessonRequestRunning.current = false;
      if (activeToken.current === requestToken) setGeneratingLessons(false);
    }
  };

  const generateLearningPath = async () => {
    if (isDemoMode) { toast.error('Not available in demo mode.'); return; }
    if (pathRequestRunning.current || state.status !== 'ready' || state.report.role !== 'teacher') return;
    pathRequestRunning.current = true;
    const requestToken = token;
    setGeneratingPath(true);
    setPathError(null);
    try {
      const learningPath = await generatePlacementLearningPath(requestToken);
      if (activeToken.current !== requestToken) return;
      setState(previous => previous.status === 'ready' ? { ...previous, report: { ...previous.report, learningPath } } : previous);
    } catch (error) {
      if (activeToken.current === requestToken) setPathError(error instanceof Error ? error.message : 'Could not build learning path.');
    } finally {
      pathRequestRunning.current = false;
      if (activeToken.current === requestToken) setGeneratingPath(false);
    }
  };

  const claim = useCallback(async () => {
    if (isDemoMode) { toast.error('Not available in demo mode.'); return; }
    if (state.status !== 'ready' || state.report.role !== 'teacher') return;
    setClaiming(true);
    try {
      const { studentId, testId, alreadyClaimed } = await claimPlacementReport(token);
      takePendingClaim();
      clearPostSignupAddStudentIntent();
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      if (!alreadyClaimed) toast.success('Student added with their placement profile.');
      const selectedId = pendingPlacementLessonId(token);
      const lesson = state.report.nextSteps?.status === 'ready' ? state.report.nextSteps.suggestions.find(s => s.id === selectedId) : null;
      if (lesson) {
        prefillPlacementLesson(lesson, { id: studentId, name: state.report.studentName });
        clearPendingPlacementLesson();
        navigate('/#worksheet-form');
      } else navigate(studentTabPath(studentId, 'timeline', { filter: 'tests', testId }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the student.');
    } finally {
      setClaiming(false);
    }
  }, [token, navigate, isDemoMode, state, queryClient]);

  useEffect(() => {
    if (!wantsClaim || authLoading || !isRegisteredUser || state.status !== 'ready' || state.report.role !== 'teacher' || autoClaimed.current) return;
    autoClaimed.current = true;
    void claim();
  }, [wantsClaim, authLoading, isRegisteredUser, state, claim]);

  const returnPath = `/placement-report/${token}?claim=1`;
  const goToSignup = () => { rememberPendingClaim(token); navigate('/signup', { state: { from: returnPath } }); };
  const goToLogin = () => { rememberPendingClaim(token); navigate('/login', { state: { from: returnPath } }); };

  const head = <Helmet><title>Placement report | Edooqoo</title><meta name="robots" content="noindex,nofollow" /></Helmet>;

  if (state.status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">{head}<Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4 flex items-center justify-center">
        {head}
        <Card className="w-full max-w-lg rounded-3xl">
          <CardContent className="py-8 text-center space-y-4">
            <TriangleAlert className="h-10 w-10 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">{state.expired ? 'This report has expired' : 'This report is not available'}</h1>
            <p className="text-sm leading-6 text-muted-foreground">Placement reports are available for 7 days after the test.</p>
            <Button asChild className="rounded-full"><Link to={PUBLIC_PLACEMENT_TEST_PATH}>Take the placement test<ArrowRight className="h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { report } = state;
  const isStudentView = report.role === 'student';
  const hasFullDiagnostic = !isStudentView && Boolean(report.teacherDiagnostic);
  const name = report.studentName;

  const claimBanner = !isStudentView ? (
    <Card className="rounded-3xl border-primary/40 bg-primary/5">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <UserPlus className="h-6 w-6 text-primary shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">{report.claimed ? `${name} has already been added to an Edooqoo account.` : `Teaching ${name}?`}</p>
            {!report.claimed && (
              <p className="text-sm leading-6 text-muted-foreground">
                Add {name} to your Edooqoo account with this full placement profile and generate a personalised first lesson in about a minute.
              </p>
            )}
          </div>
        </div>
        {!report.claimed && (
          isRegisteredUser ? (
            <Button className="rounded-full w-full sm:w-auto h-auto min-h-10 whitespace-normal" onClick={() => { void claim(); }} disabled={claiming}>
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Add {name} to my students
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="rounded-full h-auto min-h-10 whitespace-normal" onClick={goToSignup}>Create free account and add {name}<ArrowRight className="h-4 w-4" /></Button>
              <Button variant="ghost" className="rounded-full" onClick={goToLogin}>I already have an account</Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 px-3 py-6 sm:px-6">
      {head}
      <div className={`mx-auto space-y-5 ${hasFullDiagnostic ? 'max-w-4xl' : 'max-w-3xl'}`}>
        <div className="mx-auto max-w-3xl text-center space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{isStudentView ? 'Your placement results' : 'Teacher placement report'}</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{isStudentView ? `Well done, ${name}!` : `${name}'s placement report`}</h1>
          <p className="text-sm leading-6 text-muted-foreground max-w-xl mx-auto">
            {isStudentView
              ? 'Here is what your test shows about your English and how you learn.'
              : hasFullDiagnostic
                ? 'Full diagnostic analysis, AI learning profile, skill scores and question-by-question answers.'
                : 'Keyed skill scores, learning profile and where declared needs differ from scenario signals.'}
          </p>
        </div>

        {claimBanner}

        {hasFullDiagnostic && report.teacherDiagnostic ? (
          <TeacherPlacementDiagnosticView diagnostic={report.teacherDiagnostic} studentName={name} />
        ) : (
          <PlacementReportBody result={report.result} audience={isStudentView ? 'student' : 'teacher'} />
        )}

        {!isStudentView && (!report.claimed || report.nextSteps?.status === 'ready') && (
          <PlacementNextStepsSection
            state={report.nextSteps ?? { status: 'idle' }}
            generating={generatingLessons || claiming}
            available={Boolean(report.teacherDiagnostic?.learningProfile) && report.teacherDiagnostic?.test?.status === 'reviewed'}
            claimed={report.claimed} registered={Boolean(isRegisteredUser)} error={lessonError}
            onGenerate={() => { void generateLessons(); }}
            onPrepare={(lesson: PlacementLessonProposal) => {
              try { prefillPlacementLesson(lesson); navigate('/#worksheet-form'); }
              catch { toast.error('Could not open the worksheet form. Please allow browser storage.'); }
            }}
            onSave={(lesson: PlacementLessonProposal) => {
              if (isDemoMode) { toast.error('Not available in demo mode.'); return; }
              rememberPlacementLesson(token, lesson.id);
              if (isRegisteredUser) void claim();
              else goToSignup();
            }}
          />
        )}

        {!isStudentView && (!report.claimed || report.learningPath?.status === 'ready') && (
          <PlacementLearningPathSection
            state={report.learningPath ?? { status: 'idle' }}
            studentName={name}
            generating={generatingPath || claiming}
            available={Boolean(report.teacherDiagnostic?.learningProfile) && report.teacherDiagnostic?.test?.status === 'reviewed'}
            claimed={report.claimed}
            registered={Boolean(isRegisteredUser)}
            error={pathError}
            onGenerate={() => { void generateLearningPath(); }}
            onOpenAccount={() => {
              if (isDemoMode) { toast.error('Not available in demo mode.'); return; }
              if (report.claimed && report.teacherDiagnostic?.studentId) {
                navigate(studentTabPath(report.teacherDiagnostic.studentId, 'model'));
              } else if (isRegisteredUser) {
                void claim();
              } else {
                goToSignup();
              }
            }}
          />
        )}

        {isStudentView && !report.claimed && (
          <Card className="rounded-3xl border-primary/30" id="forward">
            <CardContent className="p-5 space-y-3">
              <p className="font-semibold">Send your results to your teacher</p>
              {forwarded ? (
                <p role="status" className="text-sm text-muted-foreground">Sent. Your teacher will receive the full report by email.</p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="forward-teacher-email">Teacher's email</Label>
                    <Input id="forward-teacher-email" type="email" autoFocus={wantsForward} value={forwardEmail} onChange={(e) => setForwardEmail(e.target.value)} placeholder="teacher@example.com" />
                  </div>
                  <Button className="rounded-full" onClick={() => { void forward(); }} disabled={forwarding}>
                    {forwarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send to my teacher
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isStudentView && !report.claimed && claimBanner}

        {isStudentView && (
          <Card className="rounded-3xl border-primary/30">
            <CardContent className="p-5 flex items-start gap-3">
              <Sparkles className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <p className="text-sm leading-6 text-muted-foreground">
                Your teacher received the full report. Tell them about Edooqoo: they can turn this profile into lessons and homework built around your goals, prepared in about a minute.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
