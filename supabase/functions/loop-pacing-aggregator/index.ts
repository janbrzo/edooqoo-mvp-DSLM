// Closed-Loop Company — pacing-drift-aggregation (Wave 1).
// Cadence: weekly Sat 04:00 UTC.
// Detects systemic drift across (cefr_level × goal) cohorts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOOP_ID = 'pacing-drift-aggregation';
const MIN_COHORT = 5;

function formatErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    return (e.message as string) || (e.details as string) || (e.hint as string) || JSON.stringify(err);
  }
  return String(err);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const startedAt = new Date().toISOString();
  let signalsEmitted = 0;
  let rowsProcessed = 0;
  let status: 'success' | 'failure' = 'success';
  let errorMessage: string | null = null;

  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Active students: had at least one event in last 90d. We approximate via last_pacing_recalc_at OR created_at.
    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id, english_level, main_goal, last_pacing_recalc_at, created_at, deleted_at')
      .is('deleted_at', null)
      .gte('created_at', ninetyDaysAgo);
    if (stErr) throw stErr;

    rowsProcessed = students?.length ?? 0;

    type Cohort = { ids: string[]; driftCount: number; recalcCount: number };
    const cohorts = new Map<string, Cohort>();
    for (const s of students ?? []) {
      const key = `${(s as any).english_level || 'unknown'}|${(s as any).main_goal || 'unknown'}`;
      if (!cohorts.has(key)) cohorts.set(key, { ids: [], driftCount: 0, recalcCount: 0 });
      cohorts.get(key)!.ids.push(s.id);
      // Heuristic: if last_pacing_recalc_at is null OR older than 14 days, treat as drift candidate.
      if (!s.last_pacing_recalc_at || new Date(s.last_pacing_recalc_at) < new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)) {
        cohorts.get(key)!.driftCount++;
      }
    }

    // Recalc activity in last 30d.
    const { data: proposals } = await supabase
      .from('pacing_proposals')
      .select('student_id, status, created_at')
      .gte('created_at', thirtyDaysAgo)
      .eq('status', 'accepted');
    const acceptedByStudent = new Set((proposals ?? []).map(p => p.student_id));

    for (const [key, c] of cohorts) {
      if (c.ids.length < MIN_COHORT) continue;
      const acceptedInCohort = c.ids.filter(id => acceptedByStudent.has(id)).length;
      const pctDrift = c.driftCount / c.ids.length;
      const pctAccepted = acceptedInCohort / c.ids.length;
      let severity: 'medium' | 'high' | null = null;
      if (pctDrift >= 0.5 || pctAccepted >= 0.4) severity = 'high';
      else if (pctDrift >= 0.3) severity = 'medium';
      if (!severity) continue;

      const [cefr, goal] = key.split('|');
      await supabase.from('closed_loop_signals').insert({
        loop_id: LOOP_ID,
        severity,
        payload: {
          cohort: { cefr, goal },
          n_students: c.ids.length,
          pct_drift: Number(pctDrift.toFixed(2)),
          pct_accepted_recalc: Number(pctAccepted.toFixed(2)),
          suggested_action: 'audit generate-curriculum-phases template',
        },
        status: 'open',
      });
      signalsEmitted++;
    }
  } catch (err) {
    status = 'failure';
    errorMessage = formatErr(err);
  }

  await supabase.from('system_health_metrics').insert({
    loop_id: LOOP_ID,
    run_started_at: startedAt,
    run_finished_at: new Date().toISOString(),
    status,
    signals_emitted: signalsEmitted,
    rows_processed: rowsProcessed,
    error_message: errorMessage,
  });

  return new Response(
    JSON.stringify({ ok: status === 'success', signalsEmitted, rowsProcessed, errorMessage }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: status === 'success' ? 200 : 500 },
  );
});