// Batch mode (add exercise): several exercise types in ONE model request, the
// exercises are returned to the caller and nothing is saved here.
import { corsHeaders } from "./clients.ts";
import { classifyErrorType, notifyGenerationFailure } from "./notify.ts";
import { parseWithRecovery } from "./parse.ts";
import { generateNonStreaming } from "./model.ts";
import { checkBatchStructure, logAiRepairEarlyWarning, observeWorksheetQuality } from "./gate.ts";
import { runPipeline } from "./pipeline.ts";
import { deadlineFrom } from "./engineBudgets.ts";
import { newModelRunInfo } from "./providerErrors.ts";
import { planBatch, type GenerationRequest } from "./composeRequest.ts";

export async function runBatchMode(request: GenerationRequest): Promise<Response> {
  const { sanitizedPrompt, userId, teacherEmail, formData, generationStartTime } = request;
  const plan = planBatch(request);

  let usedModel = "";
  let batchGenerationTime = "";
  // Telemetry only: what parse reported, read again by the gate observation.
  let observedRepairMethod = "none";
  let observedRepairDetail = "none";
  const modelInfo = newModelRunInfo();
  const deadlineAt = deadlineFrom(generationStartTime);

  return runPipeline<string, any, void, Response>({
    // Try Gemini first, fallback to OpenAI
    async callModel() {
      const modelResult = await generateNonStreaming(plan.systemMessage, sanitizedPrompt, {
        trying: "🔵 [BATCH-MODE] Trying Gemini 2.5 Flash as primary model...",
        geminiSucceeded: `✅ [BATCH-MODE] Gemini 2.5 Flash succeeded`,
        geminiFailed: "⚠️ [BATCH-MODE] Gemini failed, falling back to OpenAI fallback model:",
        openaiSucceeded: `✅ [BATCH-MODE] OpenAI fallback succeeded`,
      }, { generationStartTime, info: modelInfo });
      const batchContent: string = modelResult.content || "";
      usedModel = modelResult.model;

      batchGenerationTime = ((Date.now() - plan.batchStartTime) / 1000).toFixed(2);
      console.log(`📊 [BATCH-MODE] Used model: ${usedModel}`);
      console.log(`⏱️ [BATCH-MODE] AI responded in ${batchGenerationTime}s`);

      if (!batchContent) {
        throw new Error("No content received from AI in batch mode");
      }
      return batchContent;
    },

    async parse(batchContent) {
      const { data: batchData, repairMethod, repairDetail } = await parseWithRecovery(batchContent, plan.totalExerciseCount, { deadlineAt });
      observedRepairMethod = repairMethod;
      observedRepairDetail = repairDetail;
      logAiRepairEarlyWarning("batch", repairMethod, repairDetail);
      if (repairMethod !== 'none') console.log(`🔧 [BATCH] JSON repaired using: ${repairMethod}`);
      return batchData;
    },

    gate(batchData) {
      checkBatchStructure(batchData);
      // The batch asks for `exerciseCountPerType` exercises of each target type.
      // Observation must never affect the batch, so odd input just skips the type check.
      let requestedTypes: string[] | null = null;
      try {
        const perType = Number(formData.exerciseCountPerType) || 1;
        requestedTypes = (formData.targetExerciseTypes as string[]).flatMap((t) => Array(perType).fill(String(t)));
      } catch (_) { /* leave the type check out */ }
      observeWorksheetQuality({
        mode: "batch",
        worksheet: batchData,
        expectedCount: plan.totalExerciseCount,
        formData,
        hasMedia: false,
        checkCountAndOrder: true,
        // the model may interleave the requested types, so only set and count are reliable
        checkOrder: false,
        requestedTypes,
        model: usedModel,
        repairMethod: observedRepairMethod,
        repairDetail: observedRepairDetail,
        generationStartTime,
        modelInfo,
      });
    },

    // Batch exercises are returned exactly as the model produced them.
    normalise() {},

    onProcessingError(error) {
      console.error(`❌ [BATCH-MODE] Failed to parse batch response:`, error);
      const errType = classifyErrorType(error);
      notifyGenerationFailure(errType, error instanceof Error ? error.message : String(error), {
        userId, teacherEmail, model: usedModel, mode: 'batch',
      });
      throw error;
    },

    async persist() {},

    respond(batchData) {
      console.log(`✅ [BATCH-MODE] Generated ${batchData.exercises.length} exercises in ONE request (${usedModel})`);
      console.log(`⏱️  [BATCH-MODE] Total batch generation time: ${batchGenerationTime} seconds`);

      // Return batch exercises directly WITH FULL PROMPT for storage in homework_assignments.prompt
      return new Response(
        JSON.stringify({
          exercises: batchData.exercises,
          fullPrompt: plan.systemMessage, // ✅ Return complete system message for homework_assignments.prompt
          success: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    },
  });
}
