/**
 * transcribe-audio - Edge function to transcribe audio URLs using OpenAI Whisper
 * Fetches audio binary from URL, sends to Whisper API for transcription
 * 
 * Auth: service role key, a signed-in user, or a student proving homework access (body.access = share token + email).
 * The audio URL must be https on this project's Supabase/R2 media hosts and at most 25 MB.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveCaller } from "../_shared/auth.ts";
import { homeworkIdForStudentAccess } from "../_shared/evaluationAccess.ts";
import {
  AudioTooLargeError,
  buildAllowedAudioHosts,
  exceedsDeclaredSize,
  readBodyWithLimit,
  validateAudioUrl,
} from "../_shared/audioFetchGuard.ts";

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

    const body = await req.json();

    // Same access rule as verify-open-answers: service role, a signed-in user, or a
    // student proving access to one homework (share token + assigned email).
    const caller = await resolveCaller(req);
    let callerInfo: string = caller.kind === 'user' ? `user:${caller.user.id}` : caller.kind;
    let authorised = caller.kind === 'service' || caller.kind === 'user';
    if (!authorised) {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const homeworkId = await homeworkIdForStudentAccess(admin, body?.access);
      if (homeworkId) {
        authorised = true;
        callerInfo = `student:${homeworkId}`;
      }
    }
    if (!authorised) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ── END AUTH CHECK ──

    const allowedHosts = buildAllowedAudioHosts({
      supabaseUrl: Deno.env.get('SUPABASE_URL'),
      r2PublicUrl: Deno.env.get('R2_PUBLIC_URL'),
      r2CustomDomain: Deno.env.get('R2_CUSTOM_DOMAIN'),
    });
    const audio_url = validateAudioUrl(body?.audio_url, allowedHosts);

    if (!audio_url) {
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
    // Redirects are not followed: a redirect could leave the allowed hosts.
    const audioResponse = await fetch(audio_url, { redirect: 'manual' });
    if (!audioResponse.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch audio: ${audioResponse.status}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tooLarge = () => new Response(JSON.stringify({ error: 'Audio file is too large' }), {
      status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    if (exceedsDeclaredSize(audioResponse.headers.get('content-length'))) {
      await audioResponse.body?.cancel();
      return tooLarge();
    }
    const contentType = audioResponse.headers.get('content-type') || 'audio/webm';
    let audioBlob: Blob;
    try {
      audioBlob = new Blob([await readBodyWithLimit(audioResponse.body)], { type: contentType });
    } catch (e) {
      if (e instanceof AudioTooLargeError) return tooLarge();
      throw e;
    }
    
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
