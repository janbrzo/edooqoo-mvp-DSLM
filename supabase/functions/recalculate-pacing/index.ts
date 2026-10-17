// recalculate-pacing: v7
// Computes a fresh DSLM pacing index (0-100). Two modes:
//   - 'apply'    (default): persists to students.dslm_pacing_mode immediately
//   - 'proposal': inserts a row into pacing_proposals (status='pending')
//                 and DOES NOT mutate students.dslm_pacing_mode
//
// v6.3: deterministic deadline-override scale (≤2w forces Pragmatic 100),
//       self-profile signals from student_knowledge_entries (Self-Profile).
// v7 (iteration 5): signals computed by _shared/pacing.ts (computeStylePacing);
//       Welcome Test signals read from real student_learning_profiles columns;
//       deadline floors applied last; Learning Path intensity reported separately
//       (computeIntensity) and never changes the style pacing number.
// v8 (Stage 4): style pacing reads the triangulated study capacity (q5c over q5);
//       Decision 5: the FIRST Welcome Test proposal is applied automatically
//       (shouldAutoApplyInitialWtPacing) and recorded as an accepted proposal with
//       trigger_details.reason 'welcome_test_initial_auto' (previous values kept
//       there so the teacher can undo); later retakes keep the approval flow.
//
// Body: { studentId, teacherId, mode?, triggerType?, triggerDetails? }
// Output: { pacingMode, reasoning, intensity, mode, proposalId?, skipped?: boolean }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authorizedTeacherId, jsonResponse, resolveCaller } from "../_shared/auth.ts";
import {
  computeIntensity,
  computeStylePacing,
  loadLearningProfileForPacing,
  selfProfileFromEntries,
  shouldAutoApplyInitialWtPacing,
  WT_INITIAL_AUTO_REASON,
} from "../_shared/pacing.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    // Teachers may only recalculate their own students; crons and other edge
    // functions call with the service role key.
    if (!authorizedTeacherId(await resolveCaller(req), teacherId)) {
      return jsonResponse({ error: 'Forbidden' }, 403, corsHeaders);
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

    // v6.3 Deadline-First Override scans ALL active goals (main + supporting +
    // additional) and the legacy students.main_goal_target_date.
    const { data: progressGoals, error: gErr } = await supabase
      .from('student_progress_goals')
      .select('goal_type, target_date, title, is_achieved, archived_at, deleted_at')
      .eq('student_id', studentId).eq('teacher_id', teacherId)
      .is('deleted_at', null).is('archived_at', null).eq('is_achieved', false);
    if (gErr) console.warn('[recalculate-pacing] goals read failed', gErr.message);

    // Welcome Test profile: real columns only (level_confidence, anxiety_level,
    // error_attitude, weekly_study_time, learning_path with raw_answers fallback).
    const { profile, error: profileErr } = await loadLearningProfileForPacing(supabase, studentId, teacherId);
    if (profileErr) console.warn('[recalculate-pacing] learning profile read failed', profileErr);

    // Self-Profile signals (Student Hub "Tell us about yourself")
    const { data: selfEntries, error: spErr } = await supabase
      .from('student_knowledge_entries')
      .select('metadata, content')
      .eq('student_id', studentId).eq('teacher_id', teacherId)
      .eq('category', 'Self-Profile').is('deleted_at', null);
    if (spErr) console.warn('[recalculate-pacing] self-profile read failed', spErr.message);

    const now = Date.now();
    const style = computeStylePacing({
      student: student as any,
      goals: (progressGoals || []) as any[],
      metrics: (Array.isArray(metrics) ? metrics : []) as any[],
      profile,
      selfProfile: selfProfileFromEntries((selfEntries || []) as any[]),
      now,
    });
    const pacingMode = style.pacing;
    const reasoning = style.reasoning;
    const intensity = computeIntensity(profile?.learning_path ?? null, style.deadlineDays);

    const currentPacing = Number((student as any).dslm_pacing_mode ?? 50);

    // Always update last_pacing_recalc_at + reasoning snapshot so the slider popover
    // can show "Last calculation" even for proposal-mode runs that the teacher hasn't accepted yet.
    await supabase.from('students')
      .update({
        last_pacing_recalc_at: new Date().toISOString(),
        last_pacing_reasoning: { reasoning, proposed: pacingMode, current: currentPacing, mode, triggerType, at: new Date().toISOString(), intensity },
      } as any)
      .eq('id', studentId).eq('teacher_id', teacherId);

    if (mode === 'apply') {
      await supabase.from('students')
        .update({ dslm_pacing_mode: pacingMode, last_pacing_set_manually: false } as any)
        .eq('id', studentId).eq('teacher_id', teacherId);
      return new Response(JSON.stringify({ pacingMode, proposed: pacingMode, current: currentPacing, reasoning, intensity, mode: 'apply' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decision 5: first Welcome Test proposal for a student is applied, not left pending.
    if (triggerType === 'placement_test') {
      const { data: earlier, error: eErr } = await supabase.from('pacing_proposals')
        .select('id')
        .eq('student_id', studentId).eq('teacher_id', teacherId)
        .in('status', ['accepted', 'applied'])
        .limit(1);
      const flag = (student as any).last_pacing_set_manually;
      // A failed lookup must not auto-apply: fall through to the approval flow.
      if (!eErr && shouldAutoApplyInitialWtPacing({
        triggerType,
        lastPacingSetManually: typeof flag === 'boolean' ? flag : null,
        hasEarlierAppliedProposal: (earlier || []).length > 0,
      })) {
        const decidedAt = new Date().toISOString();
        const { error: aErr } = await supabase.from('students')
          .update({ dslm_pacing_mode: pacingMode, last_pacing_set_manually: false } as any)
          .eq('id', studentId).eq('teacher_id', teacherId);
        if (aErr) throw aErr;
        await supabase.from('pacing_proposals')
          .update({ status: 'superseded', decided_at: decidedAt })
          .eq('student_id', studentId).eq('status', 'pending');
        const { data: applied, error: iErr } = await supabase.from('pacing_proposals')
          .insert({
            student_id: studentId,
            teacher_id: teacherId,
            trigger_type: triggerType,
            trigger_details: {
              ...triggerDetails,
              intensity,
              reason: WT_INITIAL_AUTO_REASON,
              previous_pacing: currentPacing,
              previous_last_pacing_set_manually: typeof flag === 'boolean' ? flag : null,
            },
            current_pacing: currentPacing,
            proposed_pacing: pacingMode,
            reasoning,
            status: 'accepted',
            decided_at: decidedAt,
          })
          .select('id')
          .single();
        if (iErr) console.warn('[recalculate-pacing] auto-applied proposal record failed', iErr.message);
        return new Response(JSON.stringify({
          pacingMode, proposed: pacingMode, current: currentPacing, reasoning, intensity,
          mode: 'proposal', autoApplied: true, reason: WT_INITIAL_AUTO_REASON, proposalId: applied?.id,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // proposal mode: dynamic threshold: 3 for goal_added (manual UX-sensitive), 5 for cron
    const threshold = triggerType === 'goal_added' ? 3 : 5;
    if (Math.abs(pacingMode - currentPacing) < threshold) {
      return new Response(JSON.stringify({
        pacingMode, proposed: pacingMode, current: currentPacing, reasoning, intensity, mode: 'proposal', skipped: true,
        skipReason: `Δ ${Math.abs(pacingMode - currentPacing)} < ${threshold}; no proposal created`,
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
        trigger_details: { ...triggerDetails, intensity },
        current_pacing: currentPacing,
        proposed_pacing: pacingMode,
        reasoning,
        status: 'pending',
      })
      .select('id')
      .single();
    if (pErr) throw pErr;

    return new Response(JSON.stringify({
      pacingMode, proposed: pacingMode, current: currentPacing, reasoning, intensity,
      mode: 'proposal', proposalId: proposal.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('recalculate-pacing error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
