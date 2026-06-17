import React, { useState, useEffect } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { useWorksheetState } from "@/hooks/useWorksheetState";
import { useWorksheetGeneration } from "@/hooks/useWorksheetGeneration";
import { useTokenSystem } from "@/hooks/useTokenSystem";
import FormView from "@/components/worksheet/FormView";
import GenerationView from "@/components/worksheet/GenerationView";
import { TokenPaywallModal } from "@/components/TokenPaywallModal";
import { PricingSection } from "@/components/PricingSection";
import { DEFAULT_ONE_MINUTE_PREP_CALCULATOR_INPUT, type OneMinutePrepCalculatorInput } from "@/components/PricingCalculator";
import { FreeWeekBanner } from "@/components/FreeWeekBanner";
import { deepFixTextObjects } from "@/utils/textObjectFixer";
import StickyNav from "@/components/landing/StickyNav";
import HeroHeadline from "@/components/landing/HeroHeadline";
import {
  HomeCompoundingContext,
  HomeCredibilityBridge,
  HomeFeatureProofGrid,
  HomeFinalCTA,
  HomeTutorRealityScenario,
  HomeWeeklyWorkflowProof,
} from "@/components/landing/HomePostGeneratorNarrative";
import { AuthenticatedPageShell } from "@/components/AuthenticatedPageShell";
import AnonPostWorksheetLandingPage from "@/components/anon/AnonPostWorksheetLandingPage";
import WelcomeBackBanner from "@/components/anon/WelcomeBackBanner";
import AnonPreWorksheetBanner from "@/components/anon/AnonPreWorksheetBanner";
import ParticlesBackground from "@/components/landing/ParticlesBackground";
import StartOneMinutePrepDialog from "@/components/landing/StartOneMinutePrepDialog";
import { markWorksheetForClaim } from "@/hooks/useWorksheetClaim";
import { devLog, devWarn } from '@/utils/logger';
import { AddStudentDialog } from "@/components/dashboard/AddStudentDialog";
import { buildAutoGeneratePayload, clearAutoGenerateFlags, readAutoGenerateIntent } from "@/lib/worksheet/autoGenerateBootstrap";
import { hasAutoGenerateIntent } from "@/lib/worksheet/autoGenerateBootstrap";

/**
 * Main Index page component that handles worksheet generation and display
 */
