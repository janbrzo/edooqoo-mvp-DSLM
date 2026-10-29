import { parseAIResponseDetailed, extractJSONString, detectCurlyQuotes, joinRepairDetail } from "./helpers.ts";
import { openai, OPENAI_FALLBACK_MODEL } from "./clients.ts";
import { ENGINE_BUDGETS, callBudgetMs, withCallTimeout } from "./engineBudgets.ts";

/** Optional request deadline (absolute ms): AI calls are clipped to the time left, or skipped. */
export interface ParseBudget {
  deadlineAt?: number;
}

// ============================================================
// v6.9.64 — Parse-safe model fallback for picture worksheets.
// When the streamed Gemini JSON cannot be parsed even after the
// deterministic + AI repair passes, regenerate the worksheet JSON
// once via the OpenAI fallback model in strict JSON-object mode. This protects the
// large picture-worksheet payload without altering the protected
// worksheet generation prompt.
// ============================================================
export async function generateFallbackJsonWithOpenAI(
  systemMessage: string,
  userMessage: string,
  budget: ParseBudget = {},
): Promise<{ content: string; model: string }> {
  console.log(`🟠 [JSON-FALLBACK] Regenerating worksheet JSON with ${OPENAI_FALLBACK_MODEL} after malformed Gemini JSON`);
  const ms = callBudgetMs(Number.POSITIVE_INFINITY, budget.deadlineAt, Date.now());
  if (ms < ENGINE_BUDGETS.aiRepairMinMs) throw new Error('JSON fallback skipped: request time budget used up (timeout)');
  const response = await withCallTimeout(ms, (signal) => (openai.chat.completions.create as any)({
    model: OPENAI_FALLBACK_MODEL,
    temperature: 1,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ],
    max_completion_tokens: 30000,
    response_format: { type: 'json_object' },
  }, { signal, maxRetries: 0 }));
  return {
    content: response.choices?.[0]?.message?.content || '',
    model: `${OPENAI_FALLBACK_MODEL}-json-fallback`,
  };
}

export async function parseOrRegenerateWithFallback(params: {
  rawContent: string;
  expectedExerciseCount: number;
  systemMessage: string;
  sanitizedPrompt: string;
  allowRegenerateFallback: boolean;
  deadlineAt?: number;
}): Promise<{ data: any; content: string; repairMethod: string; repairDetail: string; modelOverride?: string }> {
  try {
    const parsed = await parseWithRecovery(params.rawContent, params.expectedExerciseCount, { deadlineAt: params.deadlineAt });
    return {
      data: parsed.data,
      content: params.rawContent,
      repairMethod: parsed.repairMethod,
      repairDetail: parsed.repairDetail,
    };
  } catch (firstError) {
    if (!params.allowRegenerateFallback) throw firstError;
    console.warn('⚠️ [JSON-FALLBACK] Parse/repair failed; trying full JSON regeneration fallback');
    const fallback = await generateFallbackJsonWithOpenAI(params.systemMessage, params.sanitizedPrompt, { deadlineAt: params.deadlineAt });
    const parsed = await parseWithRecovery(fallback.content, params.expectedExerciseCount, { deadlineAt: params.deadlineAt });
    return {
      data: parsed.data,
      content: fallback.content,
      repairMethod: parsed.repairMethod === 'none' ? 'model-fallback' : `model-fallback+${parsed.repairMethod}`,
      repairDetail: parsed.repairDetail === 'none' ? 'model-fallback' : `model-fallback+${parsed.repairDetail}`,
      modelOverride: fallback.model,
    };
  }
}

// ============================================================
// AI JSON REPAIR PASS
// Secondary recovery: uses a deterministic model to fix malformed JSON
// Does NOT re-generate content — only repairs structural JSON issues
// ============================================================
async function repairWorksheetJsonWithAI(brokenJson: string, expectedExerciseCount: number, budget: ParseBudget = {}): Promise<string> {
  console.log('🔧 [AI-REPAIR] Starting AI JSON repair pass...');
  console.log(`🔧 [AI-REPAIR] Input length: ${brokenJson.length}, expected exercises: ${expectedExerciseCount}`);

  const repairPrompt = `You are a JSON repair tool. Your ONLY job is to fix the broken JSON below so it becomes valid JSON.

RULES:
- Output ONLY valid JSON. No explanation, no markdown, no code fences.
- Preserve ALL content exactly as-is. Do not invent, remove, or modify any text/data.
- Preserve the exact number of exercises (should be ${expectedExerciseCount}).
- Preserve all exercise types, titles, content, questions, answers, vocabulary.
- Fix structural issues: missing colons, missing commas, unbalanced brackets, truncated strings.
- If a string value is clearly truncated mid-sentence, close it with a quote and continue the structure.

BROKEN JSON:
${brokenJson}`;

  try {
    const ms = callBudgetMs(ENGINE_BUDGETS.aiRepairDocumentMs, budget.deadlineAt, Date.now());
    if (ms < ENGINE_BUDGETS.aiRepairMinMs) throw new Error('AI repair skipped: request time budget used up (timeout)');
    const repairResponse = await withCallTimeout(ms, (signal) => (openai.chat.completions.create as any)({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a JSON repair tool. Output ONLY valid JSON. No markdown. No explanation." },
        { role: "user", content: repairPrompt },
      ],
      max_completion_tokens: 16000,
      response_format: { type: "json_object" },
    }, { signal, maxRetries: 0 }));

    const repairedContent = repairResponse.choices[0]?.message?.content || "";
    console.log(`🔧 [AI-REPAIR] Repair response length: ${repairedContent.length}`);
    return repairedContent;
  } catch (repairError) {
    console.error('❌ [AI-REPAIR] AI repair call failed:', (repairError as Error).message);
    throw repairError;
  }
}

