// pacing-periodic-check — v4.9
// Cron-triggered. For every active student whose last_pacing_recalc_at is
// older than 30 days (or NULL), invoke recalculate-pacing in 'proposal' mode
// with triggerType='periodic_30d'.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

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
