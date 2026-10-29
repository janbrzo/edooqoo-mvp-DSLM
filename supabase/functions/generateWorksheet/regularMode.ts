// Regular (non-streaming) mode: one JSON response. Used for single exercise
// regeneration (`isRegeneration`) and by clients that do not ask for streaming.
import { corsHeaders, OPENAI_FALLBACK_MODEL } from "./clients.ts";
import { notifyGenerationFailure } from "./notify.ts";
import { parseOrRegenerateWithFallback } from "./parse.ts";
import { generateNonStreaming } from "./model.ts";
import { checkExerciseCount, checkWorksheetStructure, logAiRepairEarlyWarning, observeWorksheetQuality } from "./gate.ts";
import { normaliseWorksheet } from "./normalise.ts";
import { insertWorksheetRow } from "./persist.ts";
import { runPipeline } from "./pipeline.ts";
import type { GenerationRequest, WorksheetPlan } from "./composeRequest.ts";

export async function runRegularMode(request: GenerationRequest, plan: WorksheetPlan): Promise<Response> {
  const {
    formData, isRegeneration, userId, studentId, teacherEmail, ip, geoData, geoDuration, sanitizedPrompt, generationStartTime,
  } = request;
  const { exerciseCount, selectedImage, selectedAudio, hasPictureMedia, systemMessage, openaiStartTime } = plan;

  console.log("📄 Using REGULAR (non-streaming) mode");

  // Track which model was used for logging
  let usedModel = "unknown";
  let jsonContent: string | null = null;
  let openaiDuration = 0;
  let generationTimeSeconds = 0;
  // Telemetry only: what parse reported, read again by the gate observation.
  let observedRepairMethod = "none";
  let observedRepairDetail = "none";

  return runPipeline<string | null, any, void, Response>({
    // Generate worksheet - Try Gemini first, fallback to OpenAI
    async callModel() {
      const regularModelResult = await generateNonStreaming(systemMessage, sanitizedPrompt, {
        trying: "🔵 Trying Gemini 2.5 Flash for regular generation...",
        geminiSucceeded: `✅ Gemini 2.5 Flash succeeded`,
        geminiFailed: "⚠️ Gemini failed, falling back to OpenAI fallback model:",
        openaiSucceeded: `✅ OpenAI fallback succeeded`,
      });
      jsonContent = regularModelResult.content;
      usedModel = regularModelResult.model;

      // HEARTBEAT LOG: After AI API call
      const openaiEndTime = Date.now();
      openaiDuration = Math.round((openaiEndTime - openaiStartTime) / 1000);
      console.log("🟢 HEARTBEAT: AI API call completed", {
        timestamp: new Date().toISOString(),
        model: usedModel,
        duration: openaiDuration + "s",
        totalElapsed: Math.round((openaiEndTime - generationStartTime) / 1000) + "s",
        responseLength: jsonContent?.length || 0,
      });

      console.log(`📊 Regular mode used model: ${usedModel}`);

      // jsonContent is already set above from Gemini or OpenAI
      return jsonContent;
    },

    // Parse the JSON response with error handling
    async parse() {
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
      const worksheetData = recovery.data;
      jsonContent = recovery.content;
      const repairMethod = recovery.repairMethod;
      observedRepairMethod = repairMethod;
      observedRepairDetail = recovery.repairDetail;
      if (recovery.modelOverride) usedModel = recovery.modelOverride;
      logAiRepairEarlyWarning("regular", repairMethod, recovery.repairDetail);
      if (repairMethod !== 'none') {
        console.log(`🔧 [REGULAR] JSON was repaired using: ${repairMethod}`);
      }

      // HEARTBEAT LOG: JSON parsing completed
      console.log("🟢 HEARTBEAT: JSON parsing completed", {
        timestamp: new Date().toISOString(),
        exercisesCount: worksheetData.exercises?.length || 0,
      });
      return worksheetData;
    },

    gate(worksheetData) {
      checkWorksheetStructure(worksheetData);
      observeWorksheetQuality({
        mode: "regular",
        worksheet: worksheetData,
        expectedCount: exerciseCount,
        formData,
        hasMedia: !!selectedImage || !!selectedAudio,
        checkCountAndOrder: !isRegeneration,
        model: usedModel,
        repairMethod: observedRepairMethod,
        repairDetail: observedRepairDetail,
        generationStartTime,
      });
      checkExerciseCount(worksheetData, exerciseCount, isRegeneration);
    },

    normalise: normaliseWorksheet,

    onProcessingError(parseError) {
      console.error("Failed to parse AI response as JSON:", parseError, "Response content:", jsonContent?.substring(0, 500));
      notifyGenerationFailure('parse', parseError instanceof Error ? parseError.message : String(parseError), {
        userId, teacherEmail, model: usedModel,
        promptPreview: sanitizedPrompt?.substring(0, 300),
      });
      return new Response(
        JSON.stringify({ error: "Failed to generate a valid worksheet structure. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    },

    // Save worksheet to database - SKIP FOR REGENERATION
    async persist(worksheetData) {
      // Calculate generation time
      const generationEndTime = Date.now();
      generationTimeSeconds = Math.round((generationEndTime - generationStartTime) / 1000);

      if (!isRegeneration) {
        try {
          // ⏱️ TIMING: Starting database save
          const dbSaveStartTime = Date.now();
          console.log("🔵 HEARTBEAT: Starting database save", {
            timestamp: new Date().toISOString(),
            userId: userId || "anonymous",
            studentId: studentId || "none",
          });

          const { data: worksheet, error: worksheetError } = await insertWorksheetRow(
            request, plan, worksheetData, jsonContent, generationTimeSeconds,
          );

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
    },

    respond(worksheetData) {
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
    },
  });
}
