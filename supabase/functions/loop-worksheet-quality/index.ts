// Closed-Loop Company — worksheet-quality-feedback aggregator (Wave 1).
// Cadence: weekly Sun 04:00 UTC (configured via pg_cron).
// Input: feedbacks (last 7d), worksheets metadata.
// Output: rows in closed_loop_signals + run log in system_health_metrics.
// Sanctity rule: never auto-mutate worksheet engine prompts.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOOP_ID = 'worksheet-quality-feedback';
const MIN_RATINGS = 5;
const MIN_VIEWS = 20;
const RATING_MEDIUM = 3.5;
const RATING_HIGH = 2.5;

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
  let status: 'success' | 'failure' | 'partial' = 'success';
  let errorMessage: string | null = null;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Pull feedback from last 7 days; worksheets is fetched separately because there is
    // no declared FK between feedbacks.worksheet_id and worksheets (PostgREST cannot embed).
    const { data: feedback, error: fbErr } = await supabase
      .from('feedbacks')
      .select('worksheet_id, rating, created_at')
      .gte('created_at', sevenDaysAgo)
      .not('worksheet_id', 'is', null);
    if (fbErr) throw fbErr;

    rowsProcessed = feedback?.length ?? 0;

    // Hydrate worksheet metadata from form_data jsonb.
    const wsIds = Array.from(new Set((feedback ?? []).map(f => f.worksheet_id).filter(Boolean)));
    const wsMap = new Map<string, Record<string, unknown>>();
    if (wsIds.length) {
      const { data: worksheets, error: wsErr } = await supabase
        .from('worksheets')
        .select('id, form_data')
        .in('id', wsIds);
      if (wsErr) throw wsErr;
      for (const w of worksheets ?? []) {
        wsMap.set(w.id as string, ((w as any).form_data as Record<string, unknown>) ?? {});
      }
    }

    // Group by (exercise_type, cefr, topic_family). topic_family = first word of topic for now.
    const groups = new Map<string, { ratings: number[]; cefr: string; type: string; topicFamily: string }>();
    for (const row of feedback ?? []) {
      const fd = wsMap.get(row.worksheet_id as string) ?? {};
      const cefr = (fd.englishLevel as string) || 'unknown';
      const topicRaw = (fd.lessonTopic as string) || 'unknown';
      const topicFamily = topicRaw.toString().split(/\s+/)[0].toLowerCase();
      const selected = fd.selectedExercises;
      const types: string[] = Array.isArray(selected)
        ? selected
        : selected && typeof selected === 'object'
        ? Object.keys(selected).filter(k => (selected as Record<string, unknown>)[k])
        : [];
      const typeList = types.length ? types : ['unknown'];
      for (const t of typeList) {
        const key = `${t}|${cefr}|${topicFamily}`;
        if (!groups.has(key)) groups.set(key, { ratings: [], cefr, type: t, topicFamily });
        groups.get(key)!.ratings.push(row.rating);
      }
    }

    for (const [, g] of groups) {
      if (g.ratings.length < MIN_RATINGS) continue;
      const avg = g.ratings.reduce((s, n) => s + n, 0) / g.ratings.length;
      if (avg >= RATING_MEDIUM) continue;
      const severity = avg < RATING_HIGH ? 'high' : 'medium';
      const payload = {
        exercise_type: g.type,
        cefr: g.cefr,
        topic_family: g.topicFamily,
        n_ratings: g.ratings.length,
        avg_rating: Number(avg.toFixed(2)),
        suggested_prompt_to_audit: 'worksheet-individual-exercises',
        window_days: 7,
      };
      await supabase.from('closed_loop_signals').insert({
        loop_id: LOOP_ID,
        severity,
        payload,
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