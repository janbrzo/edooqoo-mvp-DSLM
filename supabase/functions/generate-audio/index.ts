import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // Call OpenAI Chat Completions with audio modality
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-audio-preview",
        modalities: ["audio", "text"],
        audio: { voice: randomVoice, format: "mp3" },
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Generate a ${duration}-second audio scenario based on the requirements above.` 
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [AUDIO] OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ [AUDIO] OpenAI response received");
    
    // Extract audio and transcript (check multiple possible locations)
    const audioBase64 = data.choices[0]?.message?.audio?.data;
    const transcript = data.choices[0]?.message?.audio?.transcript || 
                      data.choices[0]?.message?.content || 
                      "";
    
    // DEBUG: Log transcript extraction
    console.log('🎵 [AUDIO] Transcript extracted:', {
      hasTranscript: !!transcript,
      length: transcript.length,
      preview: transcript.substring(0, 150),
      source: data.choices[0]?.message?.audio?.transcript ? 'audio.transcript' : 'content'
    });
    
    if (!audioBase64) {
      throw new Error("No audio data in OpenAI response");
    }
    
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
          source: 'openai-tts-generated',
          voice: randomVoice
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("❌ [AUDIO] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
