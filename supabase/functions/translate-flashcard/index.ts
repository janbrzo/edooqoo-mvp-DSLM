import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chatCompletion } from "../_shared/aiChat.ts";

// v6.6 (2026-04-27): migrated from OpenAI gpt-4o-mini → Lovable AI gemini-2.5-flash-lite.
// v6.9.65: unified through chatCompletion helper which auto-falls back to
// OpenAI gpt-4o-mini on Lovable 402/429/5xx.

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

    const response = await chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      max_tokens: 200,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }, { primaryModel: 'google/gemini-2.5-flash-lite', functionName: 'translate-flashcard' });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[translate-flashcard] AI error:', response.status, errText);
      throw new Error(`AI error ${response.status}`);
    }
    const data = await response.json();
    const content = (data.choices?.[0]?.message?.content || '').trim();
    
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
