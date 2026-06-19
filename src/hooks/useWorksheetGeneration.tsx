
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { generateWorksheet } from "@/services/worksheetService";
import { FormData } from "@/components/WorksheetForm";
import { v4 as uuidv4 } from 'uuid';
import { formatPromptForAI, createFormDataForStorage } from "@/utils/promptFormatter";
import { processExercises } from "@/utils/exerciseProcessor";
import { getExpectedExerciseCount, validateWorksheet, createSampleVocabulary } from "@/utils/worksheetUtils";
import { deepFixTextObjects } from "@/utils/textObjectFixer";
import { useEventTracking } from "@/hooks/useEventTracking";
import { supabase } from "@/integrations/supabase/client";
import { generateAudioForWorksheet, generateImageForWorksheet } from '@/services/mediaService';
import { streamWorksheetGeneration } from '@/services/worksheetStreamService';
import { markWorksheetForClaim } from '@/hooks/useWorksheetClaim';
import { devLog, devWarn } from '@/utils/logger';
import { useDemoContext } from '@/contexts/DemoContext';
import {
  clearGenerationJob,
  completeGenerationJob,
  failGenerationJob,
  markSuggestionUsed,
  markTokenConsumed,
  patchGenerationJob,
  startGenerationJob,
} from '@/lib/worksheet/generationJobRegistry';
import { markPersistentAutoGenerateIntentStatus } from '@/lib/worksheet/autoGenerateBootstrap';
import { getTabId } from '@/lib/worksheet/tabId';

interface WorksheetGenerationEntitlement {
  hasTokens: boolean;
  canGenerateWorksheet: boolean;
  isDemo: boolean;
  consumeToken: (worksheetId: string) => Promise<boolean>;
}

