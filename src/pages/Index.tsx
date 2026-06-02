import React, { useState, useEffect } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { useWorksheetState } from "@/hooks/useWorksheetState";
import { useWorksheetGeneration } from "@/hooks/useWorksheetGeneration";
import { useTokenSystem } from "@/hooks/useTokenSystem";
import GeneratingModal from "@/components/GeneratingModal";
import FormView from "@/components/worksheet/FormView";
import GenerationView from "@/components/worksheet/GenerationView";
import { TokenPaywallModal } from "@/components/TokenPaywallModal";
import { PricingSection } from "@/components/PricingSection";
import { DEFAULT_ONE_MINUTE_PREP_CALCULATOR_INPUT, type OneMinutePrepCalculatorInput } from "@/components/PricingCalculator";
import { FreeWeekBanner } from "@/components/FreeWeekBanner";
import { deepFixTextObjects } from "@/utils/textObjectFixer";
import StickyNav from "@/components/landing/StickyNav";
import HeroHeadline from "@/components/landing/HeroHeadline";
import StatsBar from "@/components/landing/StatsBar";
import ValueCards from "@/components/landing/ValueCards";
import EcosystemSection from "@/components/landing/EcosystemSection";
import TestimonialsRow from "@/components/landing/TestimonialsRow";
import FinalCTA from "@/components/landing/FinalCTA";
import { AuthenticatedPageShell } from "@/components/AuthenticatedPageShell";
import PricingTeaser from "@/components/landing/PricingTeaser";
import AnonPostWorksheetLandingPage from "@/components/anon/AnonPostWorksheetLandingPage";
import WelcomeBackBanner from "@/components/anon/WelcomeBackBanner";
import ParticlesBackground from "@/components/landing/ParticlesBackground";
import StartOneMinutePrepDialog from "@/components/landing/StartOneMinutePrepDialog";
import { markWorksheetForClaim } from "@/hooks/useWorksheetClaim";
import { devLog, devWarn } from '@/utils/logger';
import { AddStudentDialog } from "@/components/dashboard/AddStudentDialog";

/**
 * Main Index page component that handles worksheet generation and display
 */
const Index = () => {
  const { user, loading: authLoading, isRegisteredUser, isAnonymous } = useAuthFlow();
  const worksheetState = useWorksheetState(authLoading);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // v6.9.6 — force light theme on public landing (mobile dark mode was inheriting
  // prefers-color-scheme:dark and rendering the marketing page with poor contrast).
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    html.classList.remove('dark');
    return () => { if (wasDark) html.classList.add('dark'); };
  }, []);

  // v6.9.1 — deep-link scroll from feature pills (anon nav). When the user
  // clicks a pill on the landing or returns from /signup, location.state may
  // contain { scrollTo: 'feature-xxx' }. We scroll once and clear the state
  // so refreshes don't re-trigger.
  useEffect(() => {
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (!target) return;
    // Wait one frame so EcosystemSection has mounted
    const id = window.setTimeout(() => {
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      navigate(location.pathname + location.search, { replace: true, state: null });
    }, 100);
    return () => window.clearTimeout(id);
  }, [location.state, location.pathname, location.search, navigate]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [preSelectedStudent, setPreSelectedStudent] = useState<{id: string, name: string} | null>(null);
  const { 
    isGenerating, 
    generateWorksheetHandler, 
    streamProgress,
    mediaGenerating,
    cancelGeneration,
    generationError,
    clearGenerationError,
  } = useWorksheetGeneration(user?.id || null, worksheetState, selectedStudentId);
  const { tokenLeft, hasTokens, canGenerateWorksheet, isDemo, profile, loading: tokensLoading } = useTokenSystem(user?.id || null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showWelcomeBackModal, setShowWelcomeBackModal] = useState(false);
  const [showOneMinutePrepDialog, setShowOneMinutePrepDialog] = useState(false);
  // v6.9.33 — open Add Student modal on `?action=add-student` (sent by Signup
  // page right after first-time login, and by other deep links).
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  useEffect(() => {
    if (!isRegisteredUser) return;
    if (searchParams.get('action') === 'add-student') {
      setAddStudentOpen(true);
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

  // Handle ?forceNew=true query param from Profile page
  useEffect(() => {
    if (searchParams.get('forceNew') === 'true') {
      sessionStorage.setItem('forceNewWorksheet', 'true');
      setSearchParams({}, { replace: true });
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const handleGenerateWorksheet = (data: any) => {
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

    // v4.7: never show paywall while the token/profile fetch is in-flight.
    // useTokenSystem now keeps `loading` true until auth status AND profile are resolved.
    // We retry up to 2× (250ms + 500ms) before surfacing a soft error so the
    // user can re-click without losing their form data.
    const retryCount = (data as any).__tokenRetry || 0;
    if (isRegisteredUser && tokensLoading) {
      if (retryCount >= 2) {
        devWarn('⏳ Token check still in progress after 2 retries — surfacing soft error');
        return;
      }
      const delay = retryCount === 0 ? 250 : 500;
      devLog(`⏳ Token entitlement still resolving — retry ${retryCount + 1}/2 in ${delay}ms`);
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
        
        <GeneratingModal 
          isOpen={isGenerating} 
          requiresAudio={!!worksheetState.inputParams?.requiresAudio}
          requiresImage={!!worksheetState.inputParams?.requiresImage}
          hasGrammar={!!worksheetState.inputParams?.hasGrammar}
          streamProgress={streamProgress}
          mediaGenerating={mediaGenerating}
          selectedExercises={worksheetState.inputParams?.selectedExercises}
          errorMessage={generationError}
          onRetry={clearGenerationError}
        />
        
        <TokenPaywallModal
          isOpen={showTokenModal}
          onClose={() => setShowTokenModal(false)}
          availableTokens={tokenLeft}
          profile={profile}
          onUpgrade={() => {
            setShowTokenModal(false);
          }}
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
          <StatsBar />
          <ValueCards />
          <PricingTeaser />
          <EcosystemSection />
          <TestimonialsRow />
          <div id="pricing-section">
            <PricingSection
              calculatorValue={oneMinutePrepCalculator}
              onCalculatorChange={setOneMinutePrepCalculator}
            />
          </div>
          <FinalCTA onStartOneMinutePrep={() => setShowOneMinutePrepDialog(true)} />
        </>
      ) : (
        <>
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
      
      <GeneratingModal 
        isOpen={isGenerating} 
        requiresAudio={!!worksheetState.inputParams?.requiresAudio}
        requiresImage={!!worksheetState.inputParams?.requiresImage}
        hasGrammar={!!worksheetState.inputParams?.hasGrammar}
        streamProgress={streamProgress}
        mediaGenerating={mediaGenerating}
        selectedExercises={worksheetState.inputParams?.selectedExercises}
        errorMessage={generationError}
        onRetry={clearGenerationError}
        isAnonymous={true}
      />
      
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
