/* eslint-disable @typescript-eslint/no-explicit-any */
import { genAI, openai, OPENAI_FALLBACK_MODEL } from "./clients.ts";
import {
  ENGINE_BUDGETS,
  FALLBACK_STREAM_LIMITS,
  ModelTimeoutError,
  PRIMARY_STREAM_LIMITS,
  callBudgetMs,
  canStartFallback,
  deadlineFrom,
  raceAbort,
  startStreamWatchdog,
  withCallTimeout,
} from "./engineBudgets.ts";
import {
  ModelTruncatedError,
  classifyProviderError,
  isTruncationReason,
  noteFinish,
  type ModelRunInfo,
} from "./providerErrors.ts";

/** Per-request context of a model call: the request clock and the run facts to log. */
export interface ModelCallOptions {
  generationStartTime?: number;
  info?: ModelRunInfo;
}

const deadlineOf = (options?: ModelCallOptions): number | undefined =>
  options?.generationStartTime === undefined ? undefined : deadlineFrom(options.generationStartTime);

function requireGemini() {
  if (!genAI) {
    // One clear line per request instead of a silent route to OpenAI.
    console.warn(JSON.stringify({ engine_config_warning: "gemini_api_key_missing", behaving_as: "openai_only" }));
    throw new Error("GEMINI_API_KEY not configured");
  }
  return genAI;
}

const GEMINI_MODEL = "gemini-2.5-flash";

// ============================================================
// GEMINI HELPER FUNCTIONS
// ============================================================

/**
 * Generate content using Gemini 2.5 Flash (primary model - faster)
 */
export async function generateWithGemini(
  systemMessage: string,
  userMessage: string,
  maxTokens: number = 30000,
  options?: ModelCallOptions,
): Promise<{ content: string; model: string; finishReason: string | null }> {
  const model = requireGemini().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 1,
      responseMimeType: "application/json", // FORCE valid JSON output
    },
  });

  // Gemini uses a single prompt, combine system + user message
  const fullPrompt = `${systemMessage}\n\n---\n\nUser Request:\n${userMessage}`;

  console.log("🔵 Gemini 2.5 Flash with JSON mode enabled...");
  const budget = callBudgetMs(ENGINE_BUDGETS.nonStreamingPrimaryMs, deadlineOf(options), Date.now());
  if (budget <= 0) throw new ModelTimeoutError("deadline", "no time left for the primary model");
  const result = await withCallTimeout(budget, (signal) => model.generateContent(fullPrompt, { signal }));
  const response = result.response;
  const text = response.text();
  const finishReason: string | null = response.candidates?.[0]?.finishReason ?? null;

  // Validate JSON before returning
  try {
    JSON.parse(text);
    console.log("✅ Gemini returned valid JSON");
  } catch (jsonError) {
    console.warn("⚠️ Gemini JSON validation failed, will attempt repair in parseAIResponse");
  }

  return { content: text, model: GEMINI_MODEL, finishReason };
}

/**
 * Generate content with streaming using Gemini 2.5 Flash. The call is aborted
 * only when it is silent, stalled or past the request deadline (see
 * engineBudgets.ts); a call that keeps delivering content is never cut off.
 * Throws ModelTruncatedError after delivering all chunks when the model hit
 * its output token limit.
 */
export async function generateWithGeminiStream(
  systemMessage: string,
  userMessage: string,
  onChunk: (text: string) => void,
  maxTokens: number = 30000,
  options?: ModelCallOptions,
): Promise<{ content: string; model: string; finishReason: string | null }> {
  const model = requireGemini().getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 1,
      responseMimeType: "application/json", // FORCE valid JSON output
    },
  });

  const fullPrompt = `${systemMessage}\n\n---\n\nUser Request:\n${userMessage}`;

  console.log("🔵 Gemini 2.5 Flash streaming with JSON mode enabled...");
  const deadlineAt = deadlineOf(options) ?? deadlineFrom(Date.now());
  const watchdog = startStreamWatchdog({ limits: PRIMARY_STREAM_LIMITS, deadlineAt });
  try {
    const result = await raceAbort(model.generateContentStream(fullPrompt, { signal: watchdog.signal }), watchdog.signal);
    // v6.9.96 — the SDK's aggregated `response` promise rejects with the same
    // "Failed to parse stream" error as `result.stream`. Nobody awaits it, so it
    // surfaced as an unhandled rejection ("event loop error") that killed the
    // worker before the DB insert. The stream loop below still throws and
    // triggers recovery/fallback; this only marks the rejection as observed.
    result.response.catch(() => {});

    let fullContent = "";
    let finishReason: string | null = null;
    const iterator = result.stream[Symbol.asyncIterator]();
    for (;;) {
      const step = await raceAbort(iterator.next(), watchdog.signal);
      if (step.done) break;
      watchdog.touch();
      const chunk = step.value;
      const chunkText = chunk.text();
      fullContent += chunkText;
      finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
      onChunk(chunkText);
    }

    noteFinish(options?.info, finishReason);
    if (isTruncationReason(finishReason)) {
      console.warn(JSON.stringify({ engine_model_warning: "truncated", model: GEMINI_MODEL, finish_reason: finishReason }));
      throw new ModelTruncatedError(String(finishReason), fullContent);
    }
    return { content: fullContent, model: GEMINI_MODEL, finishReason };
  } catch (error) {
    const reason = watchdog.reason();
    if (reason && !(error instanceof ModelTimeoutError)) throw new ModelTimeoutError(reason);
    throw error;
  } finally {
    watchdog.stop();
  }
}