const Index = () => {
  const { user, loading: authLoading, isRegisteredUser, isAnonymous } = useAuthFlow();
  const worksheetState = useWorksheetState(authLoading);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // v6.9.49 — when DSLM "Generate worksheet ↗" navigated us here, StudentPage
  // writes `sessionStorage.forceNewWorksheet='true'`. useWorksheetState consumes
  // that flag on its own restore-effect; we additionally call resetWorksheetState
  // to be defensive in case a previous worksheet was already hydrated in this
  // component's state. Idempotent.
  const autoBootstrapFiredRef = React.useRef(false);
  // v6.9.50 — track the last requestId we already auto-fired so a second click on
  // a different "Generate worksheet ↗" suggestion (without page reload) re-triggers.
  const lastBootstrappedRequestIdRef = React.useRef<string | null>(null);

  // v6.9.6 — force light theme on public landing (mobile dark mode was inheriting
  // prefers-color-scheme:dark and rendering the marketing page with poor contrast).
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    html.classList.remove('dark');
    return () => { if (wasDark) html.classList.add('dark'); };
  }, []);

  // Legacy deep-link support: older feature-pill links could return with
  // { scrollTo: 'feature-xxx' }. Keep the handler so saved links do not break.
  useEffect(() => {
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (!target) return;
    // Wait one frame so the homepage feature proof anchors have mounted.
    const id = window.setTimeout(() => {
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      navigate(location.pathname + location.search, { replace: true, state: null });
    }, 100);
    return () => window.clearTimeout(id);
  }, [location.state, location.pathname, location.search, navigate]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [preSelectedStudent, setPreSelectedStudent] = useState<{id: string, name: string} | null>(null);
  const { tokenLeft, hasTokens, canGenerateWorksheet, isDemo, profile, loading: tokensLoading, consumeToken } = useTokenSystem(user?.id || null);
  const { 
    isGenerating, 
    generateWorksheetHandler, 
  } = useWorksheetGeneration(user?.id || null, worksheetState, selectedStudentId, {
    hasTokens,
    canGenerateWorksheet,
    isDemo,
    consumeToken,
  });
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showWelcomeBackModal, setShowWelcomeBackModal] = useState(false);
  const [showOneMinutePrepDialog, setShowOneMinutePrepDialog] = useState(false);
  // v6.9.33 — open Add Student modal on `?action=add-student` (sent by Signup
  // page right after first-time login, and by other deep links).
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  useEffect(() => {
    // v6.9.35 — open AddStudentDialog from `?action=add-student` OR persisted
    // localStorage flag (`post-signup-add-student=1`). Flag is more robust
    // than the query param which Supabase email confirmation can strip.
    const hasFlag =
      searchParams.get('action') === 'add-student' ||
      (() => { try { return localStorage.getItem('post-signup-add-student') === '1'; } catch { return false; } })();
    if (!hasFlag) return;
    if (!isRegisteredUser) return; // wait until session hydrates
    setAddStudentOpen(true);
    try { localStorage.removeItem('post-signup-add-student'); } catch {}
    if (searchParams.get('action') === 'add-student') {
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, isRegisteredUser, setSearchParams]);
  const [oneMinutePrepCalculator, setOneMinutePrepCalculator] = useState<OneMinutePrepCalculatorInput>(
    DEFAULT_ONE_MINUTE_PREP_CALCULATOR_INPUT
  );

  // Welcome Back Modal - show for returning anonymous users who have visited before
  useEffect(() => {
    if (authLoading || isRegisteredUser || user) return;
    
    const lastVisit = localStorage.getItem('worksheetAppLastVisit');
    const hasGeneratedBefore = localStorage.getItem('worksheetAppHasGenerated');
    
    if (lastVisit && hasGeneratedBefore === 'true') {
      const hoursSinceLastVisit = (Date.now() - parseInt(lastVisit)) / (1000 * 60 * 60);
      if (hoursSinceLastVisit > 1) {
        setShowWelcomeBackModal(true);
      }
    }
    
    localStorage.setItem('worksheetAppLastVisit', Date.now().toString());
  }, [authLoading, isRegisteredUser, user]);

  // v6.9.53 — accept any `forceNew` value (Profile sends `true`, WorksheetHeader
  // historically sent a timestamp). Previously only `=== 'true'` matched, so the
  // anonymous "Generate New Worksheet" button silently no-oped.
  useEffect(() => {
    if (searchParams.has('forceNew')) {
      sessionStorage.setItem('forceNewWorksheet', 'true');
      const next = new URLSearchParams(searchParams);
      next.delete('forceNew');
      setSearchParams(next, { replace: true });
      worksheetState.forceNewWorksheet();
    }
  }, [searchParams, setSearchParams, worksheetState]);

  // Function to scroll to pricing section
  const scrollToPricing = () => {
    const pricingSection = document.getElementById('pricing-section');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToWorksheetForm = () => {
    const formSection = document.getElementById('worksheet-form');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Check for pre-selected student from student page
  useEffect(() => {
    const preSelected = sessionStorage.getItem('preSelectedStudent');
    if (preSelected) {
      try {
        const studentData = JSON.parse(preSelected);
        setPreSelectedStudent(studentData);
        setSelectedStudentId(studentData.id);
        sessionStorage.removeItem('preSelectedStudent');
      } catch (error) {
        console.error('Error parsing pre-selected student:', error);
      }
    }
  }, []);

  // Check for restored worksheet from dashboard
  useEffect(() => {
    const restoredWorksheet = sessionStorage.getItem('restoredWorksheet');
    const studentName = sessionStorage.getItem('worksheetStudentName');
    
    if (restoredWorksheet) {
      try {
        const worksheet = JSON.parse(restoredWorksheet);
        devLog('🔄 Restoring worksheet from dashboard:', worksheet);
        
        let parsedWorksheet = null;
        if (worksheet.ai_response) {
          try {
            parsedWorksheet = JSON.parse(worksheet.ai_response);
            devLog('✅ Successfully parsed ai_response:', parsedWorksheet);
            
            parsedWorksheet = deepFixTextObjects(parsedWorksheet, 'restoredWorksheet');
            devLog('✅ Successfully fixed {text} objects in restored worksheet');
            
          } catch (parseError) {
            console.error('❌ Failed to parse ai_response:', parseError);
          }
        }
        
        if (parsedWorksheet) {
          parsedWorksheet.id = worksheet.id;
          parsedWorksheet.audio_url = worksheet.audio_url;
          parsedWorksheet.audio_transcript = worksheet.audio_transcript;
          parsedWorksheet.audio_duration = worksheet.audio_duration;
          parsedWorksheet.audio_voice = worksheet.audio_voice;
          parsedWorksheet.selected_audio = worksheet.selected_audio;
          parsedWorksheet.selected_image = worksheet.selected_image;
          
          worksheetState.setGeneratedWorksheet(parsedWorksheet);
          worksheetState.setEditableWorksheet(parsedWorksheet);
          
          if (worksheet.form_data) {
            const inputParamsWithStudent = {
              ...worksheet.form_data,
              studentId: worksheet.student_id,
              studentName: studentName || worksheet.studentName,
              selectedImage: worksheet.selected_image,
              selectedAudio: worksheet.selected_audio
            };
            worksheetState.setInputParams(inputParamsWithStudent);
          }
          
          worksheetState.setWorksheetId(worksheet.id);
          worksheetState.setGenerationTime(worksheet.generation_time_seconds || 5);
          worksheetState.setSourceCount(75);
        }
        
        sessionStorage.removeItem('restoredWorksheet');
        sessionStorage.removeItem('worksheetStudentName');
      } catch (error) {
        console.error('💥 Error restoring worksheet:', error);
        sessionStorage.removeItem('restoredWorksheet');
        sessionStorage.removeItem('worksheetStudentName');
      }
    }
  }, []);

  const bothWorksheetsReady = worksheetState.generatedWorksheet && worksheetState.editableWorksheet;

  useEffect(() => {
    if (bothWorksheetsReady && !isRegisteredUser) {
      localStorage.setItem('worksheetAppHasGenerated', 'true');
      // Track this anonymous worksheet for post-signup ownership transfer.
      const wid = worksheetState.worksheetId;
      if (wid) markWorksheetForClaim(wid);
    }
  }, [bothWorksheetsReady, isRegisteredUser, worksheetState.worksheetId]);

  // v6.9.48 — Deterministic auto-generate bootstrap. When DSLM "Generate
  // worksheet ↗" navigates to '/' with sessionStorage flags, Index waits for
  // tokens to resolve and fires handleGenerateWorksheet itself. This avoids
  // the WorksheetForm mount race that previously dropped the intent.
  useEffect(() => {
    if (!isRegisteredUser) return;
    if (authLoading) return;
    if (!hasAutoGenerateIntent()) return;
    const intent = readAutoGenerateIntent();
    if (!intent) return;
    // v6.9.50 — allow re-firing on a NEW requestId (different suggestion clicked
    // without page reload). Skip only when this exact requestId already fired.
    if (autoBootstrapFiredRef.current && lastBootstrappedRequestIdRef.current === intent.requestId) return;
    autoBootstrapFiredRef.current = false;
    // v6.9.49 — if a previous worksheet is on-screen, hard-reset state so the
    // GenerationView unmounts and FormView shows the GeneratingModal again.
    if (bothWorksheetsReady) {
      try { worksheetState.resetWorksheetState(); } catch { /* ignore */ }
    }

    let fired = false;
    let attempts = 0;
    const interval = window.setInterval(() => {
      if (fired) { window.clearInterval(interval); return; }
      attempts += 1;
      if (attempts > 60) { // ~12s max wait for tokensLoading to resolve
        devWarn('[Index v6.9.48] auto-bootstrap timed out waiting for tokens');
        window.clearInterval(interval);
        return;
      }
      if (tokensLoading) return;
      const payload = buildAutoGeneratePayload();
      if (!payload) {
        devWarn('[Index v6.9.48] auto-bootstrap: no payload (missing topic?)');
        clearAutoGenerateFlags();
        window.clearInterval(interval);
        return;
      }
      fired = true;
      autoBootstrapFiredRef.current = true;
      lastBootstrappedRequestIdRef.current = payload.__autoGenerateRequestId;
      devLog('[Index v6.9.50] auto-bootstrap fired', { requestId: payload.__autoGenerateRequestId, studentId: payload.studentId });
      // Notify any mounted WorksheetForm so its RAF gate stands down and clears flags.
      window.dispatchEvent(new CustomEvent('worksheet:autoGenerateStarted', { detail: { requestId: payload.__autoGenerateRequestId } }));
      clearAutoGenerateFlags();
      window.clearInterval(interval);
      handleGenerateWorksheet(payload);
    }, 200);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegisteredUser, authLoading, tokensLoading, bothWorksheetsReady]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const handleGenerateWorksheet = (data: any) => {
    // v6.9.48 — acknowledge auto-generate intent so the form clears its
    // sessionStorage flags exactly once, whichever path fired (Index bootstrap
    // or WorksheetForm RAF gate).
    if (data?.__autoGenerateRequestId) {
      try {
        window.dispatchEvent(new CustomEvent('worksheet:autoGenerateStarted', { detail: { requestId: data.__autoGenerateRequestId } }));
      } catch { /* ignore */ }
    }
    devLog('🔍 POPUP DECISION DEBUG:', {
      userId: user?.id,
      isAnonymous,
      isRegisteredUser,
      isDemo,
      hasTokens,
      canGenerateWorksheet,
      tokenLeft,
      userEmail: user?.email || '',
      userIsAnonymous: user?.is_anonymous,
      tokensLoading,
    });

    // v4.7: lesson topic guard — if a caller (e.g. DSLM auto-submit race)
    // dispatches generation with empty topic, abort with explicit feedback
    // instead of starting an empty AI generation.
    if (!data?.lessonTopic || String(data.lessonTopic).trim().length === 0) {
      devWarn('[Index] handleGenerateWorksheet aborted: empty lessonTopic');
      toast.error('Please enter a lesson topic before generating');
      const topicEl =
        document.querySelector('[name="lessonTopic"]') ||
        document.getElementById('lessonTopic') ||
        document.getElementById('worksheet-form');
      if (topicEl && 'scrollIntoView' in topicEl) {
        (topicEl as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        if ((topicEl as HTMLElement).focus) (topicEl as HTMLElement).focus();
      }
      return;
    }

    // v4.7 / v6.9.45: never show paywall while the token/profile fetch is in-flight.
    // useTokenSystem keeps `loading` true until auth status AND profile are resolved.
    // Manual submit: retry up to 2× (250ms + 500ms) so the user can re-click.
    // Auto-submit from a 1-Minute Prep suggestion: queue silently up to ~12s, because
    // there is no user to re-click and previous "2-retry-then-drop" caused the
    // navigated-to-generator-but-nothing-happens regression.
    const retryCount = (data as any).__tokenRetry || 0;
    const isAutoGenerateFromSuggestion = (data as any).__autoGenerateFromSuggestion === true;
    if (isRegisteredUser && tokensLoading) {
      const maxRetries = isAutoGenerateFromSuggestion ? 40 : 2;
      if (retryCount >= maxRetries) {
        devWarn(`⏳ Token check still in progress after ${maxRetries} retries — aborting (auto=${isAutoGenerateFromSuggestion})`);
        return;
      }
      const delay = isAutoGenerateFromSuggestion ? 300 : (retryCount === 0 ? 250 : 500);
      devLog(`⏳ Token entitlement still resolving — retry ${retryCount + 1}/${maxRetries} in ${delay}ms (auto=${isAutoGenerateFromSuggestion})`);
      setTimeout(() => handleGenerateWorksheet({ ...data, __tokenRetry: retryCount + 1 }), delay);
      return;
    }

    // Use canGenerateWorksheet which mirrors backend `consume_token` rules
    // (available_tokens > 0 OR monthly_worksheet_limit not yet exhausted).
    const shouldShowPopup = isRegisteredUser && !canGenerateWorksheet;

    if (shouldShowPopup) {
      setShowTokenModal(true);
      return;
    }
    
    generateWorksheetHandler(data);
  };

  if (isRegisteredUser) {
    return (
      <AuthenticatedPageShell>
        <FreeWeekBanner />
        
        {!bothWorksheetsReady && (
          <StickyNav
            isRegisteredUser={true}
            tokenLeft={tokenLeft}
            user={user}
            scrollToPricing={scrollToPricing}
          />
        )}
        
        {!bothWorksheetsReady ? (
          <div className="max-w-6xl mx-auto px-4 pt-4 pb-16">
            <FormView 
              onSubmit={handleGenerateWorksheet} 
              userId={user?.id || null} 
              onStudentChange={setSelectedStudentId}
              preSelectedStudent={preSelectedStudent}
              isRegisteredUser={true}
              variant="dashboard"
            />
          </div>
        ) : (
          <GenerationView 
            worksheetId={worksheetState.worksheetId}
            generatedWorksheet={worksheetState.generatedWorksheet}
            editableWorksheet={worksheetState.editableWorksheet}
            setEditableWorksheet={worksheetState.setEditableWorksheet}
            inputParams={worksheetState.inputParams}
            generationTime={worksheetState.generationTime}
            sourceCount={worksheetState.sourceCount}
            onBack={worksheetState.resetWorksheetState}
            userId={user?.id || null}
          />
        )}
        
        <TokenPaywallModal
          isOpen={showTokenModal}
          onClose={() => setShowTokenModal(false)}
          availableTokens={tokenLeft}
          profile={profile}
          onUpgrade={() => {
            setShowTokenModal(false);
          }}
        />

        {/* v6.9.36 — post-signup AddStudent modal also mounted in the
            authenticated branch (previously only public branch). Without
            this, email/Google signups landing on `/` as registered users
            never saw the dialog because Index returned the auth shell early. */}
        <AddStudentDialog
          triggerButton={false}
          open={addStudentOpen}
          onOpenChange={setAddStudentOpen}
        />

      </AuthenticatedPageShell>
    );
  }

  return (
    <div className="min-h-screen relative">
      <ParticlesBackground />
      <FreeWeekBanner />
      <WelcomeBackBanner shouldShow={showWelcomeBackModal} />
      
      {!bothWorksheetsReady && (
        <StickyNav
          isRegisteredUser={!!isRegisteredUser}
          tokenLeft={tokenLeft}
          user={user}
          scrollToPricing={scrollToPricing}
        />
      )}
      
      {!bothWorksheetsReady ? (
        <>
          <HeroHeadline
            calculatorValue={oneMinutePrepCalculator}
            onCalculatorChange={setOneMinutePrepCalculator}
            onStartOneMinutePrep={() => setShowOneMinutePrepDialog(true)}
            onTryWorksheetGenerator={scrollToWorksheetForm}
          />
          <div id="worksheet-form" className="scroll-mt-16 pb-16">
            <FormView 
              onSubmit={handleGenerateWorksheet} 
              userId={user?.id || null} 
              onStudentChange={setSelectedStudentId}
              preSelectedStudent={preSelectedStudent}
              isRegisteredUser={false}
              variant="landing"
            />
          </div>
          <HomeCredibilityBridge />
          <HomeWeeklyWorkflowProof />
          <HomeCompoundingContext />
          <HomeFeatureProofGrid />
          <HomeTutorRealityScenario />
          <div id="pricing-section">
            <PricingSection
              calculatorValue={oneMinutePrepCalculator}
              onCalculatorChange={setOneMinutePrepCalculator}
            />
          </div>
          <HomeFinalCTA onStartOneMinutePrep={() => setShowOneMinutePrepDialog(true)} />
        </>
      ) : (
        <>
          {!isRegisteredUser && (
            <>
              <StickyNav
                isRegisteredUser={false}
                tokenLeft={0}
                user={null}
                nonSticky
                scrollToPricing={() => {
                  const el = document.getElementById('post-worksheet-pricing');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
              {/* v6.9.53 — anon top banner mirrors /worksheet/:id render path so
                  it appears immediately after in-memory generation, not only
                  after refresh. */}
              <AnonPreWorksheetBanner />
            </>
          )}
          <GenerationView 
            worksheetId={worksheetState.worksheetId}
            generatedWorksheet={worksheetState.generatedWorksheet}
            editableWorksheet={worksheetState.editableWorksheet}
            setEditableWorksheet={worksheetState.setEditableWorksheet}
            inputParams={worksheetState.inputParams}
            generationTime={worksheetState.generationTime}
            sourceCount={worksheetState.sourceCount}
            onBack={worksheetState.resetWorksheetState}
            userId={isRegisteredUser ? user?.id || null : null}
          />
          {!isRegisteredUser && <AnonPostWorksheetLandingPage />}
        </>
      )}
      
      <TokenPaywallModal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
        availableTokens={tokenLeft}
        profile={profile}
        onUpgrade={() => {
          setShowTokenModal(false);
        }}
      />

      <StartOneMinutePrepDialog
        open={showOneMinutePrepDialog}
        onOpenChange={setShowOneMinutePrepDialog}
        onTryWorksheetGenerator={scrollToWorksheetForm}
      />

      {/* v6.9.33 — first-time Add Student dialog after signup. */}
      <AddStudentDialog
        triggerButton={false}
        open={addStudentOpen}
        onOpenChange={setAddStudentOpen}
      />

    </div>
  );
};

export default Index;
