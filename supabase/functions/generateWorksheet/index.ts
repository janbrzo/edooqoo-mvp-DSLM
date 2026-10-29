import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "./clients.ts";
import { classifyErrorType, notifyGenerationFailure } from "./notify.ts";
import { planWorksheet, resolveRequest } from "./composeRequest.ts";
import { runBatchMode } from "./batchMode.ts";
import { runStreamingMode } from "./streamingMode.ts";
import { runRegularMode } from "./regularMode.ts";

// One entry point, one pipeline (see pipeline.ts): the request is resolved and
// planned here, then handed to the batch, streaming or regular mode, which
// supply the stages of the shared pipeline.
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Start generation time measurement
  const generationStartTime = Date.now();

  try {
    const resolved = await resolveRequest(req, generationStartTime);
    if ("response" in resolved) return resolved.response;
    const { request } = resolved;

    // Batch mode: several exercise types in ONE request
    if (request.isBatchGeneration && request.formData?.targetExerciseTypes && Array.isArray(request.formData.targetExerciseTypes)) {
      return await runBatchMode(request);
    }

    const plan = planWorksheet(request);

    if (request.useStreaming) {
      return runStreamingMode(request, plan);
    }

    return await runRegularMode(request, plan);
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
