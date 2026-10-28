import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { getExerciseTypesForCount, getOfficialExerciseName } from "./helpers.ts";
import { validateExercise } from "./validators.ts";
import { isValidUUID, sanitizeInput, validatePrompt } from "./security.ts";
import { RateLimiter } from "./rateLimiter.ts";
import { getGeolocation } from "./geolocation.ts";
import { composeSystemMessage } from "./prompts/prompt-composer.ts";
import { resolveCaller } from "../_shared/auth.ts";
import {
  createSSEStream,
  countExercisesInPartialJSON,
  getExpectedExerciseCount as getExpectedCount,
} from "./streaming.ts";
import { corsHeaders, openai, OPENAI_FALLBACK_MODEL, supabase } from "./clients.ts";
import { buildWorksheetMediaContextImage } from "./media.ts";
import { classifyErrorType, notifyGenerationFailure } from "./notify.ts";
import { parseOrRegenerateWithFallback, parseWithRecovery } from "./parse.ts";
import { generateNonStreaming, generateWithGeminiStream } from "./model.ts";

const rateLimiter = new RateLimiter();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Start generation time measurement
  const generationStartTime = Date.now();

  try {
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
      return new Response(JSON.stringify({
        error: "Your session could not be verified. Please refresh the page and try again.",
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let studentId: string | null = null;
    if (requestedStudentId) {
      const { data: ownedStudent } = userId
        ? await supabase.from("students").select("id").eq("id", requestedStudentId).eq("teacher_id", userId).maybeSingle()
        : { data: null };
      if (!ownedStudent) {
        return new Response(JSON.stringify({ error: "Student not found" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
      return new Response(JSON.stringify({ error: promptValidation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate userId if provided - allow null/undefined for anonymous mode
    // FIXED: Accept null, undefined, or 'anonymous' for demo mode (non-logged users)
    if (userId && userId !== "anonymous" && userId !== null && !isValidUUID(userId)) {
      console.log("❌ Invalid userId format:", userId);
      return new Response(JSON.stringify({ error: "Invalid user ID format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log anonymous mode
    if (!userId || userId === "anonymous") {
      console.log("📋 Anonymous mode - worksheet will be created without user association");
    }

    // Enhanced rate limiting with multi-tier limits
    const rateLimitKey = ip;
    if (!rateLimiter.isAllowed(rateLimitKey)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // ============================================================
    // BATCH GENERATION MODE - Generate multiple exercise types in ONE request
    // ============================================================
    if (isBatchGeneration && formData?.targetExerciseTypes && Array.isArray(formData.targetExerciseTypes)) {
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
      const batchSystemMessage = composeSystemMessage(
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

      // Try Gemini first, fallback to OpenAI
      const batchModelResult = await generateNonStreaming(batchSystemMessage, sanitizedPrompt, {
        trying: "🔵 [BATCH-MODE] Trying Gemini 2.5 Flash as primary model...",
        geminiSucceeded: `✅ [BATCH-MODE] Gemini 2.5 Flash succeeded`,
        geminiFailed: "⚠️ [BATCH-MODE] Gemini failed, falling back to OpenAI fallback model:",
        openaiSucceeded: `✅ [BATCH-MODE] OpenAI fallback succeeded`,
      });
      const batchContent: string = batchModelResult.content || "";
      const usedModel: string = batchModelResult.model;

      const batchGenerationTime = ((Date.now() - batchStartTime) / 1000).toFixed(2);
      console.log(`📊 [BATCH-MODE] Used model: ${usedModel}`);
      console.log(`⏱️ [BATCH-MODE] AI responded in ${batchGenerationTime}s`);

      if (!batchContent) {
        throw new Error("No content received from AI in batch mode");
      }

      try {
        const { data: batchData, repairMethod } = await parseWithRecovery(batchContent, totalExerciseCount);
        if (repairMethod !== 'none') console.log(`🔧 [BATCH] JSON repaired using: ${repairMethod}`);
        if (!batchData.exercises || !Array.isArray(batchData.exercises)) {
          throw new Error("Invalid exercises structure in batch response");
        }

        console.log(`✅ [BATCH-MODE] Generated ${batchData.exercises.length} exercises in ONE request (${usedModel})`);
        console.log(`⏱️  [BATCH-MODE] Total batch generation time: ${batchGenerationTime} seconds`);

        // Return batch exercises directly WITH FULL PROMPT for storage in homework_assignments.prompt
        return new Response(
          JSON.stringify({
            exercises: batchData.exercises,
            fullPrompt: batchSystemMessage, // ✅ Return complete system message for homework_assignments.prompt
            success: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error(`❌ [BATCH-MODE] Failed to parse batch response:`, error);
        const errType = classifyErrorType(error);
        notifyGenerationFailure(errType, error instanceof Error ? error.message : String(error), {
          userId, teacherEmail, model: usedModel, mode: 'batch',
        });
        throw error;
      }
    }

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

    // Check if audio is required
    const audioRequiredExercises = [
      "listening-comprehension",
      "multiple-choice-audio",
      "true-false-audio",
      "fill-in-blanks-audio",
      "answer-questions-audio",
    ];
    const requiresAudio = effectiveExercises?.some((ex: string) => audioRequiredExercises.some((reqEx) => ex.includes(reqEx)));

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

    const hasAudioMedia = selectedAudio !== null;

    const hasPictureMedia = selectedImage !== null;
    const exerciseTypes = getExerciseTypesForCount(exerciseCount, effectiveExercises);

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

    // Track which model was used for logging
    let usedModel = "unknown";

    // ============================================================
    // STREAMING MODE: Real-time progress via SSE
    // ============================================================
    if (useStreaming) {
      console.log("🌊 Starting STREAMING mode...");

      const { readable, send, close } = createSSEStream();

      // Immediately return SSE response to client
      const responsePromise = new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });

      // v6.9.57 — Refresh-safe streaming.
      // The previous IIFE was not registered with EdgeRuntime.waitUntil, so
      // when the client disconnected (e.g. page refresh) Deno Deploy killed
      // the worker BEFORE the worksheets INSERT ran. We now:
      //   1) wrap every SSE write in safeSend that tolerates a closed stream
      //      and flips into headless "background-only" mode,
      //   2) keep the worker alive via EdgeRuntime.waitUntil so the DB save
      //      always completes — refresh-safe polling on the client then picks
      //      up the saved row via form_data->>clientGenerationId.
      // The worksheet generation prompt and model pipeline are NOT touched.
      let clientConnected = true;
      const safeSend = (event: string, payload: unknown) => {
        if (!clientConnected) return;
        // `send` now returns `false` when the controller is already closed.
        // Trust it instead of catching exceptions one-by-one, and flip to
        // background-only mode so we never log per-write failures again.
        const ok = send(event, payload);
        if (!ok) {
          clientConnected = false;
          console.log(
            "📴 SSE client disconnected, continuing in background-only mode",
            { event },
          );
        }
      };
      const safeClose = () => {
        if (!clientConnected) return;
        clientConnected = false;
        close();
      };

      const backgroundWork = (async () => {
        let fullContent = "";
        let lastExerciseCount = 0;
        let streamUsedModel = "";
        const expectedTotal = getExpectedCount(formData?.lessonTime);

        try {
          safeSend("start", { message: "Starting generation..." });

          let geminiFailed = false;
          let salvaged: { data: any; content: string; repairMethod: string; modelOverride?: string } | null = null;

          try {
            console.log("🔵 Trying Gemini 2.5 Flash streaming...");
            streamUsedModel = "gemini-2.5-flash";

            const geminiResult = await generateWithGeminiStream(
              systemMessage,
              sanitizedPrompt,
              (chunkText) => {
                fullContent += chunkText;
                const newCount = countExercisesInPartialJSON(fullContent);
                if (newCount > lastExerciseCount) {
                  lastExerciseCount = newCount;
                  safeSend("progress", {
                    exercisesGenerated: newCount,
                    expectedTotal,
                  });
                }
              },
              30000
            );

            fullContent = geminiResult.content;
            console.log(`✅ Gemini streaming completed`);
          } catch (geminiError) {
            geminiFailed = true;
            // v6.9.96 — Gemini can throw "Failed to parse stream" AFTER every
            // exercise already arrived (callback buffered it in `fullContent`).
            // Try to salvage that content before paying for a slow OpenAI
            // regeneration.
            if (lastExerciseCount >= expectedTotal && fullContent.trim()) {
              try {
                const rescued = await parseWithRecovery(fullContent, expectedTotal);
                if (Array.isArray(rescued.data?.exercises) && rescued.data.exercises.length >= expectedTotal) {
                  console.warn(
                    "🛟 Gemini stream errored after full content — salvaged without fallback:",
                    (geminiError as Error).message,
                  );
                  salvaged = {
                    data: rescued.data,
                    content: fullContent,
                    repairMethod: rescued.repairMethod === 'none' ? 'stream-salvage' : `stream-salvage+${rescued.repairMethod}`,
                  };
                }
              } catch (salvageError) {
                console.warn("⚠️ Stream salvage failed, using OpenAI fallback:", (salvageError as Error).message);
              }
            }
          }
          if (geminiFailed && !salvaged) {
            console.warn("⚠️ Gemini streaming failed, falling back to OpenAI");
            streamUsedModel = OPENAI_FALLBACK_MODEL;
            // v6.9.60 — keep progress monotonic across the fallback so the
            // client UI does not visually regress from e.g. 3/8 back to 1/8.
            // We only restart the content buffer (because Gemini output was
            // not valid JSON) but preserve `lastExerciseCount` so we only
            // emit progress events when OpenAI actually surpasses it.
            fullContent = "";
            const fallbackProgressFloor = lastExerciseCount;

            const stream = await (openai.chat.completions.create as any)({
              model: OPENAI_FALLBACK_MODEL,
              temperature: 1,
              messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: sanitizedPrompt },
              ],
              max_completion_tokens: 30000,
              stream: true,
            });

            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta?.content || "";
              fullContent += delta;
              const newCount = countExercisesInPartialJSON(fullContent);
              if (newCount > lastExerciseCount && newCount > fallbackProgressFloor) {
                lastExerciseCount = newCount;
                safeSend("progress", { exercisesGenerated: newCount, expectedTotal });
              }
            }
            console.log(`✅ OpenAI fallback streaming completed`);
          }

          console.log(`📊 Streaming used model: ${streamUsedModel}`);
          console.log("✅ Streaming completed, parsing final JSON...");

          // Parse final JSON with full recovery pipeline.
          // AI-REPAIR can take 10-30s of silent Gemini work → emit keepalive
          // progress events every 15s so the client heartbeat (40s) does not trip.
          // v6.9.64 — also emit smooth `percent` so the mini-panel/main modal
          // progress bar continues moving during repair instead of snapping.
          safeSend("progress", { exercisesGenerated: expectedTotal, expectedTotal, phase: "repairing", percent: 92 });
          let repairTick = 0;
          const repairKeepalive = setInterval(() => {
            repairTick += 1;
            safeSend("progress", {
              exercisesGenerated: expectedTotal,
              expectedTotal,
              phase: "repairing",
              percent: Math.min(98, 92 + repairTick),
            });
          }, 5000);

          let worksheetData: any;
          let repairMethod: string;
          try {
            // v6.9.64 — allow a parse-safe model fallback for picture worksheets
            // (the long visual description is the dominant cause of malformed
            // JSON). Non-picture worksheets keep the old behavior.
            const result = salvaged ?? await parseOrRegenerateWithFallback({
              rawContent: fullContent,
              expectedExerciseCount: expectedTotal,
              systemMessage,
              sanitizedPrompt,
              allowRegenerateFallback: hasPictureMedia,
            });
            worksheetData = result.data;
            fullContent = result.content;
            repairMethod = result.repairMethod;
            if (result.modelOverride) streamUsedModel = result.modelOverride;
          } finally {
            clearInterval(repairKeepalive);
          }
          if (repairMethod !== 'none') {
            console.log(`🔧 [STREAMING] JSON was repaired using: ${repairMethod}`);
            // Best-effort early warning — worksheet uratowany, but prompt may be drifting.
            if (repairMethod === 'ai' || repairMethod === 'ai-fallback') {
              const earlyWarnPromise = notifyGenerationFailure(
                'parse_recovered',
                `Gemini returned malformed JSON, recovered via ${repairMethod}. Investigate prompt drift.`,
                {
                  userId, teacherEmail, model: streamUsedModel,
                  promptPreview: sanitizedPrompt?.substring(0, 300),
                }
              );
              try {
                // @ts-ignore - EdgeRuntime is a Deno Deploy global
                if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
                  // @ts-ignore
                  EdgeRuntime.waitUntil(earlyWarnPromise);
                }
              } catch (_) { /* ignore */ }
            }
          }

          if (!worksheetData.title || !worksheetData.exercises || !Array.isArray(worksheetData.exercises)) {
            throw new Error("Invalid worksheet structure returned from AI");
          }

          // Validate exercises (parity with regular mode)
          for (let i = 0; i < worksheetData.exercises.length; i++) {
            try {
              validateExercise(worksheetData.exercises[i]);
            } catch (validationError) {
              // Continue with lenient mode
            }
          }

          // PROBLEM 6 FIX: Preserve AI description in exercise titles
          worksheetData.exercises.forEach((exercise: any, index: number) => {
            const exerciseNumber = index + 1;
            const officialName = getOfficialExerciseName(exercise.type);
            const aiTitle = exercise.title || '';
            const cleanAiTitle = aiTitle.replace(/^Exercise\s+\d+:\s*/i, '').trim();
            const escapedName = officialName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const aiDesc = cleanAiTitle.replace(new RegExp(`^${escapedName}\\s*[-:]?\\s*`, 'i'), '').trim();
            exercise.title = aiDesc 
              ? `Exercise ${exerciseNumber}: ${officialName}: ${aiDesc}` 
              : `Exercise ${exerciseNumber}: ${officialName}`;
          });

          const sourceCount = Math.floor(Math.random() * (90 - 65) + 65);
          worksheetData.sourceCount = sourceCount;

          // Calculate generation time
          const generationTimeSeconds = Math.round((Date.now() - generationStartTime) / 1000);

          // Save to database
          safeSend("progress", { exercisesGenerated: expectedTotal, expectedTotal, phase: "saving", percent: 99 });
          console.log("💾 Saving worksheet to database...");
          const fullPrompt = `SYSTEM MESSAGE:\n${systemMessage}\n\nUSER MESSAGE:\n${sanitizedPrompt}`;
          const sanitizedFormData = formData ? JSON.parse(JSON.stringify(formData)) : {};

          // Remove base64 data before saving
          const sanitizedImage = selectedImage
            ? {
                ...selectedImage,
                url: selectedImage.url?.startsWith("data:") ? null : selectedImage.url,
                ai_generated_url: selectedImage.ai_generated_url?.startsWith("data:")
                  ? null
                  : selectedImage.ai_generated_url,
                thumbnail: selectedImage.thumbnail?.startsWith("data:") ? null : selectedImage.thumbnail,
              }
            : null;

          const sanitizedAudio = selectedAudio
            ? {
                ...selectedAudio,
                url: selectedAudio.url?.startsWith("data:") ? null : selectedAudio.url,
                ai_generated_audio_url: selectedAudio.ai_generated_audio_url?.startsWith("data:")
                  ? null
                  : selectedAudio.ai_generated_audio_url,
              }
            : null;

          // 📊 MONITORING: Log ai_response length for truncation tracking
          const aiResponseLength = fullContent?.length || 0;
          const aiResponseLimit = 200000;
          const wasTruncated = aiResponseLength > aiResponseLimit;
          console.log(`📊 [MONITORING] ai_response length: ${aiResponseLength} chars, limit: ${aiResponseLimit}, truncated: ${wasTruncated}`);
          if (wasTruncated) {
            console.warn(`⚠️ [MONITORING] Worksheet ai_response TRUNCATED from ${aiResponseLength} to ${aiResponseLimit} chars`);
          }

          // Auto-generate share token at creation time (permanent, no expiration)
          const shareToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

          const { data: worksheet, error: worksheetError } = await supabase
            .from("worksheets")
            .insert({
              prompt: fullPrompt,
              form_data: sanitizedFormData,
              ai_response: fullContent?.substring(0, aiResponseLimit) || "", // Increased from 50000 to 200000
              html_content: JSON.stringify(worksheetData),
              user_id: userId || null,
              teacher_id: userId || null,
              teacher_email: teacherEmail,
              student_id: studentId || null,
              selected_image: sanitizedImage,
              selected_audio: sanitizedAudio,
              audio_url: selectedAudio?.ai_generated_audio_url || selectedAudio?.url || null,
              audio_transcript: selectedAudio?.transcript || null,
              audio_duration: selectedAudio?.duration || null,
              audio_voice: selectedAudio?.voice || null,
              ip_address: ip,
              status: "created",
              title: worksheetData.title?.substring(0, 255) || "Generated Worksheet",
              generation_time_seconds: generationTimeSeconds,
              country: geoData.country || null,
              city: geoData.city || null,
              share_token: shareToken,
            })
            .select("id, created_at, title, share_token");

          if (worksheetError) {
            throw new Error(`Database save failed: ${worksheetError.message}`);
          }

          const worksheetId = worksheet?.[0]?.id;
          if (!worksheetId) {
            throw new Error("No worksheet ID returned from database");
          }

          worksheetData.id = worksheetId;
          worksheetData.share_token = worksheet?.[0]?.share_token;

          console.log("✅ Streaming generation complete, sending done event");
          safeSend("done", {
            worksheetId,
            worksheet: worksheetData,
          });
        } catch (error) {
          let errorContext: Record<string, any> = { userId, model: streamUsedModel };
          try {
            errorContext.exerciseCount = expectedTotal;
            errorContext.errorMessage = error instanceof Error ? error.message : String(error);
            errorContext.errorStack = error instanceof Error ? error.stack : undefined;
          } catch (_) { /* ignore logging errors */ }
          console.error("❌ Streaming generation FAILED:", errorContext);
          const errType = classifyErrorType(error);
          const notifyPromise = notifyGenerationFailure(
            errType,
            error instanceof Error ? error.message : String(error),
            {
              userId, teacherEmail, model: streamUsedModel,
              promptPreview: sanitizedPrompt?.substring(0, 300),
            }
          );
          // EdgeRuntime.waitUntil keeps the notification fetch alive even after
          // the response stream is closed — otherwise Deno Deploy kills it.
          try {
            // @ts-ignore - EdgeRuntime is a Deno Deploy global
            if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
              // @ts-ignore
              EdgeRuntime.waitUntil(notifyPromise);
            } else {
              await notifyPromise;
            }
          } catch (_) { /* ignore */ }
          safeSend("error", { message: error instanceof Error ? error.message : "Unknown error" });
        } finally {
          safeClose();
        }
      })();

      // Keep the worker alive even after the client disconnects so the DB
      // insert at the end of the pipeline always completes.
      try {
        // @ts-ignore - EdgeRuntime is a Deno Deploy global
        if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(backgroundWork);
        }
      } catch (_) { /* ignore */ }

      return responsePromise;
    }

    // ============================================================
    // REGULAR MODE: Non-streaming (backward compatibility)
    // ============================================================
    console.log("📄 Using REGULAR (non-streaming) mode");

    // Generate worksheet - Try Gemini first, fallback to OpenAI
    const regularModelResult = await generateNonStreaming(systemMessage, sanitizedPrompt, {
      trying: "🔵 Trying Gemini 2.5 Flash for regular generation...",
      geminiSucceeded: `✅ Gemini 2.5 Flash succeeded`,
      geminiFailed: "⚠️ Gemini failed, falling back to OpenAI fallback model:",
      openaiSucceeded: `✅ OpenAI fallback succeeded`,
    });
    let jsonContent: string | null = regularModelResult.content;
    usedModel = regularModelResult.model;

    // HEARTBEAT LOG: After AI API call
    const openaiEndTime = Date.now();
    const openaiDuration = Math.round((openaiEndTime - openaiStartTime) / 1000);
    console.log("🟢 HEARTBEAT: AI API call completed", {
      timestamp: new Date().toISOString(),
      model: usedModel,
      duration: openaiDuration + "s",
      totalElapsed: Math.round((openaiEndTime - generationStartTime) / 1000) + "s",
      responseLength: jsonContent?.length || 0,
    });

    console.log(`📊 Regular mode used model: ${usedModel}`);

    // jsonContent is already set above from Gemini or OpenAI

    // Parse the JSON response with error handling
    let worksheetData;
    try {
      // HEARTBEAT LOG: Starting JSON parsing
      console.log("🔵 HEARTBEAT: Starting JSON parsing", {
        timestamp: new Date().toISOString(),
        contentLength: jsonContent?.length || 0,
      });

      if (!jsonContent) {
        throw new Error("No JSON content received from AI");
      }
      const recovery = await parseOrRegenerateWithFallback({
        rawContent: jsonContent,
        expectedExerciseCount: exerciseCount,
        systemMessage,
        sanitizedPrompt,
        allowRegenerateFallback: hasPictureMedia,
      });
      worksheetData = recovery.data;
      jsonContent = recovery.content;
      const repairMethod = recovery.repairMethod;
      if (recovery.modelOverride) usedModel = recovery.modelOverride;
      if (repairMethod !== 'none') {
        console.log(`🔧 [REGULAR] JSON was repaired using: ${repairMethod}`);
      }

      // HEARTBEAT LOG: JSON parsing completed
      console.log("🟢 HEARTBEAT: JSON parsing completed", {
        timestamp: new Date().toISOString(),
        exercisesCount: worksheetData.exercises?.length || 0,
      });

      if (!worksheetData.title || !worksheetData.exercises || !Array.isArray(worksheetData.exercises)) {
        throw new Error("Invalid worksheet structure returned from AI");
      }

      if (worksheetData.exercises.length !== exerciseCount && !isRegeneration) {
        throw new Error(`Generated ${worksheetData.exercises.length} exercises instead of required ${exerciseCount}`);
      }

      // Validate exercises
      for (let i = 0; i < worksheetData.exercises.length; i++) {
        const exercise = worksheetData.exercises[i];
        try {
          validateExercise(exercise);
        } catch (validationError) {
          // Continue with lenient mode
        }
      }

      // PROBLEM 6 FIX: Preserve AI description in exercise titles
      worksheetData.exercises.forEach((exercise: any, index: number) => {
        const exerciseNumber = index + 1;
        const officialName = getOfficialExerciseName(exercise.type);
        const aiTitle = exercise.title || '';
        const cleanAiTitle = aiTitle.replace(/^Exercise\s+\d+:\s*/i, '').trim();
        const escapedName = officialName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const aiDesc = cleanAiTitle.replace(new RegExp(`^${escapedName}\\s*[-:]?\\s*`, 'i'), '').trim();
        exercise.title = aiDesc 
          ? `Exercise ${exerciseNumber}: ${officialName}: ${aiDesc}` 
          : `Exercise ${exerciseNumber}: ${officialName}`;
      });

      const sourceCount = Math.floor(Math.random() * (90 - 65) + 65);
      worksheetData.sourceCount = sourceCount;
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError, "Response content:", jsonContent?.substring(0, 500));
      notifyGenerationFailure('parse', parseError instanceof Error ? parseError.message : String(parseError), {
        userId, teacherEmail, model: usedModel,
        promptPreview: sanitizedPrompt?.substring(0, 300),
      });
      return new Response(
        JSON.stringify({ error: "Failed to generate a valid worksheet structure. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Calculate generation time
    const generationEndTime = Date.now();
    const generationTimeSeconds = Math.round((generationEndTime - generationStartTime) / 1000);

    // Save worksheet to database - SKIP FOR REGENERATION
    if (!isRegeneration) {
      try {
        // ⏱️ TIMING: Starting database save
        const dbSaveStartTime = Date.now();
        console.log("🔵 HEARTBEAT: Starting database save", {
          timestamp: new Date().toISOString(),
          userId: userId || "anonymous",
          studentId: studentId || "none",
        });

        const fullPrompt = `SYSTEM MESSAGE:\n${systemMessage}\n\nUSER MESSAGE:\n${sanitizedPrompt}`;
        const sanitizedFormData = formData ? JSON.parse(JSON.stringify(formData)) : {};

        // 🧹 OPTIMIZATION 3A: Remove base64 data URLs before saving to database
        // This saves ~0.5-3MB per worksheet and drastically reduces egress costs
        const sanitizedImage = selectedImage
          ? {
              ...selectedImage,
              url: selectedImage.url?.startsWith("data:") ? null : selectedImage.url,
              ai_generated_url: selectedImage.ai_generated_url?.startsWith("data:")
                ? null
                : selectedImage.ai_generated_url,
              thumbnail: selectedImage.thumbnail?.startsWith("data:") ? null : selectedImage.thumbnail,
            }
          : null;

        const sanitizedAudio = selectedAudio
          ? {
              ...selectedAudio,
              url: selectedAudio.url?.startsWith("data:") ? null : selectedAudio.url,
              ai_generated_audio_url: selectedAudio.ai_generated_audio_url?.startsWith("data:")
                ? null
                : selectedAudio.ai_generated_audio_url,
            }
          : null;

        // 📊 MONITORING: Log ai_response length for truncation tracking
        const aiResponseLength = jsonContent?.length || 0;
        const aiResponseLimit = 200000;
        const wasTruncated = aiResponseLength > aiResponseLimit;
        console.log(`📊 [MONITORING] ai_response length: ${aiResponseLength} chars, limit: ${aiResponseLimit}, truncated: ${wasTruncated}`);
        if (wasTruncated) {
          console.warn(`⚠️ [MONITORING] Worksheet ai_response TRUNCATED from ${aiResponseLength} to ${aiResponseLimit} chars`);
        }

        // Auto-generate share token at creation time (permanent, no expiration)
        const shareToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

        const { data: worksheet, error: worksheetError } = await supabase
          .from("worksheets")
          .insert({
            prompt: fullPrompt,
            form_data: sanitizedFormData,
            ai_response: jsonContent?.substring(0, aiResponseLimit) || "",
            html_content: JSON.stringify(worksheetData),
            user_id: userId || null,
            teacher_id: userId || null,
            teacher_email: teacherEmail,
            student_id: studentId || null,
            selected_image: sanitizedImage,
            selected_audio: sanitizedAudio,
            audio_url: selectedAudio?.ai_generated_audio_url || selectedAudio?.url || null,
            audio_transcript: selectedAudio?.transcript || null,
            audio_duration: selectedAudio?.duration || null,
            audio_voice: selectedAudio?.voice || null,
            ip_address: ip,
            status: "created",
            title: worksheetData.title?.substring(0, 255) || "Generated Worksheet",
            generation_time_seconds: generationTimeSeconds,
            country: geoData.country || null,
            city: geoData.city || null,
            share_token: shareToken,
          })
          .select("id, created_at, title, share_token");

        if (worksheetError) {
          console.error("Error saving worksheet to database:", worksheetError);
          notifyGenerationFailure('database', worksheetError.message, { userId, teacherEmail });
        }

        if (worksheet && worksheet.length > 0 && worksheet[0].id) {
          const worksheetId = worksheet[0].id;
          worksheetData.id = worksheetId;
          worksheetData.share_token = worksheet[0].share_token;

          // ⏱️ TIMING: Database save completed
          const dbSaveDuration = Date.now() - dbSaveStartTime;
          console.log(`⏱️ [TIMING] Database save: ${dbSaveDuration}ms`);

          // HEARTBEAT LOG: Database save completed
          console.log("🟢 HEARTBEAT: Database save completed", {
            timestamp: new Date().toISOString(),
            worksheetId,
            generationTimeSeconds: generationTimeSeconds + "s",
            location: `${geoData.country || "unknown"} ${geoData.city || "unknown"}`,
            teacher: teacherEmail || "anonymous",
          });

          console.log("Worksheet ID:", worksheetId);
          console.log("Generation time:", generationTimeSeconds, "seconds");
          console.log("Location:", geoData.country || "unknown", geoData.city || "unknown");
          console.log("Teacher:", teacherEmail || "anonymous");
          console.log("IP:", ip);
        }
      } catch (dbError) {
        console.error("Database error:", dbError);
      }
    }

    // ETAP 4: Add selected_image to response if it exists (so frontend receives it)
    if (selectedImage) {
      worksheetData.selected_image = selectedImage;
      console.log("📸 [RESPONSE] Returning selected_image in response:", {
        hasUrl: !!selectedImage.url,
        source: selectedImage.source,
        urlType: selectedImage.url?.startsWith("data:") ? "base64" : "external",
        urlPreview: selectedImage.url?.substring(0, 80) + "...",
      });
    }

    // ETAP 5: Add audio fields to response
    if (selectedAudio) {
      worksheetData.audio_url = selectedAudio.ai_generated_audio_url || selectedAudio.url || null;
      worksheetData.audio_transcript = selectedAudio.transcript || null;
      worksheetData.audio_duration = selectedAudio.duration || null;
      worksheetData.audio_voice = selectedAudio.voice || null;
      worksheetData.selected_audio = selectedAudio;

      console.log("🎵 [RESPONSE] Returning audio fields in response:", {
        hasAudioUrl: !!worksheetData.audio_url,
        hasTranscript: !!worksheetData.audio_transcript,
        transcriptLength: worksheetData.audio_transcript?.length || 0,
        duration: worksheetData.audio_duration,
        voice: worksheetData.audio_voice,
      });
    }

    // ⏱️ TIMING SUMMARY: Complete breakdown of all operations
    const totalDuration = Date.now() - generationStartTime;
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                      ⏱️  TIMING SUMMARY - WORKSHEET GENERATION              ║
╚════════════════════════════════════════════════════════════════════════════╝
  📊 Total Generation Time: ${(totalDuration / 1000).toFixed(2)}s (${totalDuration}ms)
  
  🔹 Phase Breakdown:
     • Geolocation:        ${geoDuration}ms
     • Media Generation:   ${selectedImage || selectedAudio ? "Pre-generated on frontend" : "Skipped (no media required)"}
     • OpenAI API Call:    ${openaiDuration}s
     • JSON Parsing:       Fast (< 100ms)
     • Database Save:      ${!isRegeneration ? "See DB logs above" : "Skipped (regeneration)"}
  
  🎯 Configuration:
     • Model Used:         ${usedModel}
     • Primary Model:      gemini-2.5-flash
     • Fallback Model:     ${OPENAI_FALLBACK_MODEL}
     • Exercise Count:     ${exerciseCount}
     • Has Picture:        ${!!selectedImage}
     • Has Audio:          ${!!selectedAudio}
     • Regeneration Mode:  ${!!isRegeneration}
  
  📍 Context:
     • Location:           ${geoData.country || "unknown"} / ${geoData.city || "unknown"}
     • IP:                 ${ip}
     • Teacher:            ${teacherEmail || "anonymous"}
╚════════════════════════════════════════════════════════════════════════════╝
    `);

    // HEARTBEAT LOG: Returning successful response
    console.log("🟢 HEARTBEAT: Returning successful response to client", {
      timestamp: new Date().toISOString(),
      totalDuration: Math.round((Date.now() - generationStartTime) / 1000) + "s",
      hasSelectedImage: !!selectedImage,
      hasAudio: !!selectedAudio,
    });

    return new Response(JSON.stringify(worksheetData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ CRITICAL ERROR in generateWorksheet:", error);
    const mainErrorType = classifyErrorType(error);
    notifyGenerationFailure(mainErrorType, error instanceof Error ? error.message : String(error), {
      userId: 'unknown',
    });

    // ENHANCED LOGGING: Log detailed error information
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    // Log OpenAI specific errors
    if ((error as any)?.response) {
      console.error("OpenAI API Error Response:", {
        status: (error as any).response?.status,
        statusText: (error as any).response?.statusText,
        data: (error as any).response?.data,
      });
    }

    // Log rate limit errors
    if ((error as any)?.status === 429) {
      console.error("⚠️ RATE LIMIT ERROR: OpenAI API rate limit exceeded");
    }

    // Log timeout errors
    if (error instanceof Error && (error.message.includes("timeout") || error.message.includes("ETIMEDOUT"))) {
      console.error("⏱️ TIMEOUT ERROR: Request to OpenAI timed out");
    }

    // Sanitize error message for client
    const sanitizedError =
      typeof error === "object" && error !== null
        ? "An internal error occurred. Please try again."
        : String(error).substring(0, 200);

    // Log the sanitized error being returned to client
    console.error("Returning error to client:", sanitizedError);

    return new Response(
      JSON.stringify({
        error: sanitizedError,
      }),
      {
        status: (error as any)?.status || 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
