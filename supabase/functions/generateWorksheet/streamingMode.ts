// Streaming mode: the full worksheet is generated in the background while an
// SSE stream reports progress; the worksheet is always saved, even when the
// client disconnects.
import { corsHeaders, OPENAI_FALLBACK_MODEL } from "./clients.ts";
import { classifyErrorType, notifyGenerationFailure, waitUntilIfAvailable, waitUntilOrAwait } from "./notify.ts";
import { parseOrRegenerateWithFallback, parseWithRecovery } from "./parse.ts";
import { generateWithGeminiStream, generateWithOpenAIStream, shouldFallBack } from "./model.ts";
import { deadlineFrom } from "./engineBudgets.ts";
import { newModelRunInfo } from "./providerErrors.ts";
import { checkWorksheetStructure, logAiRepairEarlyWarning, observeWorksheetQuality } from "./gate.ts";
import { normaliseWorksheet } from "./normalise.ts";
import { insertWorksheetRow } from "./persist.ts";
import { runPipeline } from "./pipeline.ts";
import {
  createSSEStream,
  countExercisesInPartialJSON,
  getExpectedExerciseCount as getExpectedCount,
} from "./streaming.ts";
import type { GenerationRequest, WorksheetPlan } from "./composeRequest.ts";

type Salvaged = { data: any; content: string; repairMethod: string; repairDetail: string; modelOverride?: string };

export function runStreamingMode(request: GenerationRequest, plan: WorksheetPlan): Response {
  const { formData, isRegeneration, userId, teacherEmail, sanitizedPrompt, generationStartTime } = request;
  const { hasPictureMedia, systemMessage } = plan;

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
    let salvaged: Salvaged | null = null;
    // Telemetry only: what parse reported, read again by the gate observation.
    let observedRepairMethod = "none";
    let observedRepairDetail = "none";
    const modelInfo = newModelRunInfo();
    const modelOptions = { generationStartTime, info: modelInfo };
    const deadlineAt = deadlineFrom(generationStartTime);

    try {
      safeSend("start", { message: "Starting generation..." });

      await runPipeline<void, any, any, void>({
        async callModel() {
          let geminiFailed = false;
          let geminiFailure: unknown = null;

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
              30000,
              modelOptions,
            );

            fullContent = geminiResult.content;
            console.log(`✅ Gemini streaming completed`);
          } catch (geminiError) {
            geminiFailed = true;
            geminiFailure = geminiError;
            // v6.9.96 — Gemini can throw "Failed to parse stream" AFTER every
            // exercise already arrived (callback buffered it in `fullContent`).
            // Try to salvage that content before paying for a slow OpenAI
            // regeneration.
            if (lastExerciseCount >= expectedTotal && fullContent.trim()) {
              try {
                const rescued = await parseWithRecovery(fullContent, expectedTotal, { deadlineAt });
                if (Array.isArray(rescued.data?.exercises) && rescued.data.exercises.length >= expectedTotal) {
                  console.warn(
                    "🛟 Gemini stream errored after full content — salvaged without fallback:",
                    (geminiError as Error).message,
                  );
                  salvaged = {
                    data: rescued.data,
                    content: fullContent,
                    repairMethod: rescued.repairMethod === 'none' ? 'stream-salvage' : `stream-salvage+${rescued.repairMethod}`,
                    repairDetail: rescued.repairDetail === 'none' ? 'stream-salvage' : `stream-salvage+${rescued.repairDetail}`,
                  };
                }
              } catch (salvageError) {
                console.warn("⚠️ Stream salvage failed, using OpenAI fallback:", (salvageError as Error).message);
              }
            }
          }
          if (geminiFailed && !salvaged && !shouldFallBack(geminiFailure, modelOptions)) {
            throw geminiFailure;
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

            await generateWithOpenAIStream(systemMessage, sanitizedPrompt, (delta) => {
              fullContent += delta;
              const newCount = countExercisesInPartialJSON(fullContent);
              if (newCount > lastExerciseCount && newCount > fallbackProgressFloor) {
                lastExerciseCount = newCount;
                safeSend("progress", { exercisesGenerated: newCount, expectedTotal });
              }
            }, modelOptions);
            console.log(`✅ OpenAI fallback streaming completed`);
          }

          console.log(`📊 Streaming used model: ${streamUsedModel}`);
          console.log("✅ Streaming completed, parsing final JSON...");
        },

        // Parse final JSON with full recovery pipeline.
        // AI-REPAIR can take 10-30s of silent Gemini work → emit keepalive
        // progress events every 15s so the client heartbeat (40s) does not trip.
        // v6.9.64 — also emit smooth `percent` so the mini-panel/main modal
        // progress bar continues moving during repair instead of snapping.
        async parse() {
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
          let repairDetail: string;
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
              deadlineAt,
            });
            worksheetData = result.data;
            fullContent = result.content;
            repairMethod = result.repairMethod;
            repairDetail = result.repairDetail;
            if (result.modelOverride) streamUsedModel = result.modelOverride;
          } finally {
            clearInterval(repairKeepalive);
          }
          observedRepairMethod = repairMethod;
          observedRepairDetail = repairDetail;
          logAiRepairEarlyWarning("streaming", repairMethod, repairDetail);
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
              waitUntilIfAvailable(earlyWarnPromise);
            }
          }
          return worksheetData;
        },

        gate(worksheetData) {
          checkWorksheetStructure(worksheetData);
          observeWorksheetQuality({
            mode: "streaming",
            worksheet: worksheetData,
            expectedCount: expectedTotal,
            formData,
            hasMedia: !!plan.selectedImage || !!plan.selectedAudio,
            checkCountAndOrder: !isRegeneration,
            model: streamUsedModel,
            repairMethod: observedRepairMethod,
            repairDetail: observedRepairDetail,
            generationStartTime,
            modelInfo,
          });
        },

        normalise: normaliseWorksheet,

        // The outer handler below reports every failure of the stream.
        onProcessingError(error) {
          throw error;
        },

        // Save to database
        async persist(worksheetData) {
          // Calculate generation time
          const generationTimeSeconds = Math.round((Date.now() - generationStartTime) / 1000);

          safeSend("progress", { exercisesGenerated: expectedTotal, expectedTotal, phase: "saving", percent: 99 });
          console.log("💾 Saving worksheet to database...");

          const { data: worksheet, error: worksheetError } = await insertWorksheetRow(
            request, plan, worksheetData, fullContent, generationTimeSeconds,
          );

          if (worksheetError) {
            throw new Error(`Database save failed: ${worksheetError.message}`);
          }

          const worksheetId = worksheet?.[0]?.id;
          if (!worksheetId) {
            throw new Error("No worksheet ID returned from database");
          }

          worksheetData.id = worksheetId;
          worksheetData.share_token = worksheet?.[0]?.share_token;
          return worksheetId;
        },

        respond(worksheetData, worksheetId) {
          console.log("✅ Streaming generation complete, sending done event");
          safeSend("done", {
            worksheetId,
            worksheet: worksheetData,
          });
        },
      });
    } catch (error) {
      const errorContext: Record<string, any> = { userId, model: streamUsedModel };
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
      await waitUntilOrAwait(notifyPromise);
      safeSend("error", { message: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      safeClose();
    }
  })();

  // Keep the worker alive even after the client disconnects so the DB
  // insert at the end of the pipeline always completes.
  waitUntilIfAvailable(backgroundWork);

  return responsePromise;
}
