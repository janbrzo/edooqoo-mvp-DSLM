// Closed-Loop Company — student-engagement-decay (Wave 1).
// Cadence: daily 05:00 UTC.
// Detects 14d-vs-14d engagement drops and emits teacher_alerts (medium/high).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOOP_ID = 'student-engagement-decay';
const WEIGHTS: Record<string, number> = {
  homework: 3,
  worksheet: 2,
  flashcard: 1,
  test: 2,
  welcome_test: 1,
  teacher: 0.5,
};
const IDEMPOTENCY_DAYS = 7;

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
  let rowsProcessed = 0;
  let status: 'success' | 'failure' = 'success';
  let errorMessage: string | null = null;

  try {
    const now = Date.now();
    const recentStart = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const baselineStart = new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString();
    const studentMinAge = new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString();

    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id, teacher_id, name, deleted_at, created_at')
      .is('deleted_at', null)
      .lt('created_at', studentMinAge);
    if (stErr) throw stErr;

    rowsProcessed = students?.length ?? 0;
    if (!students?.length) throw new Error('__noop__');

    const studentIds = students.map(s => s.id);

    const { data: events } = await supabase
      .from('student_events')
      .select('student_id, event_source, created_at')
      .in('student_id', studentIds)
      .gte('created_at', baselineStart);

    const scoreMap = new Map<string, { recent: number; baseline: number }>();
    for (const id of studentIds) scoreMap.set(id, { recent: 0, baseline: 0 });
    for (const ev of events ?? []) {
      const w = WEIGHTS[ev.event_source as string] ?? 0.5;
      const isRecent = ev.created_at >= recentStart;
      const e = scoreMap.get(ev.student_id as string);
      if (!e) continue;
      if (isRecent) e.recent += w;
      else e.baseline += w;
    }

    const idempotencyDate = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD bucket

    for (const s of students) {
      const sc = scoreMap.get(s.id)!;
      if (sc.baseline < 4) continue;
      const ratio = sc.recent / sc.baseline;
      let severity: 'medium' | 'high' | null = null;
      if (sc.recent === 0 && sc.baseline >= 8) severity = 'high';
      else if (ratio < 0.5) severity = 'medium';
      if (!severity) continue;

      const idempotencyKey = `${s.id}-${idempotencyDate.slice(0, 7)}`; // monthly bucket = no spam

      // Check if alert with same key already exists in last IDEMPOTENCY_DAYS
      const sinceCheck = new Date(now - IDEMPOTENCY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('teacher_alerts')
        .select('id')
        .eq('teacher_id', s.teacher_id)
        .eq('alert_type', 'engagement_decay')
        .gte('created_at', sinceCheck)
        .contains('payload', { student_id: s.id })
        .limit(1);
      if (existing && existing.length > 0) continue;

      const dropPct = sc.baseline > 0 ? Math.round((1 - ratio) * 100) : 100;
      await supabase.from('teacher_alerts').insert({
        teacher_id: s.teacher_id,
        alert_type: 'engagement_decay',
        severity,
        title: `${(s as any).name || 'Student'} activity dropped ${dropPct}%`,
        message: `Engagement in the last 14 days fell from ${sc.baseline.toFixed(1)} to ${sc.recent.toFixed(1)} (weighted score). Consider reaching out.`,
        payload: {
          student_id: s.id,
          score_recent: Number(sc.recent.toFixed(2)),
          score_baseline: Number(sc.baseline.toFixed(2)),
          drop_pct: dropPct,
        },
        cta_url: `/student/${s.id}`,
        cta_label: 'View student',
        source_loop_id: LOOP_ID,
        idempotency_key: idempotencyKey,
      });
      alertsEmitted++;
    }
  } catch (err) {
    if (err instanceof Error && err.message === '__noop__') {
      // no eligible students — not a failure
    } else {
      status = 'failure';
      errorMessage = formatErr(err);
    }
  }

  await supabase.from('system_health_metrics').insert({
    loop_id: LOOP_ID,
    run_started_at: startedAt,
    run_finished_at: new Date().toISOString(),
    status,
    alerts_emitted: alertsEmitted,
    rows_processed: rowsProcessed,
    error_message: errorMessage,
  });

  return new Response(
    JSON.stringify({ ok: status === 'success', alertsEmitted, rowsProcessed, errorMessage }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: status === 'success' ? 200 : 500 },
  );
});