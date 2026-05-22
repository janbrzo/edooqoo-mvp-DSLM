import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      topic, 
      englishLevel, 
      lessonFocus, 
      additionalInformation, 
      grammarFocus,
      duration = 90 
    } = await req.json();
    
    console.log("🎵 [AUDIO] Generating audio for:", { topic, englishLevel, lessonFocus });
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    // Random voice selection
    const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const randomVoice = voices[Math.floor(Math.random() * voices.length)];
    
    // System prompt
    const systemPrompt = `You are a professional English language audio content creator.

TASK: Create a realistic, engaging audio scenario for English learners.

REQUIREMENTS:
1. Topic: ${topic}
2. English Level: ${englishLevel} (CEFR scale)
3. Lesson Focus: ${lessonFocus}
${grammarFocus ? `4. Grammar Focus: ${grammarFocus} (incorporate naturally)` : ''}
${additionalInformation ? `5. Additional Information: ${additionalInformation}` : ''}
6. Duration: ${duration} seconds (~150 words per minute)
7. Style: Natural, conversational, life-like (NOT robotic)

SCENARIO TYPES: Conversations, monologues, dialogues based on topic.

CRITICAL RULES:
- Use contractions, natural pauses, fillers ("um", "well")
- Include real-world details (names, prices, locations, times)
- Match vocabulary/grammar to CEFR level
- If grammar focus specified, use it NATURALLY (not forced)
- Create believable characters with emotions

OUTPUT FORMAT: Return ONLY the spoken text (no JSON, no markdown).`;

    // STEP A — Generate transcript via stable chat.completions (gpt-4o-mini)
    // 2-step pipeline replaces deprecated/unavailable gpt-4o-audio-preview.
    // Transcript returned to client === literal TTS input → guaranteed parity.
    const scriptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 800,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate a ${duration}-second audio scenario based on the requirements above. Return ONLY spoken text — no stage directions, no markdown, no JSON.`,
          },
        ],
      }),
    });

    if (!scriptResponse.ok) {
      const errorText = await scriptResponse.text();
      console.error("❌ [AUDIO] Script generation failed:", errorText);
      await logModelFailure({
        model: "gpt-4o-mini",
        provider: "openai",
        status: scriptResponse.status,
        endpoint: "/v1/chat/completions",
        error: errorText,
        functionName: "generate-audio",
      });
      throw new Error(`Script generation failed (${scriptResponse.status}): ${errorText.substring(0, 300)}`);
    }

    const scriptData = await scriptResponse.json();
    const transcript = (scriptData.choices?.[0]?.message?.content || "").trim();
    if (!transcript) {
      throw new Error("transcript_generation_empty");
    }
    console.log(`✅ [AUDIO] Transcript generated: ${transcript.length} chars`);

    // STEP B — Synthesize speech via /v1/audio/speech with fallback chain
    async function generateTTS(model: string): Promise<ArrayBuffer> {
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          voice: randomVoice,
          input: transcript,
          response_format: "mp3",
        }),
      });
      if (!r.ok) {
        const errBody = await r.text();
        await logModelFailure({
          model,
          provider: "openai",
          status: r.status,
          endpoint: "/v1/audio/speech",
          error: errBody,
          functionName: "generate-audio",
        });
        throw new Error(`TTS ${model} failed (${r.status}): ${errBody.substring(0, 300)}`);
      }
      return r.arrayBuffer();
    }

    let audioBuffer: ArrayBuffer;
    let ttsModel = "gpt-4o-mini-tts";
    try {
      audioBuffer = await generateTTS("gpt-4o-mini-tts");
    } catch (e) {
      console.warn(`⚠️ [AUDIO] gpt-4o-mini-tts failed, falling back to tts-1:`, (e as Error).message);
      ttsModel = "tts-1";
      audioBuffer = await generateTTS("tts-1");
    }
    console.log(`✅ [AUDIO] TTS generated via ${ttsModel}: ${audioBuffer.byteLength} bytes`);

    // Chunked base64 conversion to avoid stack overflow for large payloads
    const bytes = new Uint8Array(audioBuffer);
    let binary = "";
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const audioBase64 = btoa(binary);
    
    // ✅ OPT 3 FIXED: Upload to R2 and wait for URL before returning
    const timestamp = Date.now();
    
    console.log(`[AUDIO] 🚀 Starting R2 upload...`);
    
    // Upload to R2 synchronously (we need R2 URL in database, not base64!)
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
    let finalAudioUrl = audioDataUrl;
    
    try {
      const uploadResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/upload-to-r2`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Image: audioBase64,
          filename: `audio/audio-${timestamp}-${randomVoice}.mp3`,
          contentType: "audio/mpeg"
        }),
      });
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        if (uploadData.success && uploadData.url) {
          console.log(`[AUDIO] ✅ R2 upload successful:`, uploadData.url);
          finalAudioUrl = uploadData.url;
        } else {
          console.warn(`[AUDIO] ⚠️ R2 upload failed, using base64 fallback`);
        }
      } else {
        console.warn(`[AUDIO] ⚠️ R2 upload failed (${uploadResponse.status}), using base64 fallback`);
      }
    } catch (uploadError) {
      console.warn(`[AUDIO] ⚠️ R2 upload error:`, uploadError.message, ', using base64 fallback');
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        audioData: {
          url: finalAudioUrl, // R2 URL if upload succeeded, base64 as fallback
          ai_generated_audio_url: finalAudioUrl,
          transcript: transcript,
          duration: duration,
          source: `openai-2step-${ttsModel}`,
          voice: randomVoice
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("❌ [AUDIO] Error:", error);
    // Fire-and-forget failure notification (do not await — keep 500 fast)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        fetch(`${supabaseUrl}/functions/v1/notify-generation-failure`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            errorType: "audio",
            errorMessage: error instanceof Error ? error.message : String(error),
            model: "openai-2step",
            timestamp: new Date().toISOString(),
          }),
        }).catch((e) => console.error("notify-failure dispatch error:", e));
      }
    } catch (notifyErr) {
      console.error("Failed to dispatch audio failure notification:", notifyErr);
    }
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
