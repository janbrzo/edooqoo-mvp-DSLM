/**
 * generate-curriculum-phases — DSLM Pathway v3 (Macro Timeline)
 * v6.9.13: HARD DEADLINE FIT — sum of phase weeks must NEVER exceed weeksUntilDeadline.
 * Strategy:
 *   1. Prompt-level constraint: AI is told the exact target totalWeeks budget.
 *   2. Server-level safety net: post-AI scaling/clipping rebases week ranges so
 *      sum(end-start+1) <= targetWeeks. Min 2 weeks per phase. Sequential, no gaps.
 * Generates 3-5 macro learning phases (curriculum blocks) for a student,
 * distributed against the deadline (main_goal_target_date) when present.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";

// v6.9.13 — helpers inlined (previously imported from ../_shared/dslmPromptCore.ts).
// Inlined to keep deploy self-contained. Behavior preserved.
function computePacingIndex(student: any, weeksUntilDeadline: number | null): number {
  const stored = Number.isFinite(student?.dslm_pacing_mode) ? Number(student.dslm_pacing_mode) : 50;
  if (stored !== 50) return Math.max(0, Math.min(100, stored));
  // Auto: tighter deadline → more pragmatic (higher index).
  if (weeksUntilDeadline === null) return 50;
  if (weeksUntilDeadline <= 8) return 80;
  if (weeksUntilDeadline <= 16) return 65;
  if (weeksUntilDeadline <= 32) return 50;
  return 35;
}
function pacingLabel(p: number): string {
  if (p >= 75) return 'Pragmatic';
  if (p >= 55) return 'Balanced-Pragmatic';
  if (p >= 45) return 'Balanced';
  if (p >= 25) return 'Balanced-Scientific';
  return 'Scientific';
}
function buildScientificPrinciplesBlock(level: string, pacing: number): string {
  return `LEARNING SCIENCE FRAMEWORK (level=${level || 'unknown'}, pacing=${pacing}/100):
- Apply Task-Based Language Teaching (TBLT) — every phase frames a real adult outcome.
- Spaced retrieval across phases; weak skills resurface in later phases under new tasks.
- Pragmatic mode = front-load the deadline-blocking outcome; Scientific mode = solidify foundations first.`;
}
function buildStudentProfileBlock(student: any, _pacing: number): string {
  return `STUDENT PROFILE:
- Name: ${student?.name || 'Unknown'}
- Level: ${student?.english_level || 'unknown'}
- Main goal: ${student?.main_goal || 'not set'}`;
}
function buildWeakAreasBlock(metrics: any[], limit: number): string {
  if (!metrics?.length) return '(no skill metrics yet)';
  return metrics.slice(0, limit).map((m: any) => {
    const age = m.updated_at ? Math.round((Date.now() - new Date(m.updated_at).getTime()) / (1000*60*60*24)) : null;
    return `- ${m.skill_category || ''}/${m.micro_skill || m.skill_name}: mastery=${m.current_mastery}, trend=${m.trend || 'flat'}${age !== null ? `, ${age}d old` : ''}`;
  }).join('\n  ');
}
function buildKnowledgeBlock(notes: any[], limit: number): string {
  if (!notes?.length) return '(no notes)';
  return notes.slice(0, limit).map((n: any) => `- [${n.category || 'general'}] ${String(n.content || '').slice(0, 200)}`).join('\n  ');
}
function buildWorksheetHistoryBlock(ws: any[], limit: number): string {
  if (!ws?.length) return '(no prior worksheets)';
  return ws.slice(0, limit).map((w: any) => `- ${w.topic} (${new Date(w.created_at).toISOString().slice(0,10)})`).join('\n  ');
}
function buildGoalsBlock(goals: any[]): string {
  if (!goals?.length) return '(no active goals)';
  return goals.map((g: any) => {
    const dl = g.target_date ? ` [DEADLINE: ${g.target_date}]` : '';
    return `- (${g.goal_type || 'goal'}) ${g.title}${dl}${g.description ? ` — ${g.description}` : ''}`;
  }).join('\n');
}
function buildExistingPhasesBlock(phases: any[]): string {
  if (!phases?.length) return '(none — fresh roadmap)';
  return phases.map((p: any) =>
    `- #${p.sequence_number} [${p.status}] "${p.title}" weeks ${p.estimated_weeks_start || '?'}-${p.estimated_weeks_end || '?'} focus=[${(p.focus_areas || []).join(', ')}]`
  ).join('\n');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * v6.9.13 — Server-side safety net.
 * Forces sum of phase weeks to fit within targetWeeks. Idempotent.
 * Rules:
 *   - Phases keep their order.
 *   - Each phase has minWeeks=2 (or floor(targetWeeks/phaseCount) if smaller).
 *   - Remaining weeks distributed proportionally to AI's original durations.
 *   - Output: contiguous integer ranges starting at week 1, no gaps, no overlaps.
 */
