// Closed-Loop Company — token-economy-health (Wave 1).
// Cadence: monthly 1st 05:00 UTC.
// Segments teachers (under/over/at-risk/healthy) and emits teacher_alerts.
// NEVER auto-upgrade Stripe subscriptions.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOOP_ID = 'token-economy-health';
const IDEMPOTENCY_BUCKET_DAYS = 60;

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
  let alertsEmitted = 0;
  let signalsEmitted = 0;
  let rowsProcessed = 0;
  let status: 'success' | 'failure' = 'success';
  let errorMessage: string | null = null;

  try {
    // Pull active paid teachers from profiles. We use monthly_worksheet_limit + monthly_worksheets_used
    // as proxy because subscriptions table is managed by Stripe webhook.
    const { data: teachers, error: tErr } = await supabase
      .from('profiles')
      .select('id, email, monthly_worksheet_limit, monthly_worksheets_used, subscription_type, subscription_status, available_tokens, deleted_at')
      .is('deleted_at', null)
      .not('subscription_type', 'is', null)
      .eq('subscription_status', 'active');
    if (tErr) throw tErr;

    rowsProcessed = teachers?.length ?? 0;
    const now = Date.now();
    const idempotencySince = new Date(now - IDEMPOTENCY_BUCKET_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const monthBucket = new Date(now).toISOString().slice(0, 7);

    for (const t of teachers ?? []) {
      const limit = t.monthly_worksheet_limit;
      const used = t.monthly_worksheets_used ?? 0;
      if (!limit || limit <= 0) continue;
      const ratio = used / limit;

      let segment: 'under' | 'over' | 'healthy' = 'healthy';
      if (ratio < 0.3) segment = 'under';
      else if (ratio >= 0.95) segment = 'over';
      if (segment === 'healthy') continue;

      const idempotencyKey = `${segment}-${monthBucket}`;
      const { data: existing } = await supabase
        .from('teacher_alerts')
        .select('id')
        .eq('teacher_id', t.id)
        .eq('alert_type', 'token_economy')
        .gte('created_at', idempotencySince)
        .contains('payload', { segment })
        .limit(1);
      if (existing && existing.length > 0) continue;

      const isOver = segment === 'over';
      await supabase.from('teacher_alerts').insert({
        teacher_id: t.id,
        alert_type: 'token_economy',
        severity: isOver ? 'medium' : 'low',
        title: isOver
          ? 'You are using ≥95% of your monthly worksheets'
          : 'You are using less than 30% of your monthly worksheets',
        message: isOver
          ? `Used ${used}/${limit} this cycle. Consider upgrading to avoid running out.`
          : `Used ${used}/${limit} this cycle. A smaller plan may save you money.`,
        payload: {
          segment,
          used,
          limit,
          usage_ratio: Number(ratio.toFixed(2)),
        },
        cta_url: '/profile',
        cta_label: 'Manage plan',
        source_loop_id: LOOP_ID,
        idempotency_key: idempotencyKey,
      });
      alertsEmitted++;

      // Also log a signal for admin visibility (segment aggregates are useful).
      await supabase.from('closed_loop_signals').insert({
        loop_id: LOOP_ID,
        severity: isOver ? 'medium' : 'low',
        payload: {
          teacher_id: t.id,
          segment,
          used,
          limit,
          usage_ratio: Number(ratio.toFixed(2)),
          subscription_type: t.subscription_type,
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
    alerts_emitted: alertsEmitted,
    signals_emitted: signalsEmitted,
    rows_processed: rowsProcessed,
    error_message: errorMessage,
  });

  return new Response(
    JSON.stringify({ ok: status === 'success', alertsEmitted, signalsEmitted, rowsProcessed, errorMessage }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: status === 'success' ? 200 : 500 },
  );
});