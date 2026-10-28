import { genAI, openai, OPENAI_FALLBACK_MODEL } from "./clients.ts";

// ============================================================
// GEMINI HELPER FUNCTIONS
// ============================================================

/**
 * Generate content using Gemini 2.5 Flash (primary model - faster)
 */
export async function generateWithGemini(
  systemMessage: string,
  userMessage: string,
  maxTokens: number = 30000
): Promise<{ content: string; model: string }> {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 1,
      responseMimeType: "application/json", // FORCE valid JSON output
    },
  });

  // Gemini uses a single prompt, combine system + user message
  const fullPrompt = `${systemMessage}\n\n---\n\nUser Request:\n${userMessage}`;

  console.log("🔵 Gemini 2.5 Flash with JSON mode enabled...");
  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  const text = response.text();

  // Validate JSON before returning
  try {
    JSON.parse(text);
    console.log("✅ Gemini returned valid JSON");
  } catch (jsonError) {
    console.warn("⚠️ Gemini JSON validation failed, will attempt repair in parseAIResponse");
  }

  return { content: text, model: "gemini-2.5-flash" };
}

/**
 * Generate content with streaming using Gemini 2.5 Flash
 */
export async function generateWithGeminiStream(
  systemMessage: string,
  userMessage: string,
  onChunk: (text: string) => void,
  maxTokens: number = 30000
): Promise<{ content: string; model: string }> {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 1,
      responseMimeType: "application/json", // FORCE valid JSON output
    },
  });

  const fullPrompt = `${systemMessage}\n\n---\n\nUser Request:\n${userMessage}`;

  console.log("🔵 Gemini 2.5 Flash streaming with JSON mode enabled...");
  const result = await model.generateContentStream(fullPrompt);
  // v6.9.96 — the SDK's aggregated `response` promise rejects with the same
  // "Failed to parse stream" error as `result.stream`. Nobody awaits it, so it
  // surfaced as an unhandled rejection ("event loop error") that killed the
  // worker before the DB insert. The stream loop below still throws and
  // triggers recovery/fallback; this only marks the rejection as observed.
  result.response.catch(() => {});

  let fullContent = "";
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullContent += chunkText;
    onChunk(chunkText);
  }

  return { content: fullContent, model: "gemini-2.5-flash" };
}

/**
 * OpenAI fallback request shared by the batch and regular modes: plain chat
 * completion (no JSON mode), returns the raw message content.
 */
export async function generateWithOpenAIFallback(
  systemMessage: string,
  userMessage: string,
): Promise<string | null> {
  const response = await (openai.chat.completions.create as any)({
    model: OPENAI_FALLBACK_MODEL,
    temperature: 1,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ],
    max_completion_tokens: 30000,
  });
  return response.choices[0].message.content;
}

export interface NonStreamingLabels {
  trying: string;
  geminiSucceeded: string;
  geminiFailed: string;
  openaiSucceeded: string;
}

/**
 * Non-streaming generation used by the batch and regular modes: Gemini first,
 * OpenAI fallback when Gemini throws. The log lines differ per mode, so the
 * caller passes them in.
 */
export async function generateNonStreaming(
  systemMessage: string,
  userMessage: string,
  labels: NonStreamingLabels,
): Promise<{ content: string | null; model: string }> {
  try {
    console.log(labels.trying);
    const geminiResult = await generateWithGemini(systemMessage, userMessage, 30000);
    console.log(labels.geminiSucceeded);
    return { content: geminiResult.content, model: geminiResult.model };
  } catch (geminiError) {
    console.warn(labels.geminiFailed, (geminiError as Error).message);
    const content = await generateWithOpenAIFallback(systemMessage, userMessage);
    console.log(labels.openaiSucceeded);
    return { content, model: OPENAI_FALLBACK_MODEL };
  }
}
