// v6.9.72 — Extract a structured student profile from a teacher's free-form
// paste of notes. Pure extraction: returns JSON for the client to apply via
// the apply_intake_extraction RPC (so the teacher can preview before commit).
//
// History
//  - v6.9.67/68: dropped Gemini tool-calling; switched to JSON-object response.
//  - v6.9.72: hardened error handling — robust JSON parser, explicit OpenAI
//    fallback when Gemini errors or returns unparsable content, and a
//    deterministic preview fallback so the UI never shows 502 for valid
//    teacher input. Worksheet Generation Engine NOT touched.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { chatCompletion } from "../_shared/aiChat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "gpt-4o-mini";

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
- The teacher may already have default UI values in "existing_profile". Treat existing_profile
  only as conflict context. NEVER use it as evidence and NEVER copy native_language from it.
- Native language may be returned only when the raw notes explicitly mention it or clearly state
  nationality/mother tongue. A dropdown default such as Spanish is not evidence.

OUTPUT FORMAT — return a SINGLE JSON object with EXACTLY these top-level keys (no prose,
no markdown fences):
{
  "language": "<BCP-47 like 'en' or 'pl'>",
  "summary_notes": "<<=1200 chars, English summary of the paste>",
  "student_name":  { "value": "<<=120 chars>", "confidence": <0..1>, "evidence_quote": "<verbatim>" } | null,
  "student_email": { "value": "<email address>", "confidence": <0..1>, "evidence_quote": "<verbatim>" } | null,
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

  const safeExistingProfile = {
    english_level: typeof existingProfile?.english_level === "string" ? existingProfile.english_level : null,
    main_goal: typeof existingProfile?.main_goal === "string" ? existingProfile.main_goal : null,
    main_goal_target_date: typeof existingProfile?.main_goal_target_date === "string" ? existingProfile.main_goal_target_date : null,
    native_language: null,
    mainGoalSet: Boolean(existingProfile?.mainGoalSet),
  };

  const userMsg =
    `existing_profile: ${JSON.stringify(safeExistingProfile)}\n` +
    `Important: existing_profile is NOT evidence. Extract only from Raw teacher notes.\n\n` +
    `Raw teacher notes:\n"""\n${rawText}\n"""\n\n` +
    `Extract the profile. Return ONLY the JSON object described in the system message.`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMsg },
  ];

  const stageOne = await tryAiStage(messages, PRIMARY_MODEL, false, rawText);
  if (stageOne.kind === "rate_limited") {
    return jsonResponse(429, { error: "ai_rate_limited", status: 429 });
  }
  if (stageOne.kind === "credits_exhausted") {
    return jsonResponse(402, { error: "ai_credits_exhausted", status: 402 });
  }
  if (stageOne.kind === "ok") {
    return jsonResponse(200, { ok: true, extraction: stageOne.extraction, model: stageOne.model });
  }

  const stageTwo = await tryAiStage(messages, FALLBACK_MODEL, true, rawText);
  if (stageTwo.kind === "ok") {
    return jsonResponse(200, { ok: true, extraction: stageTwo.extraction, model: stageTwo.model });
  }

  console.warn(
    `[extract-student-profile] AI stages failed (${stageOne.kind}/${stageTwo.kind}); returning deterministic preview.`,
  );
  const deterministic = buildDeterministicExtraction(rawText, existingProfile);
  return jsonResponse(200, {
    ok: true,
    extraction: deterministic,
    model: "fallback:deterministic-intake",
    degraded: true,
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type AiStageResult =
  | { kind: "ok"; extraction: any; model: string }
  | { kind: "rate_limited" }
  | { kind: "credits_exhausted" }
  | { kind: "provider_error"; status: number }
  | { kind: "invalid_json" }
  | { kind: "exception"; message: string };

async function tryAiStage(
  messages: Array<{ role: string; content: string }>,
  model: string,
  skipPrimary: boolean,
  rawText: string,
): Promise<AiStageResult> {
  try {
    const opts: any = { primaryModel: model, functionName: "extract-student-profile" };
    if (skipPrimary) opts.skipPrimary = true;
    const aiResp = await chatCompletion({
      messages,
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }, opts);

    if (!aiResp.ok) {
      const t = await aiResp.text().catch(() => "");
      const status = aiResp.status;
      if (status === 429) return { kind: "rate_limited" };
      if (status === 402) return { kind: "credits_exhausted" };
      console.warn(`[extract-student-profile] provider ${status}: ${t.slice(0, 200)}`);
      return { kind: "provider_error", status };
    }

    const data = await aiResp.json();
    const msg = data?.choices?.[0]?.message;
    const rawContent = typeof msg?.content === "string" ? msg.content : "";
    let extraction = parseJsonObjectFromText(rawContent);
    if (!extraction) {
      const call = msg?.tool_calls?.[0];
      if (call?.function?.arguments) {
        extraction = parseJsonObjectFromText(call.function.arguments);
      }
    }
    if (!extraction || typeof extraction !== "object") {
      console.warn("[extract-student-profile] invalid_ai_json", rawContent.slice(0, 200));
      return { kind: "invalid_json" };
    }
    normalizeExtraction(extraction);
    enforceEvidenceQuotes(extraction, rawText);
    enrichDeterministicIdentity(extraction, rawText);
    return { kind: "ok", extraction, model };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    console.warn(`[extract-student-profile] stage exception:`, message);
    return { kind: "exception", message };
  }
}

function parseJsonObjectFromText(input: string): any | null {
  if (!input) return null;
  const cleaned = input
    .replace(/^\uFEFF/, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const candidates: string[] = [cleaned];
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(cleaned.slice(start, end + 1));
  for (const c of candidates) {
    const tries = [c, stripTrailingCommas(c), stripControlChars(stripTrailingCommas(c))];
    for (const t of tries) {
      try {
        const v = JSON.parse(t);
        if (v && typeof v === "object") return v;
      } catch { /* try next */ }
    }
  }
  return null;
}

function stripTrailingCommas(s: string): string {
  return s.replace(/,(\s*[}\]])/g, "$1");
}
function stripControlChars(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function normalizeExtraction(extraction: any): void {
  const toConfidence = (value: unknown): number => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
  };
  for (const key of ["student_name", "student_email", "english_level", "main_goal", "native_language", "pacing"]) {
    if (extraction?.[key] && typeof extraction[key] === "object") {
      extraction[key].confidence = toConfidence(extraction[key].confidence);
    }
  }
  if (Array.isArray(extraction.signals)) {
    extraction.signals = extraction.signals
      .map((s: any) => ({ ...s, confidence: toConfidence(s?.confidence) }))
      .filter((s: any) => s.confidence >= 0.55)
      .slice(0, 12);
  } else extraction.signals = [];
  if (Array.isArray(extraction.goals)) {
    extraction.goals = extraction.goals
      .map((g: any) => ({ ...g, confidence: toConfidence(g?.confidence) }))
      .filter((g: any) => g.confidence >= 0.55)
      .slice(0, 5);
  } else extraction.goals = [];
}

function quoteAppearsInRaw(quote: unknown, rawText: string): boolean {
  if (typeof quote !== "string" || !quote.trim()) return false;
  const q = quote.trim().toLowerCase();
  if (q.length < 2) return false;
  return rawText.toLowerCase().includes(q);
}

function clearIfNoEvidence(extraction: any, key: string): void {
  const value = extraction?.[key];
  if (!value || typeof value !== "object") return;
  if (!quoteAppearsInRaw(value.evidence_quote, extraction.__rawTextForEvidence)) extraction[key] = null;
}

function enforceEvidenceQuotes(extraction: any, rawText: string): void {
  extraction.__rawTextForEvidence = rawText;
  clearIfNoEvidence(extraction, "student_name");
  clearIfNoEvidence(extraction, "student_email");
  clearIfNoEvidence(extraction, "english_level");
  clearIfNoEvidence(extraction, "main_goal");
  clearIfNoEvidence(extraction, "native_language");
  delete extraction.__rawTextForEvidence;

  if (Array.isArray(extraction.signals)) {
    extraction.signals = extraction.signals.filter((item: any) => quoteAppearsInRaw(item?.evidence_quote, rawText));
  }
  if (Array.isArray(extraction.goals)) {
    extraction.goals = extraction.goals.filter((item: any) => quoteAppearsInRaw(item?.evidence_quote, rawText));
  }
}

function enrichDeterministicIdentity(extraction: any, rawText: string): void {
  const email = rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email && !extraction.student_email) {
    extraction.student_email = { value: email.toLowerCase(), confidence: 0.95, evidence_quote: email };
  }

  if (!extraction.student_name) {
    const namePatterns = [
      /(?:student name|name|imi[eę](?: i nazwisko)?|ucze[nń]|uczennica|studentka|student|kursant|kursantka)\s*[:\-–]\s*([^\n,;<>@]{2,120})/i,
      /(?:nazywa si[eę]|to jest)\s+([^\n,;<>@]{2,120})/i,
    ];
    for (const pattern of namePatterns) {
      const match = rawText.match(pattern);
      const candidate = match?.[1]?.trim().replace(/\s+/g, " ").replace(/[.。]+$/, "");
      if (candidate && /[\p{L}]/u.test(candidate) && !/email|mail|@/i.test(candidate)) {
        extraction.student_name = { value: candidate.slice(0, 120), confidence: 0.9, evidence_quote: match![0].trim() };
        break;
      }
    }
  }
}

