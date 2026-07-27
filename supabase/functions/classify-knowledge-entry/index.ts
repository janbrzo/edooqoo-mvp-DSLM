// v6.9.8 — Auto-classify a Student Knowledge entry.
// v6.9.65 — Use chatCompletion helper for automatic OpenAI fallback
// when the direct Gemini primary path returns 402/429/5xx.
// Fire-and-forget: called from useStudentKnowledge after a Quick Add.
// Returns a category + structured metadata + confidence; client patches the row.
import { chatCompletion } from "../_shared/aiChat.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You classify short teacher notes about an English language student.
Return STRICT JSON matching the schema. Pick the single best category.

Categories:
- "Skill Assessment": observations about language ability (strengths, weaknesses, mistakes, things to practice). Requires skill_subtype + element_type. Optional: nano_skill, suggested_mastery (0-100).
- "Personal": personal life facts, work context, hobbies, travel, family, personality. Requires sub_category.
- "Goals": professional or learning goals, deadlines, target events.
- "Next Lesson Ideas": teacher's plan for what to do in upcoming lessons.
- "Notes": anything else / unclear.

skill_subtype: "strength" | "weakness" | "mistake" | "practice"
element_type: "grammar" | "vocabulary" | "speaking" | "writing" | "reading" | "listening" | "pronunciation"
sub_category (Personal): "personal_info" | "work" | "interests" | "travel" | "relationships" | "personality" | "other"

Set confidence 0..1. If unsure between Notes and another, prefer the specific category only when confidence >= 0.65.
Return tags as 1-4 short snake_case keywords.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const hasDirectAiProvider = Boolean(Deno.env.get('GEMINI_API_KEY') || Deno.env.get('OPENAI_API_KEY'))
  if (!hasDirectAiProvider) {
    return new Response(JSON.stringify({ error: 'ai_key_missing', detail: 'GEMINI_API_KEY or OPENAI_API_KEY required' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  let body: any
  try { body = await req.json() } catch { body = null }
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  const englishLevel = typeof body?.englishLevel === 'string' ? body.englishLevel : ''
  const mainGoal = typeof body?.mainGoal === 'string' ? body.mainGoal : ''
  if (!content || content.length < 3) {
    return new Response(JSON.stringify({ error: 'content_too_short' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const userMsg = `Student level: ${englishLevel || 'unknown'}. Main goal: ${mainGoal || 'unknown'}.\n\nNote: ${content}`

  const tool = {
    type: 'function',
    function: {
      name: 'classify_note',
      description: 'Classify a teacher note about an English student',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string', enum: ['Skill Assessment', 'Personal', 'Goals', 'Notes', 'Next Lesson Ideas'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          skill_subtype: { type: 'string', enum: ['strength', 'weakness', 'mistake', 'practice'] },
          element_type: { type: 'string', enum: ['grammar', 'vocabulary', 'speaking', 'writing', 'reading', 'listening', 'pronunciation'] },
          nano_skill: { type: 'string' },
          suggested_mastery: { type: 'number', minimum: 0, maximum: 100 },
          sub_category: { type: 'string', enum: ['personal_info', 'work', 'interests', 'travel', 'relationships', 'personality', 'other'] },
          summary: { type: 'string', description: 'One-line summary of the note' }
        },
        required: ['category', 'confidence', 'tags']
      }
    }
  }

  try {
    const aiResp = await chatCompletion({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg }
      ],
      tools: [tool],
      tool_choice: { type: 'function', function: { name: 'classify_note' } }
    }, { primaryModel: 'google/gemini-2.5-flash', functionName: 'classify-knowledge-entry' })

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: 'payment_required' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!aiResp.ok) {
      const t = await aiResp.text()
      return new Response(JSON.stringify({ error: 'ai_error', detail: t.slice(0, 300) }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const data = await aiResp.json()
    const call = data?.choices?.[0]?.message?.tool_calls?.[0]
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: 'no_tool_call' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const args = JSON.parse(call.function.arguments)
    return new Response(JSON.stringify({ ok: true, classification: args }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'exception', detail: e instanceof Error ? e.message : 'unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
