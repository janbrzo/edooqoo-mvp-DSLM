/**
 * generate-welcome-test-audio - Generate TTS audio for Welcome Test listening questions.
 * Uses OpenAI TTS-1 API for exact verbatim reading (no improvisation).
 * Uploads to R2 for permanent storage.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, voice } = await req.json();

    if (!transcript) {
      return new Response(JSON.stringify({ error: 'transcript is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const selectedVoice = voice || 'nova';
    
    // Use TTS-1 for exact verbatim reading (no improvisation)
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: transcript,
        voice: selectedVoice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('TTS generation error:', errText);
      return new Response(JSON.stringify({ error: 'Audio generation failed', details: errText }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TTS returns raw audio bytes - use chunked conversion to avoid stack overflow
    const audioArrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(audioArrayBuffer);
    const chunkSize = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j]);
      }
    }
    const audioBase64 = btoa(binary);

    // Upload to R2
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const timestamp = Date.now();

    const uploadResponse = await fetch(`${supabaseUrl}/functions/v1/upload-to-r2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Image: audioBase64,
        filename: `audio/welcome-test-listening-${timestamp}.mp3`,
        contentType: 'audio/mpeg',
      }),
    });

    let audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      if (uploadData.success && uploadData.url) {
        audioUrl = uploadData.url;
        console.log('R2 upload success:', audioUrl);
      }
    } else {
      console.warn('R2 upload failed, returning base64 fallback');
    }

    return new Response(JSON.stringify({ success: true, audio_url: audioUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