function fitPhasesToDeadline(
  phases: any[],
  targetWeeks: number | null,
  startingWeek: number = 1,
): { phases: any[]; adjusted: boolean } {
  if (!targetWeeks || !Array.isArray(phases) || phases.length === 0) {
    return { phases, adjusted: false };
  }
  const n = phases.length;
  const minWeeks = Math.max(1, Math.min(2, Math.floor(targetWeeks / n) || 1));
  if (minWeeks * n > targetWeeks) {
    // Cannot honor min — distribute as evenly as possible (every phase = 1 week up to budget)
    let cursor = Math.max(1, startingWeek);
    const lastWeek = cursor + targetWeeks - 1;
    const out = phases.map((p, i) => {
      const end = i === n - 1 ? lastWeek : Math.min(lastWeek, cursor);
      const fixed = { ...p, estimated_weeks_start: cursor, estimated_weeks_end: end };
      cursor = end + 1;
      return fixed;
    });
    return { phases: out, adjusted: true };
  }

  // 1. Read AI durations (fallback = 4)
  const aiDur = phases.map((p) => {
    const s = Number.isInteger(p.estimated_weeks_start) ? p.estimated_weeks_start : null;
    const e = Number.isInteger(p.estimated_weeks_end) ? p.estimated_weeks_end : null;
    return s !== null && e !== null && e >= s ? (e - s + 1) : 4;
  });
  const aiSum = aiDur.reduce((a, b) => a + b, 0);

  let durations: number[];
  if (aiSum <= targetWeeks) {
    // AI already fits — keep as-is, just renormalize to contiguous ranges from week 1.
    durations = aiDur.map((d) => Math.max(minWeeks, d));
    const sum0 = durations.reduce((a, b) => a + b, 0);
    if (sum0 > targetWeeks) {
      // bumping to minWeeks pushed past budget — fall through to scaling
      durations = aiDur;
    } else {
      // Distribute leftover slack to last phase
      const leftover = targetWeeks - sum0;
      durations[durations.length - 1] += leftover;
      return { phases: rebaseFromWeek(phases, durations, startingWeek), adjusted: aiSum !== targetWeeks };
    }
  }

  // 2. Scale proportionally so sum == targetWeeks, respecting minWeeks
  const scalable = targetWeeks - minWeeks * n;
  const aiScalable = Math.max(1, aiSum - minWeeks * n);
  durations = aiDur.map((d) => {
    const extra = Math.max(0, d - minWeeks);
    return minWeeks + Math.floor((extra * scalable) / aiScalable);
  });
  // Fix rounding drift — push to last phase
  let drift = targetWeeks - durations.reduce((a, b) => a + b, 0);
  durations[durations.length - 1] += drift;
  // Guard against negatives from drift
  if (durations[durations.length - 1] < minWeeks) {
    durations[durations.length - 1] = minWeeks;
    // re-normalize: scale down longest until sum matches
    while (durations.reduce((a, b) => a + b, 0) > targetWeeks) {
      const maxIdx = durations.indexOf(Math.max(...durations));
      if (durations[maxIdx] <= minWeeks) break;
      durations[maxIdx] -= 1;
    }
  }

  return { phases: rebaseFromWeek(phases, durations, startingWeek), adjusted: true };
}

function rebase(phases: any[], durations: number[]): any[] {
  return rebaseFromWeek(phases, durations, 1);
}

function rebaseFromWeek(phases: any[], durations: number[], startingWeek: number): any[] {
  let cursor = Math.max(1, Number.isInteger(startingWeek) ? startingWeek : 1);
  return phases.map((p, i) => {
    const start = cursor;
    const end = cursor + durations[i] - 1;
    cursor = end + 1;
    return { ...p, estimated_weeks_start: start, estimated_weeks_end: end };
  });
}

