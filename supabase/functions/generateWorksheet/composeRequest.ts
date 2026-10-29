// Request stage of the generateWorksheet pipeline: identity, validation, rate
// limiting, sanitising, and the plans (exercise list, media, system message)
// that every mode feeds into the single pipeline.
import { getExerciseTypesForCount } from "./helpers.ts";
import { isValidUUID, sanitizeInput, validatePrompt } from "./security.ts";
import { checkBalance, checkRateLimit, limitResponse } from "./limits.ts";
import { getGeolocation } from "./geolocation.ts";
import { composeSystemMessage } from "./prompts/prompt-composer.ts";
import { resolveCaller } from "../_shared/auth.ts";
import { corsHeaders, OPENAI_FALLBACK_MODEL, supabase } from "./clients.ts";
import { buildWorksheetMediaContextImage } from "./media.ts";

/** Everything the modes need to know about one accepted request. */
export interface GenerationRequest {
  formData: any;
  isRegeneration: boolean;
  isBatchGeneration: boolean;
  useStreaming: boolean;
  userId: string | null;
  studentId: string | null;
  ip: string;
  geoData: { country?: string; city?: string };
  geoDuration: number;
  sanitizedPrompt: string;
  teacherEmail: string | null;
  hasGrammarFocus: boolean;
  grammarFocus: string | null;
  generationStartTime: number;
}

export type ResolvedRequest = { response: Response } | { request: GenerationRequest };

/**
 * Reads the body and runs every check that happens before any model work.
 * Returns the early HTTP response when the request is refused.
 */