/**
 * Attempts to parse JSON with full recovery pipeline:
 * 1. parseAIResponse (extract + deterministic repair)
 * 2. AI repair pass if #1 fails
 */
/**
 * v6.9.84 — Repairs only the broken window around the reported syntax error
 * instead of shipping the whole (often 60KB+) document to the repair model.
 * Keeps the repair call in the ~2-4s range so the client SSE socket survives.
 */
async function repairJsonWindowWithAI(
  brokenJson: string,
  errorPosition: number,
  radius = 3000,
  budget: ParseBudget = {},
): Promise<string | null> {
  if (!Number.isFinite(errorPosition) || errorPosition < 0) return null;
  const start = Math.max(0, errorPosition - radius);
  const end = Math.min(brokenJson.length, errorPosition + radius);
  const windowText = brokenJson.slice(start, end);
  console.log(`🔧 [AI-REPAIR-WINDOW] pos=${errorPosition} window=[${start}, ${end}) len=${windowText.length}`);

  try {
    const ms = callBudgetMs(ENGINE_BUDGETS.aiRepairWindowMs, budget.deadlineAt, Date.now());
    if (ms < ENGINE_BUDGETS.aiRepairMinMs) return null;
    const res = await withCallTimeout(ms, (signal) => (openai.chat.completions.create as any)({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You repair JSON fragments. You receive a FRAGMENT cut out of a larger JSON document. " +
            "Fix only syntax errors (unescaped quotes, missing commas/colons). " +
            "Do NOT add or remove content. Do NOT close unopened brackets. " +
            "Return ONLY the corrected fragment as raw text, no markdown, no explanation.",
        },
        { role: "user", content: windowText },
      ],
      max_completion_tokens: 8000,
    }, { signal, maxRetries: 0 }));
    const fixed = (res.choices[0]?.message?.content || "").replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '');
    if (!fixed) return null;
    console.log(`🔧 [AI-REPAIR-WINDOW] fragment repaired (${windowText.length} → ${fixed.length})`);
    return brokenJson.slice(0, start) + fixed + brokenJson.slice(end);
  } catch (e) {
    console.error('❌ [AI-REPAIR-WINDOW] failed:', (e as Error).message);
    return null;
  }
}

/**
 * Parses with the full recovery pipeline. `repairMethod` keeps its historical
 * values ('none' for every local repair, 'ai-window' or 'ai' for an AI repair);
 * `repairDetail` names each step that was applied, local ones included.
 */
export async function parseWithRecovery(
  rawContent: string,
  expectedExerciseCount: number,
  budget: ParseBudget = {},
): Promise<{ data: any; repairMethod: string; repairDetail: string }> {
  // Attempt 1: Local parsing (extract + deterministic repair)
  let curly: string[] = [];
  try {
    const { data, step, curly: applied } = parseAIResponseDetailed(rawContent);
    return { data, repairMethod: 'none', repairDetail: joinRepairDetail([...applied, step]) };
  } catch (localError) {
    // A failed local parse always went through the curly-quote rewrite.
    curly = detectCurlyQuotes(rawContent);
    console.warn('⚠️ Local parse failed, attempting AI repair pass...');

    // Attempt 2: AI repair pass
    const rawForRepair = (localError as any).rawContent || extractJSONString(rawContent);

    // Attempt 2a: cheap, fast windowed repair around the reported position.
    const errorPosition = (localError as any).errorPosition ?? -1;
    const windowed = await repairJsonWindowWithAI(rawForRepair, errorPosition, 3000, budget);
    if (windowed) {
      try {
        const { data, step } = parseAIResponseDetailed(windowed);
        console.log('✅ json_repair_ai_window_succeeded');
        return { data, repairMethod: 'ai-window', repairDetail: joinRepairDetail([...curly, 'ai-window', step]) };
      } catch (windowErr) {
        console.warn('⚠️ json_repair_ai_window_failed:', (windowErr as Error).message);
      }
    }

    try {
      const repairedJson = await repairWorksheetJsonWithAI(rawForRepair, expectedExerciseCount, budget);
      const { data, step } = parseAIResponseDetailed(repairedJson);
      console.log('✅ json_repair_ai_succeeded');
      return { data, repairMethod: 'ai', repairDetail: joinRepairDetail([...curly, 'ai', step]) };
    } catch (aiRepairError) {
      console.error('❌ json_repair_ai_failed:', (aiRepairError as Error).message);
      throw new Error(`Invalid JSON from AI: all repair attempts failed. Original: ${(localError as Error).message}`);
    }
  }
}
