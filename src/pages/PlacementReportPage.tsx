import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Eye, Loader2, Send, Sparkles, Target, TriangleAlert, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildPlacementAccountPreview } from '@/lib/welcomeTest/placementAccountPreview';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PlacementReportBody } from '@/components/welcome-test/PlacementReportBody';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useDemoContext } from '@/contexts/DemoContext';
import { studentTabPath } from '@/lib/students/workspaceTabs';
import { PUBLIC_PLACEMENT_TEST_PATH } from '@/lib/welcomeTest/publicPlacementTest';
import {
  claimPlacementReport,
  forwardPlacementReport,
  getPlacementReport,
  PLACEMENT_REPORT_TOKEN_PATTERN,
  rememberPendingClaim,
  takePendingClaim,
  type PlacementReport,
} from '@/lib/welcomeTest/placementReportApi';

type LoadState = { status: 'loading' } | { status: 'error'; expired: boolean } | { status: 'ready'; report: PlacementReport };

export default function PlacementReportPage() {
  const { token = '' } = useParams();
  const [searchParams] = useSearchParams();
  const wantsClaim = searchParams.get('claim') === '1';
  const navigate = useNavigate();
  const { loading: authLoading, isRegisteredUser } = useAuthFlow();
  const { isDemoMode } = useDemoContext();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [claiming, setClaiming] = useState(false);
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
    if (!PLACEMENT_REPORT_TOKEN_PATTERN.test(token)) { setState({ status: 'error', expired: false }); return; }
    let cancelled = false;
    getPlacementReport(token)
      .then((report) => { if (!cancelled) setState({ status: 'ready', report }); })
      .catch((error) => { if (!cancelled) setState({ status: 'error', expired: error?.status === 410 }); });
    return () => { cancelled = true; };
  }, [token]);

  const claim = useCallback(async () => {
    if (isDemoMode) { toast.error('Not available in demo mode.'); return; }
    setClaiming(true);
    try {
      const { studentId } = await claimPlacementReport(token);
      takePendingClaim();
      toast.success('Student added with their placement profile.');
      navigate(studentTabPath(studentId, 'model', { view: 'profile' }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the student.');
    } finally {
      setClaiming(false);
    }
  }, [token, navigate, isDemoMode]);

  useEffect(() => {
    if (!wantsClaim || authLoading || !isRegisteredUser || state.status !== 'ready' || autoClaimed.current) return;
    autoClaimed.current = true;
    void claim();
  }, [wantsClaim, authLoading, isRegisteredUser, state.status, claim]);

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
  const name = report.studentName;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 px-3 py-6 sm:px-6">
      {head}
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="text-center space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{isStudentView ? 'Your placement results' : 'Teacher placement report'}</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{isStudentView ? `Well done, ${name}!` : `${name}'s placement report`}</h1>
          <p className="text-sm leading-6 text-muted-foreground max-w-xl mx-auto">
            {isStudentView
              ? 'Here is what your test shows about your English and how you learn.'
              : 'Keyed skill scores, learning profile and where declared needs differ from scenario signals. Writing and speaking stayed on the student\'s device.'}
          </p>
        </div>

        {!isStudentView && (
          <Card className="rounded-3xl border-primary/40 bg-primary/5">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <UserPlus className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{report.claimed ? `${name} has already been added to an Edooqoo account.` : `Teaching ${name}?`}</p>
                  {!report.claimed && (
                    <p className="text-sm leading-6 text-muted-foreground">
                      Create a free Edooqoo account and {name} is added to your students with this profile, ready for a personalised first lesson prepared in about a minute.
                    </p>
                  )}
                </div>
              </div>
              {!report.claimed && (
                isRegisteredUser ? (
                  <Button className="rounded-full w-full sm:w-auto" onClick={() => { void claim(); }} disabled={claiming}>
                    {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}Add {name} to my students
                  </Button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button className="rounded-full" onClick={goToSignup}>Create free account and add {name}<ArrowRight className="h-4 w-4" /></Button>
                    <Button variant="ghost" className="rounded-full" onClick={goToLogin}>I already have an account</Button>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        )}

        <PlacementReportBody result={report.result} audience={isStudentView ? 'student' : 'teacher'} />

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

        {!isStudentView && !report.claimed && (() => {
          const preview = buildPlacementAccountPreview(report.result);
          return (
            <Card className="rounded-3xl border-dashed border-primary/50 bg-primary/5">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Preview: inside your Edooqoo teacher account</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  This is what Edooqoo sets up from {name}'s results when you add {name}. It is not part of the test result above.
                </p>
                {preview.goals.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Starter goals for {name}</p>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {preview.goals.map((goal) => <li key={goal} className="rounded-2xl bg-background/70 border border-border p-3 text-sm">{goal}</li>)}
                    </ul>
                  </div>
                )}
                {preview.firstLesson && (
                  <div className="rounded-2xl bg-background/70 border border-border p-3 text-sm leading-6">
                    <span className="font-medium">Suggested first lesson{preview.level ? ` (${preview.level})` : ''}: </span>{preview.firstLesson}, generated in about a minute.
                  </div>
                )}
                <p className="text-xs leading-5 text-muted-foreground">Also in your account: {name}'s profile on the student page, lesson pacing suggestions, homework and flashcards that update the learning model.</p>
                {!isRegisteredUser && (
                  <Button className="rounded-full" onClick={goToSignup}>Create free account and add {name}<ArrowRight className="h-4 w-4" /></Button>
                )}
              </CardContent>
            </Card>
          );
        })()}

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