export async function resolveRequest(req: Request, generationStartTime: number): Promise<ResolvedRequest> {
  const { prompt, formData, userId: requestedUserId, studentId: requestedStudentId, isRegeneration, isBatchGeneration, enableStreaming } =
    await req.json();

  // Identity comes from the caller's session token, never from the body:
  // worksheets are inserted with the service role, so a body `userId` would
  // let anyone write into any teacher's account. Anonymous Supabase sessions
  // keep their own id (worksheet page access + post-signup claim rely on it);
  // no session means anonymous generation with no owner.
  const caller = await resolveCaller(req);
  const userId: string | null = caller.kind === "user" ? caller.user.id : null;
  if (requestedUserId && requestedUserId !== "anonymous" && requestedUserId !== userId) {
    return {
      response: new Response(JSON.stringify({
        error: "Your session could not be verified. Please refresh the page and try again.",
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  let studentId: string | null = null;
  if (requestedStudentId) {
    const { data: ownedStudent } = userId
      ? await supabase.from("students").select("id").eq("id", requestedStudentId).eq("teacher_id", userId).maybeSingle()
      : { data: null };
    if (!ownedStudent) {
      return {
        response: new Response(JSON.stringify({ error: "Student not found" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }),
      };
    }
    studentId = requestedStudentId;
  }
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // Check if streaming is requested
  const useStreaming = enableStreaming === true;
  console.log("🔍 Streaming mode:", useStreaming ? "ENABLED" : "DISABLED");

  // Input validation
  const promptValidation = validatePrompt(prompt);
  if (!promptValidation.isValid) {
    console.error("❌ Prompt validation FAILED:", {
      error: promptValidation.error,
      promptType: typeof prompt,
      promptLength: prompt?.length || 0,
      promptPreview: typeof prompt === 'string' ? prompt.substring(0, 200) : String(prompt),
      userId: userId || 'anonymous',
      hasFormData: !!formData,
      formDataKeys: formData ? Object.keys(formData) : [],
    });
    // v6.9.95 — `validation` is a FORM INPUT error, not an application
    // incident: no alert email, no error_logs row. The client surfaces the
    // message directly and blocks the request before it is even sent.
    return {
      response: new Response(JSON.stringify({ error: promptValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  // Validate userId if provided - allow null/undefined for anonymous mode
  // FIXED: Accept null, undefined, or 'anonymous' for demo mode (non-logged users)
  if (userId && userId !== "anonymous" && userId !== null && !isValidUUID(userId)) {
    console.log("❌ Invalid userId format:", userId);
    return {
      response: new Response(JSON.stringify({ error: "Invalid user ID format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  // Log anonymous mode
  if (!userId || userId === "anonymous") {
    console.log("📋 Anonymous mode - worksheet will be created without user association");
  }

  // Rate limit (DB-backed, fail open to the in-memory limiter; see limits.ts), then the
  // balance pre-check: both answer before geolocation and any model work.
  const isAnonymous = caller.kind === "user" && caller.isAnonymous;
  const limitInput = { client: supabase, userId, isAnonymous, isBatchGeneration, isRegeneration, formData };
  const rateDecision = await checkRateLimit({ ...limitInput, headers: req.headers, legacyKey: ip });
  if (!rateDecision.ok) return { response: limitResponse(rateDecision, corsHeaders) };
  const balanceDecision = await checkBalance(limitInput);
  if (!balanceDecision.ok) return { response: limitResponse(balanceDecision, corsHeaders) };

  // ⏱️ TIMING: Get geolocation data
  const geoStartTime = Date.now();
  const geoData = await getGeolocation(ip);
  const geoDuration = Date.now() - geoStartTime;
  console.log(`⏱️ [TIMING] Geolocation lookup: ${geoDuration}ms`);

  // Sanitize inputs
  const sanitizedPrompt = sanitizeInput(prompt, 5000);

  console.log("Received validated prompt:", sanitizedPrompt.substring(0, 100) + "...");

  // Get teacher email if userId is provided
  let teacherEmail = null;
  if (userId) {
    try {
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();

      teacherEmail = profile?.email || null;
    } catch (error) {
      // Continue without email - not critical for worksheet generation
    }
  }

  // Check if grammarFocus is provided in the prompt
  const hasGrammarFocus = sanitizedPrompt.includes("grammarFocus:");
  const grammarFocusMatch = sanitizedPrompt.match(/grammarFocus:\s*(.+?)(?:\n|$)/);
  const grammarFocus = grammarFocusMatch ? grammarFocusMatch[1].trim() : null;

  return {
    request: {
      formData,
      isRegeneration,
      isBatchGeneration,
      useStreaming,
      userId,
      studentId,
      ip,
      geoData,
      geoDuration,
      sanitizedPrompt,
      teacherEmail,
      hasGrammarFocus,
      grammarFocus,
      generationStartTime,
    },
  };
}

// ============================================================
// BATCH GENERATION MODE - Generate multiple exercise types in ONE request
// ============================================================
export interface BatchPlan {
  batchStartTime: number;
  totalExerciseCount: number;
  systemMessage: string;
}

export function planBatch(request: GenerationRequest): BatchPlan {
  const { formData, hasGrammarFocus, grammarFocus } = request;
  const batchStartTime = Date.now();
  console.log("🔄 [BATCH-MODE] Batch generation requested for types:", formData.targetExerciseTypes);
  console.log("🔄 [BATCH-MODE] Exercise count per type:", formData.exerciseCountPerType || 1);

  const exerciseCountPerType = formData.exerciseCountPerType || 1;
  const totalExerciseCount = formData.targetExerciseTypes.length * exerciseCountPerType;

  // P1.5 — keep the existing worksheet media when the requested batch types
  // depend on it, otherwise picture/audio exercises are generated blind.
  const batchNeedsImage = formData.targetExerciseTypes.some((t: string) =>
    String(t).includes("-picture") || String(t) === "describe-picture"
  );
  const batchNeedsAudio = formData.targetExerciseTypes.some((t: string) =>
    String(t).includes("-audio") || String(t) === "listening-comprehension"
  );
  const batchImage = batchNeedsImage ? (formData.selectedImage || null) : null;
  const batchAudio = batchNeedsAudio ? (formData.selectedAudio || null) : null;

  // Build ONE system message for ALL exercise types
  const systemMessage = composeSystemMessage(
    hasGrammarFocus,
    grammarFocus,
    {
      ...formData,
      selectedExercises: formData.targetExerciseTypes, // Pass ALL types
      selectedImage: batchImage,
      selectedAudio: batchAudio,
    },
    totalExerciseCount, // Total count of ALL exercises
    formData.targetExerciseTypes, // ALL types at once
    batchImage,
    batchAudio,
  );

  console.log(
    `🔄 [BATCH-MODE] Making ONE AI request for ${totalExerciseCount} exercises across ${formData.targetExerciseTypes.length} types`,
  );

  return { batchStartTime, totalExerciseCount, systemMessage };
}

// ============================================================
// FULL WORKSHEET / REGENERATION PLAN (streaming and regular modes)
// ============================================================
export interface WorksheetPlan {
  exerciseCount: number;
  selectedImage: any;
  selectedAudio: any;
  hasPictureMedia: boolean;
  systemMessage: string;
  /** Start of the model call, for the timing logs. */
  openaiStartTime: number;
}

export function planWorksheet(request: GenerationRequest): WorksheetPlan {
  const { formData, isRegeneration, sanitizedPrompt, hasGrammarFocus, grammarFocus, generationStartTime } = request;

  // Determine exercise count from lesson duration
  let exerciseCount = 8; // Default for 60+ minutes

  if (isRegeneration && formData?.regenerationMode) {
    exerciseCount = 1;
  } else {
    if (formData?.lessonTime) {
      exerciseCount = formData.lessonTime === "45min" ? 6 : 8;
    } else {
      const durationMatch = sanitizedPrompt.match(/(\d+)\s*min/);
      const lessonDuration = durationMatch ? parseInt(durationMatch[1]) : 60;
      exerciseCount = lessonDuration <= 45 ? 6 : 8;
    }
  }

  const selectedExercises = formData?.selectedExercises;
  const effectiveExercises =
    isRegeneration && formData?.targetExerciseType ? [formData.targetExerciseType] : selectedExercises;

  // CHECK: Do exercises require picture?
  const pictureRequiredExercises = [
    "describe-picture",
    "answer-questions-picture",
    "true-false-picture",
    "multiple-choice-picture",
  ];
  const requiresPicture = effectiveExercises?.some((ex: string) =>
    pictureRequiredExercises.some((reqEx) => ex.includes(reqEx)),
  );

  // Check if audio is required (evaluated for its side effects on malformed input only)
  const audioRequiredExercises = [
    "listening-comprehension",
    "multiple-choice-audio",
    "true-false-audio",
    "fill-in-blanks-audio",
    "answer-questions-audio",
  ];
  effectiveExercises?.some((ex: string) => audioRequiredExercises.some((reqEx) => ex.includes(reqEx)));

  console.log("📸 Picture requirement check:", {
    selectedExercises: effectiveExercises,
    requiresPicture,
    hasExistingImage: !!formData?.selectedImage,
  });

  // ============================================================
  // MEDIA HANDLING - Now pre-generated on frontend
  // ============================================================
  // Media is now generated on the frontend BEFORE this function is called.
  // This reduces backend execution time from 60s+ to <30s, preventing 546 WORKER_LIMIT errors.

  const selectedImage = formData?.selectedImage || null;
  const selectedAudio = formData?.selectedAudio || null;
  // v6.9.64 — sanitized copy for prompt only; DB row keeps full image.
  const worksheetPromptImage = buildWorksheetMediaContextImage(selectedImage);

  console.log("📸🎵 [MEDIA-CHECK] Received pre-generated media:", {
    hasImage: !!selectedImage,
    hasAudio: !!selectedAudio,
    worksheetPromptImageDescChars: worksheetPromptImage?.detailedDescription?.length || 0,
  });

  const hasPictureMedia = selectedImage !== null;
  // The result is not used (the composer filters the list itself); the call is
  // kept because it throws on a malformed selection, as before the refactor.
  getExerciseTypesForCount(exerciseCount, effectiveExercises);

  // Enhanced logging for picture mode debugging
  console.log("📸 Picture mode final state:", {
    hasPictureMedia,
    hasImageUrl: !!selectedImage?.url,
    imageId: selectedImage?.id,
    imageSource: selectedImage?.source,
    hasDetailedDescription: !!selectedImage?.detailedDescription,
    descriptionPreview: selectedImage?.detailedDescription?.substring(0, 150),
  });

  // DEBUG: Log audio data before passing to prompt composer
  console.log("🎵 [DEBUG] selectedAudio being passed to prompt composer:", {
    hasAudio: !!selectedAudio,
    hasTranscript: !!selectedAudio?.transcript,
    transcriptLength: selectedAudio?.transcript?.length || 0,
    transcriptPreview: selectedAudio?.transcript?.substring(0, 100) || "[EMPTY]",
    audioDuration: selectedAudio?.duration,
    audioVoice: selectedAudio?.voice,
  });

  // CREATE SYSTEM MESSAGE using modular prompt structure with selectedImage, selectedAudio and exerciseFocusMap
  const exerciseFocusMap = formData?.exerciseFocusMap || null;
  const systemMessage = composeSystemMessage(
    hasGrammarFocus,
    grammarFocus,
    formData,
    exerciseCount,
    effectiveExercises,
    worksheetPromptImage,
    selectedAudio,
    exerciseFocusMap,
  );

  // HEARTBEAT LOG: Before AI API call
  const openaiStartTime = Date.now();
  console.log("🔵 HEARTBEAT: Starting AI API call", {
    timestamp: new Date().toISOString(),
    elapsedSinceStart: Math.round((openaiStartTime - generationStartTime) / 1000) + "s",
    primaryModel: "gemini-2.5-flash",
    fallbackModel: OPENAI_FALLBACK_MODEL,
    exerciseCount,
    promptLength: sanitizedPrompt.length,
  });

  return { exerciseCount, selectedImage, selectedAudio, hasPictureMedia, systemMessage, openaiStartTime };
}
