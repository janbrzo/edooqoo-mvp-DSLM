/**
 * transcribe-audio - Edge function to transcribe audio URLs using OpenAI Whisper
 * Fetches audio binary from URL, sends to Whisper API for transcription
 * 
 * Auth: Accepts both user JWTs (frontend) and SUPABASE_SERVICE_ROLE_KEY (internal server-to-server calls)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── AUTH CHECK (dual-path: user JWT or service role key) ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    let callerInfo = 'unknown';

    if (token === serviceRoleKey) {
      callerInfo = 'service-role-internal';
      console.log('[transcribe-audio] Authorized via service role key (internal call)');
    } else if (token === anonKey) {
      // Anonymous frontend call (e.g. student on homework via share link, not logged in)
      callerInfo = 'anon-frontend';
      console.log('[transcribe-audio] Authorized via anon key (anonymous frontend call)');
    } else {
      // Frontend call with user JWT — validate
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      callerInfo = `user:${user.id}`;
    }
    // ── END AUTH CHECK ──

    const { audio_url } = await req.json();

    if (!audio_url || !audio_url.startsWith('http')) {
      return new Response(JSON.stringify({ error: 'Valid audio_url is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Fetch the audio file as binary
    console.log('[transcribe-audio] Fetching audio from:', audio_url, 'caller:', callerInfo);
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch audio: ${audioResponse.status}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const audioBlob = await audioResponse.blob();
    const contentType = audioResponse.headers.get('content-type') || 'audio/webm';
    
    // Determine file extension
    let ext = 'webm';
    if (contentType.includes('mp4') || contentType.includes('m4a')) ext = 'mp4';
    else if (contentType.includes('ogg')) ext = 'ogg';
    else if (contentType.includes('wav')) ext = 'wav';
    else if (contentType.includes('mpeg') || contentType.includes('mp3')) ext = 'mp3';

    // Step 2: Send to OpenAI Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, `recording.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    console.log('[transcribe-audio] Sending to Whisper API, size:', audioBlob.size);
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errText = await whisperResponse.text();
      console.error('[transcribe-audio] Whisper error:', errText);
      return new Response(JSON.stringify({ error: 'Transcription failed', details: errText }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const whisperData = await whisperResponse.json();
    const transcription = whisperData.text || 'Unable to transcribe audio.';

    console.log('[transcribe-audio] Transcription successful, length:', transcription.length);

    return new Response(JSON.stringify({ success: true, transcription }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error)?.message ?? String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
