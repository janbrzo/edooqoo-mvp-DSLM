/**
 * admin-impersonate - Generate magic link for admin to impersonate a teacher
 * Only accessible by users with 'admin' role in user_roles table
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with caller's token to verify identity
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser();
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Invalid auth token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role using service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      console.log('[admin-impersonate] Non-admin attempt by:', callerUser.id);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request
    const { target_teacher_id } = await req.json();
    if (!target_teacher_id) {
      return new Response(JSON.stringify({ error: 'target_teacher_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get target teacher email
    const { data: profile } = await adminClient
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', target_teacher_id)
      .single();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: 'Teacher not found or no email' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate magic link
    const origin = req.headers.get('origin') || Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com';
    const redirectTo = `${origin}/dashboard?admin_view=true`;

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
      options: { redirectTo },
    });

    if (linkError || !linkData) {
      console.error('[admin-impersonate] Magic link error:', linkError);
      return new Response(JSON.stringify({ error: 'Failed to generate magic link' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log the impersonation action
    await adminClient.from('admin_activity_log').insert({
      admin_id: callerUser.id,
      action: 'impersonate',
      target_teacher_id,
      details: {
        target_email: profile.email,
        target_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      },
    });

    console.log(`[admin-impersonate] Admin ${callerUser.id} impersonating ${target_teacher_id} (${profile.email})`);

    return new Response(JSON.stringify({
      success: true,
      impersonation_url: linkData.properties?.action_link,
      teacher_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      teacher_email: profile.email,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[admin-impersonate] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error)?.message ?? String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