/**
 * OpenAI fallback request shared by the batch and regular modes: plain chat
 * completion (no JSON mode), returns the raw message content.
 */
export async function generateWithOpenAIFallback(
  systemMessage: string,
  userMessage: string,
  options?: ModelCallOptions,
): Promise<string | null> {
  const budget = callBudgetMs(Number.POSITIVE_INFINITY, deadlineOf(options), Date.now());
  const response = await withCallTimeout(budget, (signal) =>
    (openai.chat.completions.create as any)({
      model: OPENAI_FALLBACK_MODEL,
      temperature: 1,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      max_completion_tokens: 30000,
    }, { signal, maxRetries: 0 })
  );
  noteFinish(options?.info, response.choices?.[0]?.finish_reason);
  return response.choices[0].message.content;
}

/**
 * OpenAI fallback with streaming (streaming mode). `onDelta` receives every
 * content delta. Aborted only when silent, stalled or past the request deadline.
 */
export async function generateWithOpenAIStream(
  systemMessage: string,
  userMessage: string,
  onDelta: (delta: string) => void,
  options?: ModelCallOptions,
): Promise<void> {
  const deadlineAt = deadlineOf(options) ?? deadlineFrom(Date.now());
  const watchdog = startStreamWatchdog({ limits: FALLBACK_STREAM_LIMITS, deadlineAt });
  try {
    const stream = await raceAbort(
      (openai.chat.completions.create as any)({
        model: OPENAI_FALLBACK_MODEL,
        temperature: 1,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        max_completion_tokens: 30000,
        stream: true,
      }, { signal: watchdog.signal, maxRetries: 0 }),
      watchdog.signal,
    );
    const iterator = (stream as any)[Symbol.asyncIterator]();
    let finishReason: string | null = null;
    for (;;) {
      const step = await raceAbort<IteratorResult<any>>(iterator.next(), watchdog.signal);
      if (step.done) break;
      watchdog.touch();
      const choice = step.value.choices[0];
      finishReason = choice?.finish_reason ?? finishReason;
      onDelta(choice?.delta?.content || "");
    }
    noteFinish(options?.info, finishReason);
  } catch (error) {
    const reason = watchdog.reason();
    if (reason && !(error instanceof ModelTimeoutError)) throw new ModelTimeoutError(reason);
    throw error;
  } finally {
    watchdog.stop();
  }
}

/**
 * Decides whether the fallback model may run after the primary failed: not for
 * errors caused by our own request, and only when enough of the request budget
 * is left. Records the failure kind and logs the decision when it says no.
 */
export function shouldFallBack(error: unknown, options?: ModelCallOptions): boolean {
  const cls = classifyProviderError(error);
  if (options?.info) options.info.primaryFailure = cls.kind;
  if (!cls.fallback) {
    console.warn(JSON.stringify({ engine_model_warning: "no_fallback_request_error", kind: cls.kind, status: cls.status }));
    return false;
  }
  const deadlineAt = deadlineOf(options);
  if (deadlineAt !== undefined && !canStartFallback(deadlineAt, Date.now())) {
    if (options?.info) options.info.fallbackSkipped = true;
    console.warn(JSON.stringify({ engine_model_warning: "fallback_skipped_no_time", kind: cls.kind }));
    return false;
  }
  return true;
}

export interface NonStreamingLabels {
  trying: string;
  geminiSucceeded: string;
  geminiFailed: string;
  openaiSucceeded: string;
}

/**
 * Non-streaming generation used by the batch and regular modes: Gemini first,
 * OpenAI fallback when Gemini fails with an error the fallback can help with
 * (see classifyProviderError) and time remains. A Gemini answer cut off by the
 * output limit tries the fallback too, and is kept for the salvage path when
 * the fallback cannot deliver. The log lines differ per mode, so the caller
 * passes them in.
 */
export async function generateNonStreaming(
  systemMessage: string,
  userMessage: string,
  labels: NonStreamingLabels,
  options?: ModelCallOptions,
): Promise<{ content: string | null; model: string }> {
  let truncated: { content: string; model: string } | null = null;
  try {
    console.log(labels.trying);
    const geminiResult = await generateWithGemini(systemMessage, userMessage, 30000, options);
    noteFinish(options?.info, geminiResult.finishReason);
    if (isTruncationReason(geminiResult.finishReason)) {
      truncated = { content: geminiResult.content, model: geminiResult.model };
      throw new ModelTruncatedError(String(geminiResult.finishReason), geminiResult.content);
    }
    console.log(labels.geminiSucceeded);
    return { content: geminiResult.content, model: geminiResult.model };
  } catch (geminiError) {
    console.warn(labels.geminiFailed, (geminiError as Error).message);
    if (!shouldFallBack(geminiError, options)) {
      if (truncated) return truncated;
      throw geminiError;
    }
    try {
      const content = await generateWithOpenAIFallback(systemMessage, userMessage, options);
      console.log(labels.openaiSucceeded);
      return { content, model: OPENAI_FALLBACK_MODEL };
    } catch (fallbackError) {
      if (truncated) return truncated;
      throw fallbackError;
    }
  }
}
