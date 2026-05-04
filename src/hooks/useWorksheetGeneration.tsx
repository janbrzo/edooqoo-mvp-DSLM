
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
import { useTokenSystem } from "@/hooks/useTokenSystem";
import { supabase } from "@/integrations/supabase/client";
import { generateAudioForWorksheet, generateImageForWorksheet } from '@/services/mediaService';
import { streamWorksheetGeneration } from '@/services/worksheetStreamService';
import { markWorksheetForClaim } from '@/hooks/useWorksheetClaim';
import { devLog, devWarn } from '@/utils/logger';

export const useWorksheetGeneration = (
  userId: string | null,
  worksheetState: any,
  studentId?: string | null
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
  const { toast } = useToast();
  const { trackEvent } = useEventTracking(userId);
  const { tokenLeft, hasTokens, isDemo, consumeToken } = useTokenSystem(userId);

  const generateWorksheetHandler = async (data: FormData) => {
    // Guard against double-click / duplicate requests
    if (isGenerating) {
      devWarn('⚠️ Generation already in progress, ignoring duplicate click');
      return;
    }
    devLog('🚀 Starting worksheet generation for:', data.lessonTime);
    devLog('🔧 Form data received:', { 
      lessonTime: data.lessonTime, 
      grammarFocus: data.teachingPreferences,
      hasGrammar: !!(data.teachingPreferences && data.teachingPreferences.trim()),
      studentId
    });

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
    if (userId && !isDemo && !hasTokens) {
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
      
      const fullPrompt = formatPromptForAI(data);
      const formDataForStorage = createFormDataForStorage(data);
      
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
          studentId
        },
        userId,
        {
          onStart: () => {
            devLog('🚀 Streaming started');
            const expectedTotal = getExpectedExerciseCount(data.lessonTime);
            setStreamProgress({ exercisesGenerated: 0, expectedTotal });
          },
          onProgress: (progress) => {
            devLog(`📝 Progress: ${progress.exercisesGenerated}/${progress.expectedTotal}`);
            setStreamProgress(progress);
          },
          onDone: async (result) => {
            clearTimeout(generationTimeoutId);
            devLog('✅ Streaming complete:', result.worksheetId);
            worksheetResult = result.worksheet;
            worksheetResult.id = result.worksheetId;
            setStreamProgress(null);
            
            await handleWorksheetCompletion(worksheetResult, data, startTime);
          },
          onError: (error) => {
            clearTimeout(generationTimeoutId);
            console.error('❌ Stream error:', error);
            setStreamProgress(null);
            setGenerationError(error.message || "Something went wrong during generation.");
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
      
      if (studentId) {
        devLog('🔄 FINAL STEP: Updating student activity for:', studentId);
        
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('studentUpdated', { 
            detail: { studentId } 
          }));
          
          devLog('🔄 StudentUpdated event dispatched AFTER generation completed for:', studentId);
        }, 500);
      }
    }
  };

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
    
    if (!isDemo && userId) {
      devLog('✅ Attempting to consume token for user:', userId);
      const tokenConsumed = await consumeToken(finalWorksheetId);
      devLog('🔍 Token consumption result:', tokenConsumed);
      if (!tokenConsumed) {
        devLog('⚠️ Failed to consume token, but worksheet was generated');
      } else {
        devLog('✅ Token consumed successfully');
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
        const sourceSuggestionId = sessionStorage.getItem('prefillSuggestionId');
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
            window.dispatchEvent(new CustomEvent('suggestionMarkedUsed', {
              detail: { suggestionId: sourceSuggestionId, worksheetId: finalWorksheetId },
            }));
          }
        }
      } catch (e) {
        devWarn('[v4.8] suggestion-used update threw', e);
      }
      
      if (studentId) {
        devLog('🔄 FINAL STEP: Updating student activity for:', studentId);
        
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('studentUpdated', { 
            detail: { studentId } 
          }));
          
          devLog('🔄 StudentUpdated event dispatched AFTER generation completed for:', studentId);
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
    tokenLeft,
    hasTokens,
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
      toast({
        title: "Generation cancelled",
        description: "Worksheet generation was stopped",
      });
    }
  };
};
