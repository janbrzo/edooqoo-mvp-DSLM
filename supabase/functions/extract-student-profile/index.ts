// v6.9.62 P6 — Extract a structured student profile from a teacher's free-form
// paste of notes. Pure extraction: returns JSON for the client to apply via
// the apply_intake_extraction RPC (so the teacher can preview before commit).
//
// Pattern mirrors classify-knowledge-entry (Lovable AI Gateway, tool-call,
// 429/402 surfacing, logModelFailure on errors).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
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
- Signals belong either to Personal (life/work/interests/personality) or Skill Assessment
  (language strengths/weaknesses/mistakes/practice).
- The teacher already filled some profile fields ("existing_profile" in the user message).
  When existing_profile.english_level is already set, your english_level extraction is treated
  as a SUGGESTION, never auto-applied. Same for main_goal and native_language.`;

const TOOL = {
  type: "function",
  function: {
    name: "extract_student_profile",
    description: "Structured extraction of a student profile from raw notes.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["language", "summary_notes", "signals", "goals"],
      properties: {
        language: { type: "string", description: "BCP-47 of paste (e.g. en, pl)" },
        summary_notes: { type: "string", maxLength: 1200 },
        signals: {
          type: "array",
          maxItems: 12,
          items: {
            type: "object",
            required: ["category", "text", "confidence", "evidence_quote"],
            properties: {
              category: { type: "string", enum: ["Personal", "Skill Assessment"] },
              subtype: { type: "string" },
              element_type: { type: "string" },
              text: { type: "string", maxLength: 280 },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              evidence_quote: { type: "string", maxLength: 200 },
            },
          },
        },
        goals: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            required: ["title", "confidence", "evidence_quote"],
            properties: {
              goal_type: { type: "string", enum: ["main", "supporting", "additional"] },
              title: { type: "string", maxLength: 140 },
              description: { type: "string", maxLength: 400 },
              target_date: { type: "string", description: "YYYY-MM-DD or empty" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              evidence_quote: { type: "string" },
            },
          },
        },
        english_level: {
          type: "object",
          properties: {
            value: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
            confidence: { type: "number" },
            evidence_quote: { type: "string" },
          },
        },
        main_goal: {
          type: "object",
          properties: {
            value: { type: "string", maxLength: 120 },
            target_date: { type: "string" },
            confidence: { type: "number" },
            evidence_quote: { type: "string" },
          },
        },
        native_language: {
          type: "object",
          properties: {
            value: { type: "string", maxLength: 40 },
            confidence: { type: "number" },
            evidence_quote: { type: "string" },
          },
        },
        pacing: {
          type: "object",
          properties: {
            sessions_per_week: { type: "number", minimum: 1, maximum: 7 },
            preferred_time: { type: "string" },
            rationale: { type: "string" },
            confidence: { type: "number" },
            evidence_quote: { type: "string" },
          },
        },
      },
    },
  },
};

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

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "ai_key_missing" }), {
      status: 500,
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
    `Extract the profile. Return the tool-call ONLY.`;

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "extract_student_profile" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "payment_required" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      await logModelFailure({
        model: MODEL,
        provider: "lovable-gateway",
        status: aiResp.status,
        endpoint: "/v1/chat/completions",
        error: t.slice(0, 500),
        functionName: "extract-student-profile",
      });
      return new Response(JSON.stringify({ error: "ai_error", detail: t.slice(0, 300) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "no_tool_call" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let extraction: any;
    try { extraction = JSON.parse(call.function.arguments); }
    catch {
      return new Response(JSON.stringify({ error: "parse_failed" }), {
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