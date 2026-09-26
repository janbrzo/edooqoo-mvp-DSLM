import { jsonResponse, resolveCaller, signPayload, teacherIdOf } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { redirectUri } = await req.json();
    // The account being connected is the signed-in teacher, never a body id.
    const teacherId = teacherIdOf(await resolveCaller(req));
    if (!teacherId) {
      return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
    }
    if (typeof redirectUri !== 'string' || !redirectUri) {
      return jsonResponse({ error: 'redirectUri is required' }, 400, corsHeaders);
    }
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'GOOGLE_CLIENT_ID not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scopes = 'https://www.googleapis.com/auth/calendar.events';
    // Signed, short-lived state: the callback only stores Google tokens for the
    // teacher who started this flow (prevents OAuth CSRF / account binding).
    const state = await signPayload({ teacherId, redirectUri }, 15 * 60 * 1000);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in gcal-auth-start:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