function buildDeterministicExtraction(rawText: string, existing: any): any {
  const text = rawText.slice(0, 2000);
  const lower = text.toLowerCase();

  let cefr: string | null = null;
  const cefrMatch = text.match(/\b(A1|A2|B1|B2|C1|C2)\b/);
  if (cefrMatch) cefr = cefrMatch[1].toUpperCase();

  let nativeLang: string | null = null;
  let nativeQuote = "";
  const langMatch = text.match(/(?:native language|mother tongue|native speaker|język ojczysty|ojczysty)[:\s\-–]+([A-Za-zÀ-ž]+)/i);
  if (langMatch) {
    nativeLang = langMatch[1];
    nativeQuote = langMatch[0];
  }

  const goalSignals: Array<[RegExp, string]> = [
    [/\b(ielts|toefl|cambridge|cae|fce|cpe|exam)\b/i, "Exam preparation"],
    [/\b(job interview|interview)\b/i, "Job interview preparation"],
    [/\b(presentation|meeting|client call|conference call)\b/i, "Business meetings and presentations"],
    [/\b(promotion|career)\b/i, "Career advancement"],
    [/\b(travel|trip|holiday|vacation)\b/i, "Travel English"],
    [/\b(business|work|professional)\b/i, "Business English"],
    [/\b(conversation|fluency|speaking)\b/i, "Conversational fluency"],
  ];
  let mainGoal: any = null;
  if (!existing?.main_goal) {
    for (const [re, label] of goalSignals) {
      if (re.test(lower)) {
        mainGoal = { value: label, target_date: "", confidence: 0.6, evidence_quote: text.match(re)?.[0] || label };
        break;
      }
    }
  }

  const language = /^[\x00-\x7F]*$/.test(text) ? "en" : "und";
  const summary = text.split(/\s+/).slice(0, 180).join(" ").slice(0, 1200);

  const deterministic = {
    language,
    summary_notes: summary,
    student_name: null,
    student_email: null,
    signals: [],
    goals: [],
    english_level: cefr ? { value: cefr, confidence: 0.6, evidence_quote: cefr } : null,
    main_goal: mainGoal,
    native_language: nativeLang ? { value: nativeLang, confidence: 0.8, evidence_quote: nativeQuote || nativeLang } : null,
    pacing: null,
  };
  enrichDeterministicIdentity(deterministic, rawText);
  return deterministic;
}