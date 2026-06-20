// v6.9.65 — Shared chat-completion helper with automatic fallback.
// Tries Lovable AI Gateway first; on HTTP 402 (credits exhausted),
// 429 (rate limit) or 5xx (transient), falls back to OpenAI direct.
// Body is forwarded verbatim except `model`, so callers keep their
// existing `tools`, `tool_choice`, `response_format`, `temperature`,
// `max_tokens` etc. unchanged.
import { logModelFailure } from "./modelFailureLogger.ts";

const LOVABLE_ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_ENDPOINT  = "https://api.openai.com/v1/chat/completions";

export interface ChatCompletionOpts {
  /** Lovable Gateway model id, e.g. "google/gemini-2.5-flash". */
  primaryModel: string;
  /** OpenAI direct model id, defaults to "gpt-4o-mini". */
  fallbackModel?: string;
  /** Caller function name for logModelFailure. */
  functionName: string;
}

function shouldFallback(status: number): boolean {
  return status === 402 || status === 429 || status >= 500;
}

/**
 * POST a Chat-Completions request with Lovable → OpenAI fallback.
 * Returns the final Response (same shape from both providers), so
 * existing callers can keep their .ok / .status / .json() handling.
 */
export async function chatCompletion(
  body: Record<string, unknown>,
  opts: ChatCompletionOpts,
): Promise<Response> {
  const fallbackModel = opts.fallbackModel ?? "gpt-4o-mini";
  const lovKey = Deno.env.get("LOVABLE_API_KEY");
  const oaKey  = Deno.env.get("OPENAI_API_KEY");

  let primaryResp: Response | null = null;

  if (lovKey) {
    try {
      primaryResp = await fetch(LOVABLE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, model: opts.primaryModel }),
      });
      if (primaryResp.ok) return primaryResp;

      const errText = await primaryResp.clone().text().catch(() => "");
      await logModelFailure({
        model: opts.primaryModel,
        provider: "lovable-gateway",
        status: primaryResp.status,
        endpoint: LOVABLE_ENDPOINT,
        error: errText.slice(0, 500),
        functionName: opts.functionName,
      });

      if (!shouldFallback(primaryResp.status)) {
        // Non-recoverable (400/401/403/404) — return as-is.
        return primaryResp;
      }
      console.warn(
        `[aiChat] Lovable ${primaryResp.status} for ${opts.primaryModel} → falling back to OpenAI ${fallbackModel}`,
      );
    } catch (e) {
      console.warn(`[aiChat] Lovable fetch threw, falling back:`, (e as Error).message);
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