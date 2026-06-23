// v6.9.68 — Extract a structured student profile from a teacher's free-form
// paste of notes. Pure extraction: returns JSON for the client to apply via
// the apply_intake_extraction RPC (so the teacher can preview before commit).
//
// History: previously relied on Gemini tool-calling with a JSON schema. Gemini
// rejects many JSON-Schema keywords and our heavy `extract_student_profile`
// tool definition reliably triggered 502s. v6.9.68 drops tools entirely and
// uses a plain JSON-object response with defensive parsing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { chatCompletion } from "../_shared/aiChat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You receive raw teacher notes about a 1:1 adult English language student.
Your job is to extract a structured profile so the platform can seed the student record.

RULES:
- Extract ONLY what is clearly stated or strongly implied. NEVER invent facts.
- Every field MUST include an evidence_quote copied verbatim from the input.
- Set confidence honestly (0..1):
  * >= 0.75 = directly stated
  * 0.55–0.74 = strongly implied
  * < 0.55 = omit completely
- Translate all output text into English. Keep evidence_quote in the ORIGINAL paste language.
- If the paste contradicts itself, prefer the most recent statement.
- Andragogy: describe professional adult contexts (work, goals, life), avoid classroom labels.
- Signals belong either to "Personal" (life/work/interests/personality) or "Skill Assessment"
  (language strengths/weaknesses/mistakes/practice).
- The teacher already filled some profile fields ("existing_profile" in the user message).
  When existing_profile.english_level is already set, your english_level extraction is treated
  as a SUGGESTION, never auto-applied. Same for main_goal and native_language.

OUTPUT FORMAT — return a SINGLE JSON object with EXACTLY these top-level keys (no prose,
no markdown fences):
{
  "language": "<BCP-47 like 'en' or 'pl'>",
  "summary_notes": "<<=1200 chars, English summary of the paste>",
  "signals": [
    { "category": "Personal" | "Skill Assessment",
      "subtype": "<short label, optional>",
      "element_type": "<grammar|vocab|speaking|listening|reading|writing|other, optional>",
      "text": "<<=280 chars English statement>",
      "confidence": <0..1>,
      "evidence_quote": "<verbatim quote from the paste>" }
  ],
  "goals": [
    { "goal_type": "main" | "supporting" | "additional",
      "title": "<<=140 chars>",
      "description": "<<=400 chars optional>",
      "target_date": "<YYYY-MM-DD or empty>",
      "confidence": <0..1>,
      "evidence_quote": "<verbatim>" }
  ],
  "english_level": { "value": "A1|A2|B1|B2|C1|C2", "confidence": <0..1>, "evidence_quote": "<verbatim>" } | null,
  "main_goal":     { "value": "<<=120 chars>", "target_date": "<YYYY-MM-DD or empty>", "confidence": <0..1>, "evidence_quote": "<verbatim>" } | null,
  "native_language": { "value": "<<=40 chars>", "confidence": <0..1>, "evidence_quote": "<verbatim>" } | null,
  "pacing": { "sessions_per_week": <1..7>, "preferred_time": "<optional>", "rationale": "<optional>", "confidence": <0..1>, "evidence_quote": "<verbatim>" } | null
}
If a field is unknown, OMIT it or set it to null. Return ONLY the JSON object.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth (required).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  let teacherId: string | null = null;
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data } = await supa.auth.getUser();
    teacherId = data?.user?.id ?? null;
  } catch (e) {
    console.warn("[EXTRACT-STUDENT-PROFILE] Auth resolve failed:", (e as Error)?.message);
  }
  if (!teacherId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = null;
  try { body = await req.json(); } catch { body = null; }
  const rawText: string = typeof body?.raw_text === "string" ? body.raw_text.trim() : "";
  const existingProfile = body?.existing_profile && typeof body.existing_profile === "object"
    ? body.existing_profile
    : {};

  if (rawText.length < 40) {
    return new Response(JSON.stringify({ error: "text_too_short", min: 40 }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (rawText.length > 4000) {
    return new Response(JSON.stringify({ error: "text_too_long", max: 4000 }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userMsg =
    `existing_profile: ${JSON.stringify(existingProfile)}\n\n` +
    `Raw teacher notes:\n"""\n${rawText}\n"""\n\n` +
    `Extract the profile. Return ONLY the JSON object described in the system message.`;

  try {
    const aiResp = await chatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }, { primaryModel: MODEL, functionName: "extract-student-profile" });

    if (!aiResp.ok) {
      const t = await aiResp.text().catch(() => "");
      const status = aiResp.status;
      const code = status === 429 ? "ai_rate_limited"
                 : status === 402 ? "ai_credits_exhausted"
                 : "ai_provider_error";
      console.warn(`[extract-student-profile] provider ${status}: ${t.slice(0, 200)}`);
      return new Response(JSON.stringify({ error: code, status, detail: t.slice(0, 300) }), {
        status: status === 429 ? 429 : status === 402 ? 402 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const msg = data?.choices?.[0]?.message;
    let extraction: any = null;
    // Primary path: plain JSON content.
    const rawContent = typeof msg?.content === "string" ? msg.content : "";
    if (rawContent) {
      const cleaned = rawContent
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      try { extraction = JSON.parse(cleaned); } catch { /* fall through */ }
      if (!extraction) {
        // Last-resort: pull the first {...} block.
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start >= 0 && end > start) {
          try { extraction = JSON.parse(cleaned.slice(start, end + 1)); } catch { /* ignore */ }
        }
      }
    }
    // Legacy fallback: if a tool-call sneaks back in someday.
    if (!extraction) {
      const call = msg?.tool_calls?.[0];
      if (call?.function?.arguments) {
        try { extraction = JSON.parse(call.function.arguments); } catch { /* ignore */ }
      }
    }
    if (!extraction || typeof extraction !== "object") {
      console.warn("[extract-student-profile] invalid_ai_json", rawContent.slice(0, 200));
      return new Response(JSON.stringify({ error: "invalid_ai_json" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Post-filter: drop low-confidence signals/goals (<0.55) and clean shape.
    if (Array.isArray(extraction.signals)) {
      extraction.signals = extraction.signals
        .filter((s: any) => typeof s?.confidence === "number" && s.confidence >= 0.55)
        .slice(0, 12);
    } else extraction.signals = [];
    if (Array.isArray(extraction.goals)) {
      extraction.goals = extraction.goals
        .filter((g: any) => typeof g?.confidence === "number" && g.confidence >= 0.55)
        .slice(0, 5);
    } else extraction.goals = [];

    return new Response(
      JSON.stringify({ ok: true, extraction, model: MODEL }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "exception", detail: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});