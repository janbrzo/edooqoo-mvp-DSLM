// pacing-periodic-check: v4.9
// Cron-triggered. For every active student whose last_pacing_recalc_at is
// older than 30 days (or NULL), invoke recalculate-pacing in 'proposal' mode
// with triggerType='periodic_30d'. Pending proposals older than
// PACING_PROPOSAL_MAX_AGE_DAYS (14) are expired first (status 'superseded'): the
// UI also hides them, and accepting a proposal recomputes the value (D11).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hasValidCronSecret } from "../_shared/cronAuth.ts";
import { PACING_PROPOSAL_MAX_AGE_DAYS } from "../_shared/pacing.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cron only: the project CRON_SECRET (x-cron-secret) or the service role key.
    const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const authorised =
      hasValidCronSecret(req.headers.get('x-cron-secret'), Deno.env.get('CRON_SECRET')) ||
      (!!serviceKey && bearer === serviceKey);
    if (!authorised) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const expiryCutoff = new Date(Date.now() - PACING_PROPOSAL_MAX_AGE_DAYS * 86400000).toISOString();
    const { error: expErr } = await supabase
      .from('pacing_proposals')
      .update({ status: 'superseded', decided_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lt('created_at', expiryCutoff);
    if (expErr) console.warn('pacing proposal expiry failed', expErr.message);

    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: students, error } = await supabase
      .from('students')
      .select('id, teacher_id, last_pacing_recalc_at')
      .is('deleted_at', null)
      .or(`last_pacing_recalc_at.is.null,last_pacing_recalc_at.lt.${cutoff}`)
      .limit(500);
    if (error) throw error;

    let triggered = 0;
    for (const s of students || []) {
      try {
        await supabase.functions.invoke('recalculate-pacing', {
          body: {
            studentId: s.id,
            teacherId: s.teacher_id,
            mode: 'proposal',
            triggerType: 'periodic_30d',
            triggerDetails: { lastRecalc: s.last_pacing_recalc_at },
          },
        });
        triggered++;
      } catch (e) {
        console.warn('Failed for student', s.id, e);
      }
    }

    return new Response(JSON.stringify({ checked: students?.length ?? 0, triggered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('pacing-periodic-check error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
