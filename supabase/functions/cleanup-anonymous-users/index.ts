import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get anonymous users (profiles with no email)
    const { data: anonProfiles, error: fetchError } = await adminClient
      .from('profiles')
      .select('id')
      .or('email.is.null,email.eq.')
      .limit(2000);

    if (fetchError) {
      console.error('Error fetching anonymous profiles:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!anonProfiles || anonProfiles.length === 0) {
      return new Response(JSON.stringify({ deleted_count: 0, message: 'No anonymous accounts found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${anonProfiles.length} anonymous profiles to clean up`);

    let deletedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const profile of anonProfiles) {
      try {
        // Delete from auth.users (cascade will handle profiles via trigger or we delete manually)
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(profile.id);
        if (deleteError) {
          console.error(`Failed to delete user ${profile.id}:`, deleteError.message);
          errorCount++;
          if (errors.length < 10) errors.push(`${profile.id}: ${deleteError.message}`);
          
          // Try to at least delete the profile
          await adminClient.from('profiles').delete().eq('id', profile.id);
        } else {
          deletedCount++;
        }
      } catch (err) {
        console.error(`Error deleting user ${profile.id}:`, err);
        errorCount++;
      }
    }

    console.log(`Cleanup complete: ${deletedCount} deleted, ${errorCount} errors`);

    return new Response(JSON.stringify({
      deleted_count: deletedCount,
      error_count: errorCount,
      total_found: anonProfiles.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({ error: (error as Error)?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