const normalizePhaseStatus = (status: any): string =>
  String(status ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const normalizeNullableInteger = (value: any): number | null => {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

const normalizeStringArray = (value: any): string[] =>
  Array.isArray(value) ? value.map(String) : [];

interface PhaseSnapshot {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  sequence_number: number | null;
  estimated_weeks_start: number | null;
  estimated_weeks_end: number | null;
  focus_areas: string[];
  rationale: string | null;
  deleted_at: string | null;
}

function phaseSnapshot(phase: any): PhaseSnapshot {
  return {
    id: String(phase.id),
    title: phase.title ?? null,
    description: phase.description ?? null,
    status: normalizePhaseStatus(phase.status),
    sequence_number: normalizeNullableInteger(phase.sequence_number),
    estimated_weeks_start: normalizeNullableInteger(phase.estimated_weeks_start),
    estimated_weeks_end: normalizeNullableInteger(phase.estimated_weeks_end),
    focus_areas: normalizeStringArray(phase.focus_areas),
    rationale: phase.rationale ?? null,
    deleted_at: phase.deleted_at ?? null,
  };
}

function phaseSnapshotMap(phases: any[]): Map<string, PhaseSnapshot> {
  const out = new Map<string, PhaseSnapshot>();
  for (const phase of phases || []) {
    const snap = phaseSnapshot(phase);
    out.set(snap.id, snap);
  }
  return out;
}

function diffPhaseSnapshots(expected: Map<string, PhaseSnapshot>, actual: Map<string, PhaseSnapshot>) {
  const diffs: any[] = [];
  for (const [id, before] of expected.entries()) {
    const after = actual.get(id);
    if (!after) {
      diffs.push({ id, reason: 'missing' });
      continue;
    }
    for (const field of Object.keys(before) as (keyof PhaseSnapshot)[]) {
      if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
        diffs.push({ id, field, before: before[field], after: after[field] });
      }
    }
  }
  return diffs;
}

function suggestionBindingMap(rows: any[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const row of rows || []) {
    out.set(String(row.id), row.phase_id ? String(row.phase_id) : null);
  }
  return out;
}

function diffSuggestionBindings(expected: Map<string, string | null>, actual: Map<string, string | null>) {
  const diffs: any[] = [];
  for (const [id, beforePhaseId] of expected.entries()) {
    if (!actual.has(id)) {
      diffs.push({ id, reason: 'missing' });
      continue;
    }
    const afterPhaseId = actual.get(id) ?? null;
    if (beforePhaseId !== afterPhaseId) {
      diffs.push({ id, before_phase_id: beforePhaseId, after_phase_id: afterPhaseId });
    }
  }
  return diffs;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      studentId,
      teacherId,
      mode = 'replace',
      count: rawCount,
      teacherComment = '',
      weeksPerPhase: rawWeeksPerPhase,
      phaseWeekTargets: rawPhaseWeekTargets,
      focusedGoalIds: rawFocusedGoalIds,
    } = await req.json();

    if (!studentId || !teacherId) {
      return new Response(
        JSON.stringify({ error: 'Missing studentId or teacherId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch context in parallel
    const [studentRes, metricsRes, knowledgeRes, goalsRes, worksheetsRes, existingPhasesRes] = await Promise.all([
      supabase
        .from('students')
        .select('name, english_level, main_goal, main_goal_target_date, dslm_pacing_mode, dslm_use_roadmap')
        .eq('id', studentId)
        .eq('teacher_id', teacherId)
        .single(),
      supabase
        .from('student_skill_metrics')
        .select('skill_name, skill_category, micro_skill, current_mastery, trend, updated_at')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .order('current_mastery', { ascending: true })
        .limit(80),
      supabase
        .from('student_knowledge_entries')
        .select('content, category')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .is('is_outdated', false)
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('student_progress_goals')
        .select('title, description, goal_type, is_achieved, target_date')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .eq('is_achieved', false),
      supabase
        .from('worksheets')
        .select('topic, created_at')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('dslm_curriculum_phases')
        .select('id, sequence_number, status, title, description, focus_areas, estimated_weeks_start, estimated_weeks_end, rationale, deleted_at')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .order('sequence_number', { ascending: true }),
    ]);

    const student = studentRes.data;
    if (!student) {
      return new Response(
        JSON.stringify({ error: 'Student not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metrics = metricsRes.data || [];
    const knowledge = knowledgeRes.data || [];
    const goals = goalsRes.data || [];
    const worksheets = worksheetsRes.data || [];
    const existingPhases = existingPhasesRes.data || [];

    // v6.9.46 — hard preservation invariant: done AND in_progress phases are
    // normalized and snapshotted before any write. Only planned/draft rows are
    // replaceable; unknown legacy statuses are protected and logged.
    const KEPT_STATUSES = ['done', 'in_progress'];
    const REPLACEABLE_STATUSES = ['planned', 'draft'];
    const isKeptPhase = (status: any) => KEPT_STATUSES.includes(normalizePhaseStatus(status));
    const isReplaceablePhase = (status: any) => REPLACEABLE_STATUSES.includes(normalizePhaseStatus(status));
    const keptPhases = existingPhases.filter((p: any) => isKeptPhase(p.status));
    const replaceablePhases = existingPhases.filter((p: any) => isReplaceablePhase(p.status));
    const protectedPhases = existingPhases.filter((p: any) => !isReplaceablePhase(p.status));
    const unknownStatusPhases = existingPhases
      .filter((p: any) => !isKeptPhase(p.status) && !isReplaceablePhase(p.status))
      .map((p: any) => ({ id: p.id, status: p.status }));
    const keptPhaseIds: string[] = keptPhases.map((p: any) => p.id);
    const replaceablePhaseIds: string[] = replaceablePhases.map((p: any) => p.id);
    const protectedPhaseIds: string[] = protectedPhases.map((p: any) => p.id);
    const keptPhaseSnapshotMap = phaseSnapshotMap(keptPhases);
    const hasKeptInProgress = keptPhases.some((p: any) => normalizePhaseStatus(p.status) === 'in_progress');
    const keptWeeksConsumed = keptPhases.reduce((acc: number, p: any) => {
      const s = Number.isInteger(p.estimated_weeks_start) ? p.estimated_weeks_start : 0;
      const e = Number.isInteger(p.estimated_weeks_end) ? p.estimated_weeks_end : 0;
      return Math.max(acc, e || s || 0);
    }, 0);
    let keptSuggestionRows: any[] = [];
    if (keptPhaseIds.length > 0) {
      const { data: keptSuggestionData, error: keptSuggestionErr } = await supabase
        .from('future_worksheet_suggestions')
        .select('id, phase_id')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .in('phase_id', keptPhaseIds);
      if (keptSuggestionErr) {
        console.error('Failed to read kept phase suggestion bindings', keptSuggestionErr);
        throw keptSuggestionErr;
      }
      keptSuggestionRows = keptSuggestionData || [];
    }
    const keptSuggestionIds: string[] = keptSuggestionRows.map((row: any) => row.id);
    const keptSuggestionBindingMap = suggestionBindingMap(keptSuggestionRows);

    // Compute weeks until deadline
    let weeksUntilDeadline: number | null = null;
    let deadlineSource: 'student.main_goal_target_date' | 'goal.target_date' | 'fallback_no_deadline' = 'fallback_no_deadline';
    if (student.main_goal_target_date) {
      const target = new Date(student.main_goal_target_date).getTime();
      const today = Date.now();
      const days = Math.max(0, Math.round((target - today) / (1000 * 60 * 60 * 24)));
      weeksUntilDeadline = Math.max(1, Math.round(days / 7));
      deadlineSource = 'student.main_goal_target_date';
    }
    // v6.9.14 — fallback to earliest non-achieved goal.target_date
    if (weeksUntilDeadline === null) {
      const goalTimes = (goals || [])
        .filter((g: any) => g.target_date && !g.is_achieved)
        .map((g: any) => new Date(g.target_date).getTime())
        .filter((t: number) => Number.isFinite(t) && t > Date.now());
      if (goalTimes.length > 0) {
        const earliest = Math.min(...goalTimes);
        const days = Math.max(0, Math.round((earliest - Date.now()) / 86400000));
        weeksUntilDeadline = Math.max(1, Math.round(days / 7));
        deadlineSource = 'goal.target_date';
      }
    }

    const hasLessons = worksheets.length > 0;

    // Pacing index (Scientific 0 ↔ Pragmatic 100). Auto-compute if teacher kept default 50.
    const pacing = computePacingIndex(student as any, weeksUntilDeadline);
    const pLabel = pacingLabel(pacing);

    // v6.9.41 P6 — guided overrides take precedence over auto-fit heuristics.
    const phaseWeekTargets: number[] | null = Array.isArray(rawPhaseWeekTargets) && rawPhaseWeekTargets.length > 0
      ? rawPhaseWeekTargets
          .map((n: any) => Math.max(1, Math.min(12, Number.parseInt(String(n), 10) || 0)))
          .filter((n: number) => n > 0)
      : null;
    const explicitWeeksPerPhase = Number.isFinite(rawWeeksPerPhase)
      ? Math.max(1, Math.min(12, Number.parseInt(String(rawWeeksPerPhase), 10)))
      : null;
    const requestedCount = Number.isInteger(rawCount) ? Math.min(8, Math.max(1, rawCount)) : null;
    const phaseCount = (phaseWeekTargets?.length)
      ?? requestedCount
      ?? (weeksUntilDeadline ? Math.min(5, Math.max(3, Math.round(weeksUntilDeadline / 4))) : 5);
    const avgWeeksPerPhase = explicitWeeksPerPhase
      ?? (weeksUntilDeadline ? Math.max(2, Math.round(weeksUntilDeadline / phaseCount)) : 4);
    const focusedGoalIds: string[] = Array.isArray(rawFocusedGoalIds)
      ? rawFocusedGoalIds.filter((x: any) => typeof x === 'string' && x.length > 0)
      : [];
    // v6.9.13: when deadline exists, totalWeeks is HARD-CAPPED at weeksUntilDeadline.
    // For mode='add', we need the remaining budget after already-existing phases.
    let remainingBudget: number | null = null;
    if (weeksUntilDeadline) {
      if (mode === 'add') {
        const consumed = existingPhases
          .filter((p: any) => p.status !== 'done')
          .reduce((acc: number, p: any) => {
            const s = Number.isInteger(p.estimated_weeks_start) ? p.estimated_weeks_start : 0;
            const e = Number.isInteger(p.estimated_weeks_end) ? p.estimated_weeks_end : 0;
            return Math.max(acc, e || s || 0);
          }, 0);
        remainingBudget = Math.max(phaseCount, weeksUntilDeadline - consumed);
    } else if (phaseWeekTargets) {
      remainingBudget = phaseWeekTargets.reduce((a, b) => a + b, 0);
    } else if (explicitWeeksPerPhase) {
      remainingBudget = explicitWeeksPerPhase * phaseCount;
    } else {
        // v6.9.44 — 'replace' preserves kept (done + in_progress); rebuild only the remainder.
        remainingBudget = Math.max(phaseCount, weeksUntilDeadline - keptWeeksConsumed);
      }
    }
    const totalWeeks = remainingBudget ?? phaseCount * avgWeeksPerPhase;

    // Build focused-goal subset for the prompt (rest still informs pacing).
    const focusedGoals = focusedGoalIds.length > 0
      ? goals.filter((g: any) => focusedGoalIds.includes((g as any).id))
      : [];

    const scientificFramework = buildScientificPrinciplesBlock(student.english_level, pacing);
    const studentProfile = buildStudentProfileBlock(student as any, pacing);
    const weakBlock = buildWeakAreasBlock(metrics, 12);
    const knowledgeBlock = buildKnowledgeBlock(knowledge, 10);
    const goalsBlock = focusedGoals.length > 0
      ? `PRIORITY GOALS (teacher-selected — these MUST drive phase design):\n${buildGoalsBlock(focusedGoals)}\n\nOther active goals (context only, do not let them dominate):\n${buildGoalsBlock(goals.filter((g: any) => !focusedGoalIds.includes((g as any).id)))}`
      : buildGoalsBlock(goals);
    const worksheetHistory = buildWorksheetHistoryBlock(worksheets, 10);
    const existingPlan = buildExistingPhasesBlock(existingPhases);

    const deadlineConstraintBlock = weeksUntilDeadline
      ? `\nHARD CONSTRAINT — DEADLINE FIT (NON-NEGOTIABLE):
- Student deadline = ${weeksUntilDeadline} weeks from today.
- You MUST fit ALL ${phaseCount} phases within EXACTLY ${totalWeeks} weeks total.
- Sum of (estimated_weeks_end - estimated_weeks_start + 1) across all returned phases MUST equal ${totalWeeks}.
- Each phase MUST be at least 2 weeks (unless deadline forces shorter).
- Phases MUST be contiguous: phase[i].estimated_weeks_start = phase[i-1].estimated_weeks_end + 1.
- First phase starts at week ${(mode === 'add' || keptWeeksConsumed > 0) ? (keptWeeksConsumed + 1) : 1}.
- DO NOT exceed week ${weeksUntilDeadline} under any circumstance — the deadline is a wall, not a guideline.
- A server-side validator WILL rescale your durations if they overflow; honoring the budget yourself produces better learning sequencing.

EXAMPLE for budget=13 weeks, phaseCount=4:
  Phase 1: weeks 1-3 (3w)
  Phase 2: weeks 4-6 (3w)
  Phase 3: weeks 7-9 (3w)
  Phase 4: weeks 10-13 (4w)
SUM=13 ✓ (NOT 16, NOT 20)\n`
      : `\nNo deadline set — distribute ~${avgWeeksPerPhase} weeks per phase as a rough guide.\n`;

    const prompt = `You are an expert ESL curriculum architect designing a MACRO learning roadmap (curriculum phases) for an adult 1-on-1 English student.

${scientificFramework}

${studentProfile}
- Deadline: ${student.main_goal_target_date ? `${weeksUntilDeadline} weeks from now (${student.main_goal_target_date})` : 'open-ended'}
- Has prior lessons: ${hasLessons ? 'YES' : 'NO'}
${deadlineConstraintBlock}
EXISTING ROADMAP PHASES (build COMPLEMENTARILY — never duplicate, never contradict):
${existingPlan}

COMPLEMENTARITY RULES:
- If mode='replace': only replace status='planned' or 'draft' phases. NEVER touch 'done' or 'in_progress' — they are KEPT.
- If mode='add': extend the timeline AFTER the last existing phase.
- NEVER overlap weeks with KEPT phases (done + in_progress). New phases MUST start at week ${(mode === 'add' || keptWeeksConsumed > 0) ? (keptWeeksConsumed + 1) : 1}.
- NEVER overlap focus_areas with status='done'/'in_progress' phases unless explicitly reinforcing a still-weak skill (justify in rationale).

WEAK AREAS (recency-weighted — RECENT SIGNALS CARRY MORE AUTHORITY than older ones):
  ${weakBlock}

RECENCY RULE: Skill metrics updated within the last 7 days are AUTHORITATIVE. Signals older than 30 days are STALE — treat them as hypotheses to verify, not facts.

GOALS (deadline-pressured ones determine pacing):
${goalsBlock}

CONTEXT NOTES (most recent first — newer notes override older):
  ${knowledgeBlock}

RECENT WORKSHEET TOPICS (already covered or in progress):
  ${worksheetHistory}

DESIGN BRIEF:
- Generate EXACTLY ${phaseCount} curriculum PHASES (macro blocks) covering ~${totalWeeks} weeks total.
- Each phase ~${avgWeeksPerPhase} weeks of lessons grouping related skills/topics.
- Phases must form a LOGICAL PROGRESSION toward the main goal (foundations → application → fluency)
  — but the SHAPE of that progression depends on the PACING MODE (${pacing}/100, ${pLabel}).
- TBLT TITLES MANDATORY: Each phase title is a real adult outcome, not a grammar label.
  WRONG: "Conditionals and Modals"   RIGHT: "Negotiating Project Scope With a Client"
- The FIRST phase must be 'in_progress' if has_prior_lessons=YES, otherwise 'planned'.
- All other phases: 'planned'. NEVER mark anything as 'done'.
- Weeks (estimated_weeks_start, estimated_weeks_end) are cumulative integers from week 1.
- focus_areas: 2-5 short tags per phase (e.g. ["client negotiation","conditionals","hedging language"]).
- Rationale: 1-2 sentences explaining WHY this phase here, citing student data (weak skill, deadline, goal).
- PACING: Goals with [DEADLINE: ...] MUST be addressed in phases that complete BEFORE that deadline.
${teacherComment ? `\nTEACHER GUIDANCE (apply this to the plan): "${teacherComment}"` : ''}

Return ONLY a valid JSON array (no markdown), with this exact format:
[
  {
    "title": "Adult task-based phase title",
    "description": "1 sentence overview of what student practices in this phase",
    "focus_areas": ["tag1","tag2","tag3"],
    "estimated_weeks_start": 1,
    "estimated_weeks_end": 4,
    "status": "in_progress" | "planned",
    "rationale": "Why this phase here, based on student data"
  }
]`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert ESL curriculum architect. Return only valid JSON arrays. No markdown.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 2500,
        reasoning: { effort: 'low' }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', errorText);
      await logModelFailure({
        model: 'google/gemini-2.5-flash',
        provider: 'lovable-gateway',
        status: aiResponse.status,
        endpoint: '/v1/chat/completions',
        error: errorText,
        functionName: 'generate-curriculum-phases',
      });
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '[]';

    let phases: any[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      phases = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      phases = [];
    }

    if (!Array.isArray(phases) || phases.length === 0) {
      return new Response(
        JSON.stringify({ error: 'AI returned no valid phases', phases: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize
    phases = phases.map((p: any) => ({
      title: String(p.title || 'Untitled phase').slice(0, 200),
      description: p.description ? String(p.description).slice(0, 500) : null,
      focus_areas: Array.isArray(p.focus_areas) ? p.focus_areas.map(String).slice(0, 8) : [],
      estimated_weeks_start: Number.isInteger(p.estimated_weeks_start) ? p.estimated_weeks_start : null,
      estimated_weeks_end: Number.isInteger(p.estimated_weeks_end) ? p.estimated_weeks_end : null,
      status: ['planned', 'in_progress', 'draft'].includes(p.status) ? p.status : 'planned',
      rationale: p.rationale ? String(p.rationale).slice(0, 600) : null,
    }));

    // v6.9.47 — new phases must start AFTER the last kept (done/in_progress) week
    // so they never overlap preserved active phases. `add` mode follows the same rule.
    const roadmapStartWeek = (mode === 'add' || keptWeeksConsumed > 0)
      ? (keptWeeksConsumed + 1)
      : 1;

    // v6.9.41 P6 — when teacher set explicit per-phase week targets, honor them deterministically.
    let fit: { phases: any[]; adjusted: boolean };
    if (phaseWeekTargets && phases.length === phaseWeekTargets.length) {
      fit = { phases: rebaseFromWeek(phases, phaseWeekTargets, roadmapStartWeek), adjusted: true };
    } else {
      // v6.9.13 — HARD DEADLINE FIT safety net (server-side scaling/clipping).
      fit = fitPhasesToDeadline(phases, remainingBudget, roadmapStartWeek);
    }
    phases = fit.phases;

    // v6.9.47 — before soft-deleting replaceable phases, detach their active
    // worksheet suggestions so they survive as free `next_step` rows instead of
    // pointing at a deleted phase row (which makes them invisible in the UI).
    let detachedReplaceableSuggestionIds: string[] = [];
    const detachedSuggestionPriorPhase: Record<string, string> = {};
    if (mode === 'replace' && replaceablePhaseIds.length > 0) {
      const { data: detachable, error: detachReadErr } = await supabase
        .from('future_worksheet_suggestions')
        .select('id, phase_id')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .eq('is_used', false)
        .in('phase_id', replaceablePhaseIds);
      if (detachReadErr) {
        console.error('Failed to read replaceable phase suggestions', detachReadErr);
        throw detachReadErr;
      }
      for (const r of detachable || []) {
        detachedReplaceableSuggestionIds.push(String(r.id));
        if (r.phase_id) detachedSuggestionPriorPhase[String(r.id)] = String(r.phase_id);
      }
      if (detachedReplaceableSuggestionIds.length > 0) {
        const { error: detachErr } = await supabase
          .from('future_worksheet_suggestions')
          .update({ phase_id: null, suggestion_kind: 'next_step' })
          .in('id', detachedReplaceableSuggestionIds);
        if (detachErr) {
          console.error('Failed to detach replaceable phase suggestions', detachErr);
          throw detachErr;
        }
      }
    }

    // v6.9.45 — Soft-delete ONLY planned/draft phases on `replace`. Scope the
    // update by student_id + teacher_id as an extra safety belt so a runtime
    // bug or stale id list can never affect another student's roadmap.
    if (mode === 'replace' && replaceablePhaseIds.length > 0) {
      const { error: softDeleteErr } = await supabase
        .from('dslm_curriculum_phases')
        .update({ deleted_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .in('id', replaceablePhaseIds);
      if (softDeleteErr) {
        console.error('Failed to soft-delete replaceable phases', softDeleteErr);
        throw softDeleteErr;
      }
    }

    // v6.9.45 — If we are preserving an in_progress phase, the freshly generated
    // phases must NOT also be in_progress. Force them to `planned` so we never
    // end up with two simultaneously-active phases.
    if (mode === 'replace' && hasKeptInProgress) {
      phases = phases.map((p: any) => ({ ...p, status: p.status === 'in_progress' ? 'planned' : p.status }));
    }

    // Compute starting sequence
    const remainingMaxSeq = mode === 'add'
      ? (existingPhases.reduce((acc: number, p: any) => Math.max(acc, p.sequence_number), 0))
      : (protectedPhases.reduce((acc: number, p: any) => Math.max(acc, p.sequence_number), 0));

    const generationContext = {
      weeks_until_deadline: weeksUntilDeadline,
      target_total_weeks: remainingBudget,
      deadline_fit_adjusted: fit.adjusted,
      deadline_source: deadlineSource,
      phase_count: phases.length,
      pacing_index: pacing,
      pacing_label: pLabel,
      metrics_count: metrics.length,
      goals_count: goals.length,
      knowledge_count: knowledge.length,
      worksheet_count: worksheets.length,
      teacher_overrides: {
        explicit_count: requestedCount ?? null,
        explicit_weeks_per_phase: explicitWeeksPerPhase ?? null,
        phase_week_targets: phaseWeekTargets ?? null,
        focused_goal_ids: focusedGoalIds.length > 0 ? focusedGoalIds : null,
        has_teacher_comment: Boolean(teacherComment && teacherComment.trim().length > 0),
      },
      // v6.9.45 preservation audit
      kept_phase_ids: keptPhaseIds,
      replaceable_phase_ids: replaceablePhaseIds,
      protected_phase_ids: protectedPhaseIds,
      kept_suggestion_ids: keptSuggestionIds,
      unknown_status_phase_ids: unknownStatusPhases,
      preserved_phase_count: keptPhases.length,
      roadmap_start_week: roadmapStartWeek,
      detached_replaceable_suggestion_ids: detachedReplaceableSuggestionIds,
      generated_at: new Date().toISOString(),
    };

    const restoreReplaceablePhases = async () => {
      if (mode !== 'replace' || replaceablePhaseIds.length === 0) return null;
      const { error } = await supabase
        .from('dslm_curriculum_phases')
        .update({ deleted_at: null })
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .in('id', replaceablePhaseIds);
      if (error) console.error('Failed to restore replaceable phases after roadmap failure', error);
      return error;
    };

    // v6.9.47 — symmetric rollback for detached suggestions. We re-attach them
    // to their original replaceable phase ids so the teacher does not lose
    // existing worksheet plans when the regeneration is aborted post-detach.
    const restoreDetachedSuggestions = async () => {
      if (detachedReplaceableSuggestionIds.length === 0) return null;
      // Re-read the original phase bindings from kept context; we rely on the
      // fact that we filtered detachable by `in('phase_id', replaceablePhaseIds)`
      // so any restoration must map id→its prior phase_id. We persisted that
      // mapping via a second read here for safety.
      const { data: priorBindings, error: bindingsErr } = await supabase
        .from('future_worksheet_suggestions')
        .select('id, phase_id, suggestion_kind')
        .in('id', detachedReplaceableSuggestionIds);
      if (bindingsErr) {
        console.error('Failed to read detached suggestion bindings for rollback', bindingsErr);
        return bindingsErr;
      }
      // For each detached row, try to re-attach to a still-existing replaceable
      // phase. After phase restore (restoreReplaceablePhases) the previous
      // phase rows are alive again, so we can re-bind by the original mapping
      // captured in detachedSuggestionPriorPhase below.
      const restoreErrors: any[] = [];
      for (const row of priorBindings || []) {
        const original = detachedSuggestionPriorPhase[String(row.id)];
        if (!original) continue;
        const { error: restoreErr } = await supabase
          .from('future_worksheet_suggestions')
          .update({ phase_id: original, suggestion_kind: 'phase_step' })
          .eq('id', row.id);
        if (restoreErr) restoreErrors.push(restoreErr);
      }
      if (restoreErrors.length > 0) {
        console.error('Failed to restore some detached suggestions', restoreErrors);
        return restoreErrors[0];
      }
      return null;
    };

    const cleanupInsertedPhases = async (insertedIds: string[]) => {
      if (!insertedIds.length) return null;
      const { error } = await supabase
        .from('dslm_curriculum_phases')
        .update({ deleted_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .in('id', insertedIds);
      if (error) console.error('Failed to clean up inserted phases after roadmap failure', error);
      return error;
    };

    const preservationFailureResponse = async (reason: string, details: any, insertedIds: string[] = []) => {
      const cleanupErr = await cleanupInsertedPhases(insertedIds);
      const restoreErr = await restoreReplaceablePhases();
      const detachRestoreErr = await restoreDetachedSuggestions();
      console.error('Roadmap preservation invariant FAILED', {
        reason,
        expected_kept_ids: keptPhaseIds,
        kept_suggestion_ids: keptSuggestionIds,
        inserted_ids: insertedIds,
        cleanup_error: cleanupErr,
        restore_error: restoreErr,
        detach_restore_error: detachRestoreErr,
        ...details,
      });
      return new Response(
        JSON.stringify({
          error: 'Kept phase preservation failed',
          preservationInvariantFailed: true,
          reason,
          expected_kept_ids: keptPhaseIds,
          kept_suggestion_ids: keptSuggestionIds,
          inserted_ids: insertedIds,
          cleanupFailed: Boolean(cleanupErr),
          restoreFailed: Boolean(restoreErr),
          detachRestoreFailed: Boolean(detachRestoreErr),
          ...details,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    const insertData = phases.map((p, idx) => ({
      student_id: studentId,
      teacher_id: teacherId,
      sequence_number: remainingMaxSeq + idx + 1,
      title: p.title,
      description: p.description,
      status: p.status,
      estimated_weeks_start: p.estimated_weeks_start,
      estimated_weeks_end: p.estimated_weeks_end,
      focus_areas: p.focus_areas,
      rationale: p.rationale,
      generation_context: generationContext,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('dslm_curriculum_phases')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      await restoreReplaceablePhases();
      await restoreDetachedSuggestions();
      throw insertError;
    }

    // v6.9.46 — post-write preservation invariant. Verify every kept phase field
    // and every kept suggestion binding, not just row survival.
    const insertedIds: string[] = (inserted || []).map((p: any) => p.id).filter(Boolean);
    if (mode === 'replace' && keptPhaseIds.length > 0) {
      const { data: keptCheck, error: keptCheckErr } = await supabase
        .from('dslm_curriculum_phases')
        .select('id, sequence_number, status, title, description, focus_areas, estimated_weeks_start, estimated_weeks_end, rationale, deleted_at')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .in('id', keptPhaseIds);
      if (keptCheckErr) {
        console.error('Failed to verify kept phases', keptCheckErr);
        return await preservationFailureResponse('kept_phase_read_failed', { kept_phase_read_error: keptCheckErr }, insertedIds);
      }
      const phaseDiffs = diffPhaseSnapshots(keptPhaseSnapshotMap, phaseSnapshotMap(keptCheck || []));
      if (phaseDiffs.length > 0) {
        return await preservationFailureResponse('kept_phase_snapshot_changed', { phase_diffs: phaseDiffs }, insertedIds);
      }
    }

    if (mode === 'replace' && keptSuggestionIds.length > 0) {
      const { data: keptSuggestionCheck, error: keptSuggestionCheckErr } = await supabase
        .from('future_worksheet_suggestions')
        .select('id, phase_id')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .in('id', keptSuggestionIds);
      if (keptSuggestionCheckErr) {
        console.error('Failed to verify kept suggestion bindings', keptSuggestionCheckErr);
        return await preservationFailureResponse('kept_suggestion_read_failed', { kept_suggestion_read_error: keptSuggestionCheckErr }, insertedIds);
      }
      const suggestionDiffs = diffSuggestionBindings(keptSuggestionBindingMap, suggestionBindingMap(keptSuggestionCheck || []));
      if (suggestionDiffs.length > 0) {
        return await preservationFailureResponse('kept_suggestion_binding_changed', { suggestion_diffs: suggestionDiffs }, insertedIds);
      }
    }

    return new Response(
      JSON.stringify({ phases: inserted, generationContext }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-curriculum-phases:', error);
    return new Response(
      JSON.stringify({ error: error.message, phases: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