export const useWorksheetGeneration = (
  userId: string | null,
  worksheetState: any,
  studentId?: string | null,
  entitlement?: WorksheetGenerationEntitlement
) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [startGenerationTime, setStartGenerationTime] = useState<number>(0);
  const [mediaGenerating, setMediaGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [streamProgress, setStreamProgress] = useState<{
    exercisesGenerated: number;
    expectedTotal: number;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // v6.9.60 — jobId of the in-flight generation. Shared between
  // generateWorksheetHandler and handleWorksheetCompletion so the
  // completion/token/suggestion mutations are scoped to the exact job.
  const activeJobIdRef = useRef<string | null>(null);
  const { toast } = useToast();
  const { trackEvent } = useEventTracking(userId);
  const { isDemoMode, showDemoBlockedToast } = useDemoContext();
  const hasTokens = entitlement?.hasTokens ?? !userId;
  const canGenerateWorksheet = entitlement?.canGenerateWorksheet ?? hasTokens;
  const isDemo = entitlement?.isDemo ?? !userId;
  const consumeToken = entitlement?.consumeToken ?? (async () => false);

  const generateWorksheetHandler = async (data: FormData) => {
    // v6.9.7-patch — hard demo guard before any work or navigation
    if (isDemoMode) {
      showDemoBlockedToast('Generating worksheets');
      return;
    }
    // Guard against double-click / duplicate requests
    if (isGenerating) {
      devWarn('⚠️ Generation already in progress, ignoring duplicate click');
      return;
    }
    // v6.9.45 — prefer the studentId carried by the form submission. Parent state
    // may not have synced yet when an auto-generate request races with the
    // navigation that just pre-selected the student.
    const effectiveStudentId: string | null = (data?.studentId as string | undefined) || studentId || null;
    devLog('🚀 Starting worksheet generation for:', data.lessonTime);
    devLog('🔧 Form data received:', { 
      lessonTime: data.lessonTime, 
      grammarFocus: data.teachingPreferences,
      hasGrammar: !!(data.teachingPreferences && data.teachingPreferences.trim()),
      studentId: effectiveStudentId
    });

    // v6.9.55 — stable correlation id for THIS generation attempt.
    // Used to (a) reconcile against `worksheets.form_data->>clientGenerationId`
    // when the SSE stream drops without a terminal event, (b) drive the
    // refresh-safe job registry, (c) gate Next Step `is_used` side effect on
    // an actually-saved worksheet for this attempt.
    const clientGenerationId: string =
      (data as any).__autoGenerateRequestId
      || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

    // FLAG: Track if streaming has started to prevent premature modal close
    let streamingStarted = false;

    // CRITICAL ADDITION: Sync subscription status before generation
    if (userId) {
      try {
        devLog('🔄 Syncing subscription status before worksheet generation...');
        await supabase.functions.invoke('check-subscription-status');
        devLog('✅ Subscription status synchronized');
      } catch (error) {
        console.error('⚠️ Warning: Subscription sync failed before generation:', error);
      }
    }

    // PROBLEM 4 FIX: Check token requirements ONLY for authenticated users
    if (userId && !isDemo && !canGenerateWorksheet) {
      toast({
        title: "No tokens available",
        description: "You need tokens to generate worksheets. Please upgrade your plan or purchase tokens.",
        variant: "destructive"
      });
      return;
    }
    
    // CRITICAL FIX: Clear storage but DON'T set any worksheet ID yet
    worksheetState.clearWorksheetStorage();

    // CRITICAL FIX: Generate temporary ID but DON'T set it in state yet
    const temporaryWorksheetId = uuidv4();
    devLog('🆔 Generated temporary worksheet ID (for fallback only):', temporaryWorksheetId);

    // CRITICAL: Calculate media/grammar requirements BEFORE opening modal
    const audioRequiredExercises = [
      "listening-comprehension", "multiple-choice-audio", 
      "true-false-audio", "fill-in-blanks-audio", "answer-questions-audio"
    ];
    const requiresAudio = data.selectedExercises?.some(ex => 
      audioRequiredExercises.some(reqEx => ex.includes(reqEx))
    );
    
    const pictureRequiredExercises = [
      "describe-picture", "answer-questions-picture",
      "true-false-picture", "multiple-choice-picture"
    ];
    const requiresImage = data.selectedExercises?.some(ex => 
      pictureRequiredExercises.some(reqEx => ex.includes(reqEx))
    );
    
    const hasGrammar = !!(data.teachingPreferences && data.teachingPreferences.trim());
    
    devLog('🔍 Media/Grammar requirements calculated:', { requiresAudio, requiresImage, hasGrammar });
    
    // Set inputParams with requirements BEFORE opening modal
    worksheetState.setInputParams({
      ...data,
      requiresAudio,
      requiresImage,
      hasGrammar
    });
    setGenerationError(null);
    setIsGenerating(true);
    
    const startTime = Date.now();
    setStartGenerationTime(startTime);

    // v6.9.53 — persist the generation as an active job so the mini panel
    // and refresh-safe polling can finish the side effects if the user
    // refreshes or navigates away mid-generation.
    // v6.9.60 — capture the returned jobId so every later mutation
    // (progress, complete, fail, token, suggestion) is scoped to THIS job
    // and cannot accidentally affect another concurrent generation.
    let activeJobId: string | null = null;
    activeJobIdRef.current = null;
    try {
      const autoSuggestionId =
        (data as any).__autoGenerateSuggestionId
        || (typeof window !== 'undefined' && sessionStorage.getItem('prefillSuggestionId'))
        || null;
      const startedJob = startGenerationJob({
        teacherId: userId,
        studentId: effectiveStudentId,
        suggestionId: autoSuggestionId,
        topic: String(data.lessonTopic || '').slice(0, 240),
        origin: !userId ? 'anonymous' : ((data as any).__autoGenerateFromSuggestion ? 'dslm-auto' : 'manual'),
        requestId: clientGenerationId,
        originTabId: getTabId(),
        // v6.9.57 — snapshot UI metadata so the modal can rehydrate after refresh
        formMeta: {
          requiresAudio: !!requiresAudio,
          requiresImage: !!requiresImage,
          hasGrammar: !!hasGrammar,
          selectedExercises: Array.isArray(data.selectedExercises) ? data.selectedExercises : [],
          studentName: (data as any).studentName ?? null,
          studentEmail: (data as any).studentEmail ?? null,
        },
      });
      activeJobId = startedJob?.jobId ?? null;
      activeJobIdRef.current = activeJobId;
    } catch (e) {
      devWarn('[useWorksheetGeneration] failed to start generation job', e);
    }

    // Track worksheet generation start
    trackEvent({
      eventType: 'worksheet_generation_start',
      eventData: {
        worksheetId: temporaryWorksheetId,
        timestamp: new Date().toISOString()
      }
    });
    
    try {
      devLog('📡 Starting worksheet generation...');
      
      const fullPrompt = await formatPromptForAI(data);
      const formDataForStorage = createFormDataForStorage(data);
      // v6.9.55 — persist the correlation id into the row's `form_data` so a
      // post-EOF reconciliation can locate THIS attempt's worksheet
      // unambiguously. Prompt input itself is NOT modified.
      (formDataForStorage as any).clientGenerationId = clientGenerationId;
      
      if (!userId) {
        devLog('📋 Anonymous user detected - proceeding in demo mode');
      }
      
      // ============================================================
      // KROK 1: PRE-GENERATE MEDIA (if needed)
      // ============================================================
      let selectedAudio = data.selectedAudio || null;
      let selectedImage = data.selectedImage || null;
      
      devLog('🔍 Using pre-calculated media requirements:', { requiresAudio, requiresImage, hasAudio: !!selectedAudio, hasImage: !!selectedImage });
      
      if (requiresAudio && !selectedAudio) {
        devLog('🎵 Pre-generating audio...');
        setMediaGenerating(true);
        if (activeJobId) {
          try {
            patchGenerationJob(activeJobId, {
              progress: {
                exercisesGenerated: 0,
                expectedTotal: getExpectedExerciseCount(data.lessonTime),
                phase: 'media',
              },
            });
          } catch { /* ignore */ }
        }
        
        try {
          selectedAudio = await generateAudioForWorksheet(data);
          devLog('✅ Audio pre-generated successfully');
        } catch (error) {
          console.error('❌ Audio generation failed — aborting (no token consumed):', error);
          setMediaGenerating(false);
          setIsGenerating(false);
          setGenerationError(
            "We couldn't generate the audio for your worksheet. " +
            "No tokens were used. Please try again — your form is ready."
          );
          return;
        } finally {
          setMediaGenerating(false);
        }
      }
      
      if (requiresImage && !selectedImage) {
        devLog('🎨 Pre-generating image...');
        setMediaGenerating(true);
        if (activeJobId) {
          try {
            patchGenerationJob(activeJobId, {
              progress: {
                exercisesGenerated: 0,
                expectedTotal: getExpectedExerciseCount(data.lessonTime),
                phase: 'media',
              },
            });
          } catch { /* ignore */ }
        }
        
        try {
          selectedImage = await generateImageForWorksheet(data);
          devLog('✅ Image pre-generated successfully');
        } catch (error) {
          console.error('❌ Image generation failed — aborting (no token consumed):', error);
          setMediaGenerating(false);
          setIsGenerating(false);
          setGenerationError(
            "We couldn't generate the image for your worksheet. " +
            "No tokens were used. Please try again — your form is ready."
          );
          return;
        } finally {
          setMediaGenerating(false);
        }
      }
      
      worksheetState.setInputParams({
        ...data,
        selectedAudio,
        selectedImage,
        requiresAudio,
        requiresImage,
        hasGrammar,
      });
      
      // ============================================================
      // KROK 2: GENERATE WORKSHEET WITH STREAMING
      // ============================================================
      devLog('📝 Generating worksheet with STREAMING enabled...');
      
      let worksheetResult: any = null;
      
      streamingStarted = true;
      devLog('🚦 Streaming flag set to TRUE - modal will stay open');
      
      // 4-minute safety timeout
      const generationTimeoutId = setTimeout(() => {
        console.error('⏰ Generation timeout after 4 minutes');
        abortControllerRef.current?.abort();
        setStreamProgress(null);
        setGenerationError("Generation took too long. Please try again.");
      }, 240_000);

      abortControllerRef.current = streamWorksheetGeneration(
        { 
          prompt: fullPrompt,
          formData: {
            ...formDataForStorage,
            selectedAudio,
            selectedImage,
          },
          studentId: effectiveStudentId
        },
        userId,
        {
          onStart: () => {
            devLog('🚀 Streaming started');
            const expectedTotal = getExpectedExerciseCount(data.lessonTime);
            setStreamProgress({ exercisesGenerated: 0, expectedTotal });
            if (activeJobId) {
              try {
                patchGenerationJob(activeJobId, {
                  progress: { exercisesGenerated: 0, expectedTotal },
                });
              } catch { /* ignore */ }
            }
          },
          onProgress: (progress) => {
            devLog(`📝 Progress: ${progress.exercisesGenerated}/${progress.expectedTotal}`);
            setStreamProgress(progress);
            if (activeJobId) {
              try {
                patchGenerationJob(activeJobId, {
                  progress: {
                    exercisesGenerated: progress.exercisesGenerated,
                    expectedTotal: progress.expectedTotal,
                    phase: (progress as any)?.phase,
                    percent: typeof (progress as any)?.percent === 'number' ? (progress as any).percent : undefined,
                  },
                });
              } catch { /* ignore */ }
            }
          },
          onDone: async (result) => {
            clearTimeout(generationTimeoutId);
            devLog('✅ Streaming complete:', result.worksheetId);
            worksheetResult = result.worksheet;
            worksheetResult.id = result.worksheetId;
            setStreamProgress(null);
            
            await handleWorksheetCompletion(worksheetResult, data, startTime);
          },
          onStreamEndedWithoutTerminalEvent: async (lastProgress) => {
            clearTimeout(generationTimeoutId);
            devWarn(
              '[useWorksheetGeneration] stream EOF without done/error — attempting DB reconciliation',
              { lastProgress, clientGenerationId }
            );
            const recovered = await recoverWorksheetAfterStreamLoss({
              clientGenerationId,
              teacherId: userId,
              studentId: effectiveStudentId,
              startedAt: startTime,
            });
            if (recovered) {
              devLog('✅ Recovered worksheet after stream EOF:', recovered.id);
              setStreamProgress(null);
              await handleWorksheetCompletion(recovered, data, startTime);
              return;
            }
            // v6.9.60 — Do NOT immediately mark this job as failed. The
            // backend keeps generating via `EdgeRuntime.waitUntil` and the
            // global hook `useActiveWorksheetGenerationJobs` keeps polling
            // for the saved worksheet by clientGenerationId. Close the
            // in-page modal for this submit, leave the persistent job in
            // `running` state so the mini-panel keeps showing it.
            setStreamProgress(null);
            setIsGenerating(false);
            devLog('🛟 Transport loss — keeping job running for DB polling', {
              clientGenerationId,
              activeJobId,
            });
            try {
              await supabase.functions.invoke('notify-generation-failure', {
                body: {
                  errorType: 'client_stream_lost_pending_db_reconciliation',
                  errorMessage: `Stream EOF after ${lastProgress.exercisesGenerated}/${lastProgress.expectedTotal || '?'} — handed off to DB polling`,
                  userId: userId || null,
                  teacherEmail: null,
                  model: 'unknown',
                  promptPreview: String(data.lessonTopic || '').slice(0, 120),
                  timestamp: new Date().toISOString(),
                  clientGenerationId,
                },
              });
            } catch (e) {
              devWarn('[useWorksheetGeneration] notify-generation-failure invoke failed', e);
            }
          },
          onError: async (error) => {
            clearTimeout(generationTimeoutId);
            console.error('❌ Stream error:', error);
            setStreamProgress(null);
            // v6.9.61 — Before declaring failure, attempt a single DB recovery
            // pass (covers the case where the SSE socket died but the backend
            // already saved the worksheet via EdgeRuntime.waitUntil).
            try {
              const recovered = await recoverWorksheetAfterStreamLoss({
                clientGenerationId,
                teacherId: userId,
                studentId: effectiveStudentId,
                startedAt: startTime,
              });
              if (recovered) {
                devLog('✅ [v6.9.61] Recovered worksheet after stream onError:', recovered.id);
                await handleWorksheetCompletion(recovered, data, startTime);
                return;
              }
            } catch (e) {
              devWarn('[useWorksheetGeneration] onError recovery attempt threw', e);
            }
            setGenerationError(error.message || "Something went wrong during generation.");
            try {
              // v6.9.61 — failGenerationJob now sets a 60s recoveryDeadlineAt
              // so the global DB poller can still promote the job back to
              // completed if the backend persists the worksheet later.
              if (activeJobId) {
                failGenerationJob(activeJobId, error.message || 'Generation failed');
              } else {
                failGenerationJob(error.message || 'Generation failed');
              }
              const reqId = (data as any).__autoGenerateRequestId;
              if (reqId) markPersistentAutoGenerateIntentStatus(reqId, 'failed');
              try { sessionStorage.removeItem('prefillSuggestionId'); } catch { /* ignore */ }
            } catch { /* ignore */ }
          }
        }
      );
      
      return;
    } catch (error) {
      console.error("💥 Worksheet generation error:", error);
      
      trackEvent({
        eventType: 'worksheet_generation_complete',
        eventData: {
          worksheetId: temporaryWorksheetId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError = errorMessage.includes('Failed to fetch') || 
                            errorMessage.includes('CORS') || 
                            errorMessage.includes('NetworkError') ||
                            errorMessage.includes('net::ERR');
      
      if (isNetworkError) {
        devWarn('🌐 Network error detected - showing external issue message');
        
        toast({
          title: "Generation failed due to external issues",
          description: "No tokens consumed. Your data is preserved. Please click 'Generate Custom Worksheet' again.",
          variant: "default",
          className: "bg-yellow-50 border-l-4 border-l-yellow-500 shadow-lg",
          duration: 3000
        });
      } else {
        toast({
          title: "Worksheet generation failed",
          description: error instanceof Error 
            ? `Error: ${error.message}. Please try again with different parameters.` 
            : "An unexpected error occurred. Please try again.",
          variant: "destructive"
        });
      }
      
    } finally {
      devLog('🏁 Finishing generation process...');
      
      if (!streamingStarted) {
        devLog('🚪 Closing modal - streaming never started (error before streaming)');
        setIsGenerating(false);
      } else {
        devLog('🔄 Modal stays open - streaming in progress (will close in callbacks)');
      }
      
      if (effectiveStudentId) {
        devLog('🔄 FINAL STEP: Updating student activity for:', effectiveStudentId);
        
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('studentUpdated', { 
            detail: { studentId: effectiveStudentId } 
          }));
          
          devLog('🔄 StudentUpdated event dispatched AFTER generation completed for:', effectiveStudentId);
        }, 500);
      }
    }
  };

  /**
   * v6.9.55 — Post-stream reconciliation. After an SSE EOF without a
   * terminal event, look up the worksheet row that THIS attempt may have
   * already saved. Returns a worksheet-shaped object compatible with
   * `handleWorksheetCompletion`, or null if nothing matches.
   */
  async function recoverWorksheetAfterStreamLoss(params: {
    clientGenerationId: string;
    teacherId: string | null;
    studentId: string | null;
    startedAt: number;
  }): Promise<any | null> {
    const POLL_INTERVAL_MS = 2000;
    const MAX_WAIT_MS = 30_000;
    const deadline = Date.now() + MAX_WAIT_MS;
    while (Date.now() < deadline) {
      try {
        let query = supabase
          .from('worksheets')
          .select('id, ai_response, html_content')
          .filter('form_data->>clientGenerationId', 'eq', params.clientGenerationId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1);
        if (params.teacherId) query = query.eq('teacher_id', params.teacherId);
        const { data, error } = await query;
        if (!error && data && data[0]?.id) {
          const row: any = data[0];
          let parsed: any = null;
          if (row.ai_response) {
            try { parsed = JSON.parse(row.ai_response); } catch { parsed = null; }
          }
          if (!parsed && row.html_content) {
            try { parsed = JSON.parse(row.html_content); } catch { parsed = null; }
          }
          if (parsed && Array.isArray(parsed.exercises)) {
            parsed.id = row.id;
            return parsed;
          }
        }
      } catch (e) {
        devWarn('[recoverWorksheetAfterStreamLoss] poll error', e);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    return null;
  }

  const handleWorksheetCompletion = async (worksheetResult: any, data: FormData, startTime: number) => {
    devLog("✅ Generated worksheet result received:", {
      hasData: !!worksheetResult,
      hasId: !!worksheetResult?.id,
      realId: worksheetResult?.id,
      exerciseCount: worksheetResult?.exercises?.length || 0,
      hasTitle: !!worksheetResult?.title,
      hasVocabulary: !!worksheetResult?.vocabulary_sheet
    });

    const finalWorksheetId = worksheetResult?.id;
    
    if (!finalWorksheetId) {
      console.error('❌ CRITICAL: No valid ID received from backend!');
      throw new Error("Failed to save worksheet to database - no ID returned");
    }

    devLog('🎯 TOKEN CONSUMPTION CHECK:', {
      isDemo,
      userId,
      hasUserId: !!userId,
      willConsumeToken: !isDemo && !!userId,
      finalWorksheetId
    });

    // v6.9.57 — Token consumption policy:
    //   - Consumed ONLY after a worksheet row exists in DB AND was validated
    //     client-side. Backend never consumes tokens itself.
    //   - Idempotent via consume_token RPC keyed on worksheet_id, so the
    //     refresh-safe polling path (useActiveWorksheetGenerationJob) and the
    //     in-flight client cannot both deduct.
    //   - Any failure before this point → ZERO tokens consumed.
    if (!isDemo && userId) {
      devLog('✅ Attempting to consume token for user:', userId);
      const tokenConsumed = await consumeToken(finalWorksheetId);
      devLog('🔍 Token consumption result:', tokenConsumed);
      if (!tokenConsumed) {
        devLog('⚠️ Failed to consume token, but worksheet was generated');
      } else {
        devLog('✅ Token consumed successfully');
        try {
          const jid = activeJobIdRef.current;
          if (jid) markTokenConsumed(jid);
          else markTokenConsumed();
        } catch { /* ignore */ }
      }
    }
    
    const actualGenerationTime = Math.round((Date.now() - startTime) / 1000);
    devLog('⏱️ Generation time:', actualGenerationTime, 'seconds');
    
    worksheetState.setGenerationTime(actualGenerationTime);
    worksheetState.setSourceCount(worksheetResult.sourceCount || Math.floor(Math.random() * (90 - 65) + 65));
    
    const expectedExerciseCount = getExpectedExerciseCount(data.lessonTime);
    devLog(`🎯 Expected ${expectedExerciseCount} exercises for ${data.lessonTime}`);
    
    devLog('🔍 Starting worksheet validation...');
    if (validateWorksheet(worksheetResult, expectedExerciseCount)) {
      devLog('✅ Worksheet validation passed, processing exercises...');
      
      devLog('🔧 DEEP FIXING entire worksheet before processing...');
      const deepFixedWorksheet = deepFixTextObjects(worksheetResult, 'worksheet');
      devLog('🔧 Worksheet after deep fix:', deepFixedWorksheet);
      
      if (deepFixedWorksheet.exercises.length > expectedExerciseCount) {
        devLog(`✂️ Trimming exercises from ${deepFixedWorksheet.exercises.length} to ${expectedExerciseCount}`);
        deepFixedWorksheet.exercises = deepFixedWorksheet.exercises.slice(0, expectedExerciseCount);
      }
      
      const hasGrammar = !!(data.teachingPreferences && data.teachingPreferences.trim());
      devLog('🔧 Processing exercises with parameters:', { 
        lessonTime: data.lessonTime, 
        hasGrammar,
        exerciseCount: deepFixedWorksheet.exercises.length 
      });
      
      deepFixedWorksheet.exercises = processExercises(deepFixedWorksheet.exercises, data.lessonTime, hasGrammar);
      
      deepFixedWorksheet.id = finalWorksheetId;
      
      if (!deepFixedWorksheet.vocabulary_sheet || deepFixedWorksheet.vocabulary_sheet.length === 0) {
        devLog('📝 Creating sample vocabulary sheet...');
        deepFixedWorksheet.vocabulary_sheet = createSampleVocabulary(15);
      }
      
      devLog('💾 CRITICAL FIX: Setting worksheet ID FIRST, then worksheet data');
      
      worksheetState.setWorksheetId(finalWorksheetId);

      // v6.1: If generation was anonymous, persist worksheet ID + anon UUID to
      // localStorage so a subsequent sign-up can claim ownership via the
      // claim-anonymous-worksheets edge function.
      try {
        const { data: authData } = await supabase.auth.getUser();
        const currentUser = authData?.user;
        if (currentUser?.is_anonymous) {
          markWorksheetForClaim(finalWorksheetId, currentUser.id);
          devLog('📌 Worksheet marked for claim after sign-up:', finalWorksheetId);
        }
      } catch (claimErr) {
        devWarn('[claim] Failed to mark worksheet for claim:', claimErr);
      }
      
      setTimeout(() => {
        devLog('💾 Now setting both worksheets in state with final ID:', finalWorksheetId);
        worksheetState.setGeneratedWorksheet(deepFixedWorksheet);
        worksheetState.setEditableWorksheet(deepFixedWorksheet);
        
        devLog('🔗 Updating URL to /worksheet/' + finalWorksheetId);
        window.history.pushState({}, '', `/worksheet/${finalWorksheetId}`);
        
        // Mark generation as complete
        setIsGenerating(false);
      }, 100);
      
      trackEvent({
        eventType: 'worksheet_generation_complete',
        eventData: {
          worksheetId: finalWorksheetId,
          success: true,
          generationTimeSeconds: actualGenerationTime,
          timestamp: new Date().toISOString()
        }
      });
      
      devLog('🎉 Worksheet generation completed successfully with ID:', finalWorksheetId);
      // v6.9.53 — flip the active generation job to `completed` so the global
      // mini panel switches to its CTA and the persistent intent stops firing.
      try {
        // v6.9.60 — scope to THIS job so a sibling running generation is not
        // flipped to completed by accident.
        const jid = activeJobIdRef.current;
        if (jid) completeGenerationJob(jid, finalWorksheetId);
        else completeGenerationJob(finalWorksheetId);
        const reqId = (data as any).__autoGenerateRequestId;
        if (reqId) markPersistentAutoGenerateIntentStatus(reqId, 'completed');
      } catch { /* ignore */ }
      toast({
        title: "Worksheet generated successfully!",
        description: "Your custom worksheet is now ready to use.",
        className: "bg-white border-l-4 border-l-green-500 shadow-lg rounded-xl"
      });
      // v4.7: signal WorksheetForm to clear its 24h persistence draft.
      // Failures (network, AI error, validation) do NOT dispatch this event,
      // so the user's draft is preserved and they can retry without re-entering data.
      try {
        window.dispatchEvent(new CustomEvent('worksheetGenerationSuccess', {
          detail: { worksheetId: finalWorksheetId },
        }));
        devLog('📣 Dispatched worksheetGenerationSuccess event');
      } catch (e) {
        devWarn('Failed to dispatch worksheetGenerationSuccess', e);
      }

      // v4.8: if this generation originated from a DSLM suggestion, flip is_used.
      try {
        // v6.9.57 — Only honor the suggestion id that came in WITH this exact
        // form submission. Removing the sessionStorage fallback prevents a
        // failed previous attempt from leaking a stale id into the next retry.
        const sourceSuggestionId = (data as any).__autoGenerateSuggestionId || null;
        if (sourceSuggestionId && finalWorksheetId) {
          const { error: usedErr } = await supabase
            .from('future_worksheet_suggestions')
            .update({
              is_used: true,
              used_worksheet_id: finalWorksheetId,
              used_at: new Date().toISOString(),
            })
            .eq('id', sourceSuggestionId);
          if (usedErr) {
            devWarn('[v4.8] Failed to mark suggestion as used:', usedErr);
          } else {
            devLog('[v4.8] Marked suggestion as used:', sourceSuggestionId);
            sessionStorage.removeItem('prefillSuggestionId');
            try {
              const jid = activeJobIdRef.current;
              if (jid) markSuggestionUsed(jid);
              else markSuggestionUsed();
            } catch { /* ignore */ }
            window.dispatchEvent(new CustomEvent('suggestionMarkedUsed', {
              detail: { suggestionId: sourceSuggestionId, worksheetId: finalWorksheetId },
            }));
          }
        }
      } catch (e) {
        devWarn('[v4.8] suggestion-used update threw', e);
      }
      
      // v6.9.45 — use the studentId that came in with the FormData payload so
      // DSLM auto-generate dispatches the event for the right student even when
      // parent state had not yet hydrated.
      const completionStudentId: string | null = (data?.studentId as string | undefined) || studentId || null;
      if (completionStudentId) {
        devLog('🔄 FINAL STEP: Updating student activity for:', completionStudentId);

        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('studentUpdated', {
            detail: { studentId: completionStudentId }
          }));

          devLog('🔄 StudentUpdated event dispatched AFTER generation completed for:', completionStudentId);
        }, 500);
      }
    } else {
      devLog('❌ Worksheet validation failed');
      throw new Error("Generated worksheet data is incomplete or invalid");
    }
  };

  const clearGenerationError = () => {
    setGenerationError(null);
    setIsGenerating(false);
    setStreamProgress(null);
  };

  return {
    isGenerating,
    generateWorksheetHandler,
    hasTokens,
    canGenerateWorksheet,
    isDemo,
    streamProgress,
    mediaGenerating,
    generationError,
    clearGenerationError,
    cancelGeneration: () => {
      devLog('🛑 Cancelling generation...');
      abortControllerRef.current?.abort();
      setIsGenerating(false);
      setStreamProgress(null);
      setMediaGenerating(false);
      setGenerationError(null);
      // v6.9.61 — explicit user cancellation: flip job to failed AND clear the
      // recovery window so the DB poller does not "recover" a cancelled run.
      try {
        const jid = activeJobIdRef.current;
        if (jid) {
          patchGenerationJob(jid, {
            status: 'failed',
            errorMessage: 'Cancelled by user',
            recoveryDeadlineAt: null,
          });
        }
      } catch { /* ignore */ }
      toast({
        title: "Generation cancelled",
        description: "Worksheet generation was stopped",
      });
    }
  };
};
