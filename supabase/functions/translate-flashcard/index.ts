import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";

// v6.6 (2026-04-27): migrated from OpenAI gpt-4o-mini → Lovable AI gemini-2.5-flash-lite.
// Rationale: ~3x cost reduction, latency parity, task scope (translate/define + CEFR) matches Tier 4.
// Previous engine kept as fallback if LOVABLE_API_KEY is missing.
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, target_language, mode = 'translation' } = await req.json();

    if (!text || !target_language) {
      return new Response(
        JSON.stringify({ error: 'Missing text or target_language' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[translate-flashcard] Mode: ${mode}, Processing "${text}" for ${target_language}`);

    let systemPrompt = '';
    if (mode === 'definition') {
      systemPrompt = `You are an English language teacher and level assessor.
1. Provide a clear, concise definition of the English word or phrase in simple English that an ESL student can understand. Keep it under 20 words.
2. Assess the CEFR level (A1, A2, B1, B2, C1, or C2) of the word/phrase.

Respond in JSON format: {"translation": "your definition here", "cefr_level": "B1"}

CEFR guidelines for word difficulty:
- A1: basic daily words (house, eat, big, go, water)
- A2: common everyday (restaurant, improve, complaint, reservation)
- B1: workplace/opinion (experience, suggestion, responsibility)
- B2: abstract/formal (hypothesis, negotiate, comprehensive)
- C1: academic/nuanced (mitigate, inherent, profound, ambiguity)
- C2: rare/literary (obfuscate, ephemeral, misapprehension)
Consider: frequency of use, abstractness, morphological complexity, collocational range.`;
    } else {
      systemPrompt = `You are a professional translator and English level assessor.
1. Translate the given English text to ${target_language}. Provide a natural, conversational translation.
2. Assess the CEFR level (A1, A2, B1, B2, C1, or C2) of the English word/phrase.

Respond in JSON format: {"translation": "your translation here", "cefr_level": "B1"}

CEFR guidelines for word difficulty:
- A1: basic daily words (house, eat, big, go, water)
- A2: common everyday (restaurant, improve, complaint, reservation)
- B1: workplace/opinion (experience, suggestion, responsibility)
- B2: abstract/formal (hypothesis, negotiate, comprehensive)
- C1: academic/nuanced (mitigate, inherent, profound, ambiguity)
- C2: rare/literary (obfuscate, ephemeral, misapprehension)
Consider: frequency of use, abstractness, morphological complexity, collocational range.`;
    }

    // Primary path: Lovable AI Gateway (gemini-2.5-flash-lite). Fallback: OpenAI gpt-4o-mini.
    let content = '';
    const useLovable = !!lovableApiKey;

    if (useLovable) {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          max_tokens: 200,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded, try again shortly.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'AI credits depleted. Add credits in Workspace Usage.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errText = await response.text();
        console.error('[translate-flashcard] Lovable AI error:', response.status, errText);
        await logModelFailure({
          model: 'google/gemini-2.5-flash-lite',
          provider: 'lovable-gateway',
          status: response.status,
          endpoint: '/v1/chat/completions',
          error: errText,
          functionName: 'translate-flashcard',
        });
        throw new Error(`Lovable AI error ${response.status}`);
      }

      const data = await response.json();
      content = (data.choices?.[0]?.message?.content || '').trim();
    } else {
      // Legacy fallback (kept for safety while LOVABLE_API_KEY rolls out)
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          max_tokens: 150,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error('[translate-flashcard] OpenAI error:', data);
        await logModelFailure({
          model: 'gpt-4o-mini',
          provider: 'openai',
          status: response.status,
          endpoint: '/v1/chat/completions',
          error: JSON.stringify(data).slice(0, 500),
          functionName: 'translate-flashcard',
        });
        throw new Error(data.error?.message || 'OpenAI request failed');
      }
      content = data.choices[0]?.message?.content?.trim() || '';
    }
    
    let translation = '';
    let cefr_level = 'A2';

    try {
      const parsed = JSON.parse(content);
      translation = parsed.translation || '';
      cefr_level = parsed.cefr_level || 'A2';
    } catch {
      // Fallback: old format, plain text response
      translation = content;
      cefr_level = 'A2';
    }

    console.log(`[translate-flashcard] Result: "${translation}" (CEFR: ${cefr_level})`);

    return new Response(
      JSON.stringify({ translation, cefr_level }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[translate-flashcard] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error)?.message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
