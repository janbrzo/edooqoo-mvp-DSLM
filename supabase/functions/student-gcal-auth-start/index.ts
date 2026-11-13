import { appHosts } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, teacherToken, origin } = await req.json();
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');

    if (!clientId) {
      return new Response(JSON.stringify({ error: 'GOOGLE_CLIENT_ID not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email || !teacherToken) {
      return new Response(JSON.stringify({ error: 'email and teacherToken are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // The OAuth return page must be one of the app's own origins.
    let appOrigin: string | null = null;
    try {
      const u = new URL(String(origin));
      const host = u.hostname.toLowerCase();
      const local = host === 'localhost' || host === '127.0.0.1';
      const allowed = appHosts().includes(host) || host.endsWith('.lovable.app') || local;
      if (allowed && (u.protocol === 'https:' || (local && u.protocol === 'http:'))) appOrigin = u.origin;
    } catch { /* invalid */ }
    if (!appOrigin) {
      return new Response(JSON.stringify({ error: 'Invalid origin' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scopes = 'openid email https://www.googleapis.com/auth/calendar.events';
    const state = btoa(JSON.stringify({ email, teacherToken }));
    const redirectUri = `${appOrigin}/gcal-student-callback`;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}&login_hint=${encodeURIComponent(String(email))}`;

    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in student-gcal-auth-start:', err);
    return new Response(JSON.stringify({ error: 'Could not start Google sign-in' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
