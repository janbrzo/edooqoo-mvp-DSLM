import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signPayload, verifyPayload } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * claim-anonymous-worksheets
 *
 * After an anonymous user signs up / logs in, the frontend posts the list of
 * worksheet IDs it generated while anonymous (stored in localStorage). This
 * function transfers ownership of those worksheets (where teacher_id IS NULL
 * and they were created within the last 7 days) to the now-authenticated user.
 *
 * Auth: requires a valid Supabase JWT (anon key) in the Authorization header.
 * Body: { worksheetIds: string[] }
 * Returns: { claimedCount: number, claimedIds: string[] }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify JWT via anon client
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (user.is_anonymous) {
      // An anonymous session may only ask for a ticket proving it owns its id.
      const peek = await req.clone().json().catch(() => ({}));
      if (peek?.action === 'ticket') {
        const ticket = await signPayload({ kind: 'anon-claim', anonUserId: user.id }, 7 * 24 * 60 * 60 * 1000);
        return new Response(JSON.stringify({ ticket }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Anonymous users cannot claim worksheets' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { worksheetIds, anonUserId, claimTicket } = await req.json();
    if (!Array.isArray(worksheetIds) || worksheetIds.length === 0) {
      return new Response(JSON.stringify({ claimedCount: 0, claimedIds: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize: only keep valid UUID-ish strings
    const cleanIds = worksheetIds
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 10 && id.length < 64)
      .slice(0, 50); // hard cap

    if (cleanIds.length === 0) {
      return new Response(JSON.stringify({ claimedCount: 0, claimedIds: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role client for the privileged update
    const adminClient = createClient(supabaseUrl, serviceKey);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Match either:
    //   (a) worksheets that have no teacher (truly anonymous), OR
    //   (b) worksheets currently owned by the prior anonymous user (Supabase
    //       creates a new user on email sign-up, the anon user's UUID was
    //       captured client-side at generation time).
    // anonUserId is validated server-side as a UUID before being interpolated
    // into the .or() filter to prevent injection.
    const isUuid = typeof anonUserId === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(anonUserId);

    // anonUserId comes from the client, so confirm it really is an anonymous
    // account: otherwise a teacher could pass another teacher's id and take
    // over that teacher's recent worksheets.
    // Knowing an id is not proof: the caller must present a ticket that was
    // signed for the anonymous account while that account was signed in.
    let isAnonymousOwner = false;
    if (isUuid && anonUserId !== user.id) {
      const ticket = await verifyPayload<{ anonUserId?: string; kind?: string }>(claimTicket);
      isAnonymousOwner = ticket?.kind === 'anon-claim' && ticket.anonUserId === anonUserId;
    }

    let query = adminClient
      .from('worksheets')
      .update({ teacher_id: user.id, user_id: user.id })
      .in('id', cleanIds)
      .gte('created_at', sevenDaysAgo);

    if (isAnonymousOwner) {
      query = query.or(`teacher_id.is.null,teacher_id.eq.${anonUserId}`);
    } else {
      query = query.is('teacher_id', null);
    }

    const { data: claimed, error: updateErr } = await query.select('id');

    if (updateErr) {
      console.error('[claim-anonymous-worksheets] update error:', updateErr);
      return new Response(JSON.stringify({ error: 'Could not claim worksheets' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const claimedIds = (claimed || []).map((w: { id: string }) => w.id);
    console.log(`[claim-anonymous-worksheets] User ${user.id} claimed ${claimedIds.length}/${cleanIds.length} worksheets`);

    return new Response(JSON.stringify({ claimedCount: claimedIds.length, claimedIds }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[claim-anonymous-worksheets] Error:', msg);
    return new Response(JSON.stringify({ error: 'Could not claim worksheets' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});