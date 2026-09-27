// recalculate-pacing — v6.3
// Computes a fresh DSLM pacing index (0-100). Two modes:
//   - 'apply'    (default): persists to students.dslm_pacing_mode immediately
//   - 'proposal': inserts a row into pacing_proposals (status='pending')
//                 and DOES NOT mutate students.dslm_pacing_mode
//
// v6.3: deterministic deadline-override scale (≤2w forces Pragmatic 100),
//       extended behavioral signals from student_learning_profiles,
//       self-profile signals from student_knowledge_entries (Self-Profile).
//
// Body: { studentId, teacherId, mode?, triggerType?, triggerDetails? }
// Output: { pacingMode, reasoning, mode, proposalId?, skipped?: boolean }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { studentId, teacherId } = body;
    const mode: 'apply' | 'proposal' = body.mode === 'proposal' ? 'proposal' : 'apply';
    const triggerType: string = typeof body.triggerType === 'string' ? body.triggerType : 'manual';
    const triggerDetails = (body.triggerDetails && typeof body.triggerDetails === 'object') ? body.triggerDetails : {};
    if (!studentId || !teacherId) {
      return new Response(JSON.stringify({ error: 'studentId and teacherId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: student, error: sErr } = await supabase
      .from('students').select('*').eq('id', studentId).eq('teacher_id', teacherId).single();
    if (sErr || !student) throw new Error('Student not found');

    const { data: metrics } = await supabase
      .from('student_skill_metrics' as any)
      .select('*')
      .eq('student_id', studentId)
      .gte('updated_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .limit(200);

    const reasoning: string[] = [];
    let p = 50;

    // Goal keywords
    const goal = (student.main_goal || '').toLowerCase();
    if (/academic|exam|cae|fce|cpe|ielts|toefl/.test(goal)) { p -= 30; reasoning.push('Academic/exam goal → −30 (Scientific)'); }
    if (/work|business|career|travel|conversation|social|meeting|interview/.test(goal)) { p += 20; reasoning.push('Work/travel/conversation goal → +20 (Pragmatic)'); }

    // v6.3 Deadline-First Override.
    // Scan ALL active goals (main + supporting + additional) and the legacy
    // students.main_goal_target_date. The shortest effective deadline wins —
    // a real-world time constraint trumps other signals.
    const { data: progressGoals } = await supabase
      .from('student_progress_goals')
      .select('goal_type, target_date, title, is_achieved, archived_at, deleted_at')
      .eq('student_id', studentId).eq('teacher_id', teacherId)
      .is('deleted_at', null).is('archived_at', null).eq('is_achieved', false);
    const activeGoals = (progressGoals || []).filter((g: any) => g.target_date);
    const allDeadlineDays: number[] = [];
    if ((student as any).main_goal_target_date) {
      allDeadlineDays.push(Math.round((new Date((student as any).main_goal_target_date).getTime() - Date.now()) / 86400000));
    }
    for (const g of activeGoals) {
      allDeadlineDays.push(Math.round((new Date(g.target_date).getTime() - Date.now()) / 86400000));
    }
    const effectiveDays = allDeadlineDays.length > 0 ? Math.min(...allDeadlineDays) : Number.POSITIVE_INFINITY;
    if (effectiveDays !== Number.POSITIVE_INFINITY) {
      if (effectiveDays <= 0)        { p = 100;                   reasoning.push(`Overdue deadline (${effectiveDays}d) → forced Pragmatic 100`); }
      else if (effectiveDays <= 14)  { p = Math.max(p, 100);      reasoning.push(`Deadline ≤2 weeks (${effectiveDays}d) → forced Pragmatic 100 (no time for fundamentals)`); }
      else if (effectiveDays <= 30)  { p = Math.max(p + 25, 75);  reasoning.push(`Deadline ≤30 days (${effectiveDays}d) → +25, floor 75 (Pragmatic)`); }
      else if (effectiveDays <= 90)  { p = Math.max(p + 15, 50);  reasoning.push(`Deadline ≤90 days (${effectiveDays}d) → +15, floor 50`); }
      else if (effectiveDays <= 180) { p += 5;                    reasoning.push(`Deadline ≤180 days (${effectiveDays}d) → +5`); }
      else                           { p -= 5;                    reasoning.push(`Deadline >180 days (${effectiveDays}d) → −5 (room for fundamentals)`); }
    }
    // Pressure aggregation across multiple urgent goals (≤90d)
    const urgentCount = allDeadlineDays.filter(d => d <= 90 && d > 14).length;
    if (urgentCount >= 3) { p += 10; reasoning.push(`${urgentCount} concurrent urgent deadlines (≤90d) → +10`); }
    // Goal title keyword scan
    const goalTitles = activeGoals.map((g: any) => String(g.title || '').toLowerCase()).join(' ');
    if (/exam|test|certif|ielts|cae|fce|toefl|cpe/.test(goalTitles)) { p -= 15; reasoning.push('Exam/cert keywords in active goals → −15 (Scientific)'); }
    if (/work|business|meeting|interview|presentation|email/.test(goalTitles)) { p += 10; reasoning.push('Work/business keywords in active goals → +10 (Pragmatic)'); }

    // Level
    const lvl = (student.english_level || '').toUpperCase();
    if (lvl.startsWith('A')) { p -= 10; reasoning.push('Level A1/A2 → −10 (Scientific)'); }

    // Mastery signals (v4.7 NEW)
    const arr = Array.isArray(metrics) ? metrics : [];
    const isOutput = (m: any) => /speak|writ|product/i.test(`${m.skill_category || ''} ${m.skill_name || ''} ${m.micro_skill || ''}`);
    const isInput = (m: any) => /read|listen|recept/i.test(`${m.skill_category || ''} ${m.skill_name || ''} ${m.micro_skill || ''}`);
    const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    const outAvg = avg(arr.filter(isOutput).map((m: any) => Number(m.current_mastery) || 0));
    const inAvg = avg(arr.filter(isInput).map((m: any) => Number(m.current_mastery) || 0));
    if (outAvg !== null && outAvg < 40) { p -= 10; reasoning.push(`Output mastery ${Math.round(outAvg)}% < 40 → −10 (more input)`); }
    if (inAvg !== null && inAvg > 80) { p += 15; reasoning.push(`Input mastery ${Math.round(inAvg)}% > 80 → +15 (more output)`); }

    // Trend signal
    const recent = arr.slice(0, 5);
    const declining = recent.filter((m: any) => m.trend === 'declining').length;
    if (declining >= 3) { p -= 10; reasoning.push(`${declining}/5 recent skills declining → −10 (consolidate)`); }

    // v6.3 — Behavioral signals from welcome test profile
    const { data: profile } = await supabase
      .from('student_learning_profiles' as any)
      .select('behavioral_traits, level_confidence, output_readiness')
      .eq('student_id', studentId).eq('teacher_id', teacherId).maybeSingle();
    const t: any = (profile as any)?.behavioral_traits || {};
    if (t.prefers_speaking || t.high_output_drive)   { p += 8;  reasoning.push('Output-driven learner (welcome test) → +8 (Pragmatic)'); }
    if (t.prefers_reading || t.text_comfort_high)    { p -= 5;  reasoning.push('Input-comfort learner (welcome test) → −5'); }
    if (t.high_anxiety || t.perfectionist)           { p -= 10; reasoning.push('High anxiety / perfectionist → −10 (slower, structured)'); }
    if (t.risk_taker || t.high_engagement)           { p += 5;  reasoning.push('Risk-taker / high engagement → +5'); }
    if (t.hesitations || t.errors)                   { p -= 5;  reasoning.push('Frequent hesitations/errors → −5'); }
    if (t.fluency)                                   { p += 5;  reasoning.push('High fluency signals → +5'); }
    const lc = (profile as any)?.level_confidence;
    if (lc === 'overestimates')                      { p -= 5;  reasoning.push('Self-overestimates level → −5 (consolidate basics)'); }
    if (lc === 'underestimates')                     { p += 5;  reasoning.push('Self-underestimates level → +5 (push output)'); }
    const outR = (profile as any)?.output_readiness;
    if (typeof outR === 'number') {
      if (outR < 40) { p -= 5; reasoning.push(`Low output readiness ${outR}% → −5`); }
      if (outR > 75) { p += 5; reasoning.push(`High output readiness ${outR}% → +5`); }
    }

    // v6.3 — Self-Profile signals (Student Hub "Tell us about yourself")
    const { data: selfEntries } = await supabase
      .from('student_knowledge_entries')
      .select('metadata, content')
      .eq('student_id', studentId).eq('teacher_id', teacherId)
      .eq('category', 'Self-Profile').is('deleted_at', null);
    const sp: Record<string, any> = {};
    for (const e of (selfEntries || []) as any[]) {
      const f = e?.metadata?.field;
      if (f && sp[f] === undefined) sp[f] = e?.metadata?.raw_value ?? e.content;
    }
    // v6.8.6 — Self-Profile mapper aligned with src/constants/studentSelfProfile.ts.
    // Source of truth = the UI enum. Legacy values from older entries are
    // normalised via alias dictionaries (zero-data-migration backward compat).
    const LEGACY_OBSTACLE_ALIASES: Record<string, string> = {
      'Lack of time': 'Time',
      'Tiredness': 'Time',
      'Anxiety': 'Confidence',
      'Fear of mistakes': 'Confidence',
    };
    const LEGACY_MOTIVATION_ALIASES: Record<string, string> = {
      'Career advancement': 'Career growth',
      'Job change': 'Career growth',
      'Exam preparation': 'Specific exam',
    };
    const LEGACY_STYLE_ALIASES: Record<string, string> = {
      'Conversation-first': 'Auditory',
      'Grammar-first': 'Reading-Writing',
    };
    const normalize = (v: unknown, dict: Record<string, string>): string =>
      typeof v === 'string' ? (dict[v] ?? v) : '';

    const rawObstacles: string[] = Array.isArray(sp.learning_obstacles) ? sp.learning_obstacles : [];
    const obstacles: string[] = rawObstacles.map(o => LEGACY_OBSTACLE_ALIASES[o] ?? o);
    const motivation: string = normalize(sp.motivation_driver, LEGACY_MOTIVATION_ALIASES);
    const style: string = normalize(sp.learning_style_pref, LEGACY_STYLE_ALIASES);

    // Obstacles (multi-select). Each independent, additive.
    if (obstacles.includes('Time'))            { p += 8; reasoning.push('Self-reported time constraint → +8 (high-leverage tasks)'); }
    if (obstacles.includes('Confidence'))      { p -= 8; reasoning.push('Low speaking confidence → −8 (safer scaffolded progression)'); }
    if (obstacles.includes('Pronunciation'))   { p -= 3; reasoning.push('Pronunciation focus → −3 (controlled output)'); }
    if (obstacles.includes('Grammar'))         { p -= 5; reasoning.push('Grammar accuracy obstacle → −5 (consolidate rules)'); }
    if (obstacles.includes('Vocabulary'))      { p -= 3; reasoning.push('Vocabulary gap → −3 (input-rich tasks)'); }
    if (obstacles.includes('Listening speed')) { p -= 3; reasoning.push('Listening speed challenge → −3 (slower pacing)'); }

    // Motivation driver (single select).
    if (motivation === 'Career growth')   { p += 5;  reasoning.push('Career-driven motivation → +5 (real-world Pragmatic)'); }
    if (motivation === 'Specific exam')   { p -= 10; reasoning.push('Exam-driven motivation → −10 (Scientific structure)'); }
    if (motivation === 'Travel')          { p += 3;  reasoning.push('Travel goal → +3 (conversational priority)'); }
    if (motivation === 'Hobby')           { p -= 3;  reasoning.push('Hobby motivation → −3 (comfortable pace)'); }
    // 'Daily life' = neutral, no adjustment.

    // Learning style preference (single select).
    if (style === 'Auditory')        { p += 5; reasoning.push('Auditory learner → +5 (conversation-heavy)'); }
    if (style === 'Kinesthetic')     { p += 5; reasoning.push('Kinesthetic learner → +5 (role-play, doing)'); }
    if (style === 'Visual')          { p -= 3; reasoning.push('Visual learner → −3 (structured input)'); }
    if (style === 'Reading-Writing') { p -= 5; reasoning.push('Reading-Writing learner → −5 (text-heavy Scientific)'); }

    // Weekly time availability (slider 1-15h).
    if (typeof sp.time_availability_per_week === 'number') {
      if (sp.time_availability_per_week < 3)      { p -= 5; reasoning.push(`Only ${sp.time_availability_per_week}h/week → −5 (consolidate, don't push)`); }
      else if (sp.time_availability_per_week > 7) { p += 5; reasoning.push(`${sp.time_availability_per_week}h/week available → +5 (sustained Pragmatic load)`); }
    }

    const pacingMode = clamp(p, 0, 100);
    if (reasoning.length === 0) reasoning.push('No strong signals — defaulting near 50.');

    const currentPacing = Number((student as any).dslm_pacing_mode ?? 50);

    // Always update last_pacing_recalc_at + reasoning snapshot so the slider popover
    // can show "Last calculation" even for proposal-mode runs that the teacher hasn't accepted yet.
    await supabase.from('students')
      .update({
        last_pacing_recalc_at: new Date().toISOString(),
        last_pacing_reasoning: { reasoning, proposed: pacingMode, current: currentPacing, mode, triggerType, at: new Date().toISOString() },
      } as any)
      .eq('id', studentId).eq('teacher_id', teacherId);

    if (mode === 'apply') {
      await supabase.from('students')
        .update({ dslm_pacing_mode: pacingMode, last_pacing_set_manually: false } as any)
        .eq('id', studentId).eq('teacher_id', teacherId);
      return new Response(JSON.stringify({ pacingMode, proposed: pacingMode, current: currentPacing, reasoning, mode: 'apply' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // proposal mode — dynamic threshold: 3 for goal_added (manual UX-sensitive), 5 for cron
    const threshold = triggerType === 'goal_added' ? 3 : 5;
    if (Math.abs(pacingMode - currentPacing) < threshold) {
      return new Response(JSON.stringify({
        pacingMode, proposed: pacingMode, current: currentPacing, reasoning, mode: 'proposal', skipped: true,
        skipReason: `Δ ${Math.abs(pacingMode - currentPacing)} < ${threshold} — no proposal created`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Supersede any existing pending proposal for this student
    await supabase.from('pacing_proposals')
      .update({ status: 'superseded', decided_at: new Date().toISOString() })
      .eq('student_id', studentId).eq('status', 'pending');

    const { data: proposal, error: pErr } = await supabase
      .from('pacing_proposals')
      .insert({
        student_id: studentId,
        teacher_id: teacherId,
        trigger_type: triggerType,
        trigger_details: triggerDetails,
        current_pacing: currentPacing,
        proposed_pacing: pacingMode,
        reasoning,
        status: 'pending',
      })
      .select('id')
      .single();
    if (pErr) throw pErr;

    return new Response(JSON.stringify({
      pacingMode, proposed: pacingMode, current: currentPacing, reasoning,
      mode: 'proposal', proposalId: proposal.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('recalculate-pacing error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
