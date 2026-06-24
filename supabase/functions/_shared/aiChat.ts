// v6.9.66 — Shared chat-completion helper.
// Primary: Google Generative Language direct (GEMINI_API_KEY).
// Fallback: OpenAI Chat Completions (gpt-4o-mini by default).
// Lovable AI Gateway removed from hot path (workspace credits exhausted).
// Callers keep using OpenAI-style chat-completions bodies; this helper
// maps to Gemini generateContent and converts the response back to the
// OpenAI Chat Completions shape so existing parsing keeps working.
import { logModelFailure } from "./modelFailureLogger.ts";

const GOOGLE_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENAI_ENDPOINT      = "https://api.openai.com/v1/chat/completions";

// v6.9.67 — Gemini rejects many JSON-Schema keywords accepted by OpenAI tools.
// Strip them recursively before sending functionDeclarations.
const GEMINI_DISALLOWED_SCHEMA_KEYS = new Set([
  "additionalProperties","maxLength","minLength","minimum","maximum",
  "maxItems","minItems","exclusiveMinimum","exclusiveMaximum","pattern",
  "patternProperties","default","examples","$schema","$id","title",
  "const","contentEncoding","contentMediaType",
]);

function sanitizeForGemini(node: any): any {
  if (Array.isArray(node)) return node.map(sanitizeForGemini);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (GEMINI_DISALLOWED_SCHEMA_KEYS.has(k)) continue;
      out[k] = sanitizeForGemini(v);
    }
    return out;
  }
  return node;
}

export interface ChatCompletionOpts {
  /** Gemini model id, e.g. "gemini-2.5-flash". Legacy "google/<id>" is accepted. */
  primaryModel: string;
  /** OpenAI fallback model id, defaults to "gpt-4o-mini". */
  fallbackModel?: string;
  /** Caller function name for logModelFailure. */
  functionName: string;
}

function shouldFallback(status: number): boolean {
  return status === 402 || status === 404 || status === 429 || status === 503 || status >= 500;
}

function normalizeGeminiModel(m: string): string {
  return m.startsWith("google/") ? m.slice("google/".length) : m;
}

/**
 * OpenAI chat-completions body → Gemini generateContent body.
 * Forwards messages, temperature, max_tokens, response_format(json_object)
 * and OpenAI tools[] (mapped to Gemini functionDeclarations).
 */
function toGeminiBody(openaiBody: Record<string, unknown>) {
  const messages = (openaiBody.messages as Array<{ role: string; content: string }>) || [];
  const systemMsgs = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

  const generation_config: Record<string, unknown> = {};
  if (typeof openaiBody.temperature === "number") {
    generation_config.temperature = openaiBody.temperature;
  }
  if (typeof openaiBody.max_tokens === "number") {
    generation_config.max_output_tokens = openaiBody.max_tokens;
  }
  if (typeof (openaiBody as any).max_completion_tokens === "number") {
    generation_config.max_output_tokens = (openaiBody as any).max_completion_tokens;
  }
  const rf = openaiBody.response_format as { type?: string } | undefined;
  if (rf?.type === "json_object") generation_config.response_mime_type = "application/json";

  const out: Record<string, unknown> = { contents, generation_config };
  if (systemMsgs) out.system_instruction = { parts: [{ text: systemMsgs }] };

  const tools = openaiBody.tools as Array<{ type: string; function: any }> | undefined;
  if (tools?.length) {
    out.tools = [{
      functionDeclarations: tools.map((t) => sanitizeForGemini(t.function)),
    }];
    const choice = (openaiBody as any).tool_choice;
    if (choice && typeof choice === "object" && choice.function?.name) {
      out.tool_config = {
        function_calling_config: {
          mode: "ANY",
          allowed_function_names: [choice.function.name],
        },
      };
    } else if (choice === "required") {
      out.tool_config = { function_calling_config: { mode: "ANY" } };
    } else {
      out.tool_config = { function_calling_config: { mode: "AUTO" } };
    }
  }
  return out;
}

/**
 * Gemini generateContent response → OpenAI chat-completions shape.
 */
function geminiToOpenAIResponse(gemini: any, model: string): any {
  const candidate = gemini?.candidates?.[0];
  const parts: any[] = candidate?.content?.parts || [];
  const textParts = parts
    .filter((p) => typeof p?.text === "string")
    .map((p) => p.text as string);
  const fnCalls = parts
    .filter((p) => p?.functionCall)
    .map((p, i: number) => ({
      id: `call_${i}`,
      type: "function",
      function: {
        name: p.functionCall.name,
        arguments: JSON.stringify(p.functionCall.args ?? {}),
      },
    }));
  return {
    id: `gemini-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textParts.join("") || null,
          ...(fnCalls.length ? { tool_calls: fnCalls } : {}),
        },
        finish_reason: (candidate?.finishReason ?? "stop").toString().toLowerCase(),
      },
    ],
    usage: {
      prompt_tokens: gemini?.usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: gemini?.usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: gemini?.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}

/**
 * POST a Chat-Completions style request with Google Gemini → OpenAI fallback.
 * Always returns a Response with OpenAI Chat Completions JSON body so existing
 * callsites parse `data.choices[0].message.content` without modification.
 */
export async function chatCompletion(
  body: Record<string, unknown>,
  opts: ChatCompletionOpts,
): Promise<Response> {
  const fallbackModel = opts.fallbackModel ?? "gpt-4o-mini";
  const googleKey = Deno.env.get("GEMINI_API_KEY");
  const oaKey     = Deno.env.get("OPENAI_API_KEY");

  let primaryResp: Response | null = null;
  const geminiModel = normalizeGeminiModel(opts.primaryModel);

  if (googleKey) {
    try {
      const url = `${GOOGLE_ENDPOINT_BASE}/${geminiModel}:generateContent?key=${googleKey}`;
      primaryResp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toGeminiBody(body)),
      });
      if (primaryResp.ok) {
        const geminiJson = await primaryResp.json();
        const openaiShape = geminiToOpenAIResponse(geminiJson, geminiModel);
        return new Response(JSON.stringify(openaiShape), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const errText = await primaryResp.clone().text().catch(() => "");
      await logModelFailure({
        model: geminiModel,
        provider: "google",
        status: primaryResp.status,
        endpoint: GOOGLE_ENDPOINT_BASE,
        error: errText.slice(0, 500),
        functionName: opts.functionName,
      });
      if (!shouldFallback(primaryResp.status)) return primaryResp;
      console.warn(
        `[aiChat] Google ${primaryResp.status} for ${geminiModel} → fallback OpenAI ${fallbackModel}`,
      );
    } catch (e) {
      console.warn(`[aiChat] Google fetch threw, falling back:`, (e as Error).message);
    }
  }

  if (!oaKey) {
    if (primaryResp) return primaryResp;
    return new Response(
      JSON.stringify({ error: "no_ai_provider_configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const r2 = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${oaKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...body, model: fallbackModel }),
  });

  if (!r2.ok) {
    const errText = await r2.clone().text().catch(() => "");
    await logModelFailure({
      model: fallbackModel,
      provider: "openai",
      status: r2.status,
      endpoint: OPENAI_ENDPOINT,
      error: errText.slice(0, 500),
      functionName: opts.functionName,
    });
  } else {
    console.log(`[aiChat] OpenAI fallback succeeded with ${fallbackModel}`);
  }
  return r2;
}