/**
 * dslmPromptCore — DSLM Pathway v4.3
 * Shared prompt-building helpers for `generate-curriculum-phases` and `generate-timeline`.
 * Encodes Second Language Acquisition (SLA) science into the prompts:
 *   - Krashen Natural Order Hypothesis (Dulay & Burt 1974; Goldschneider & DeKeyser 2005)
 *   - Sweller Cognitive Load Theory (Roussel-Sweller-Tricot 2022)
 *   - Ellis Task-Based Language Teaching (2009, 2017)
 *   - Cepeda 2006 / Kim & Webb 2022 Spaced Practice
 *   - Nakata & Suzuki 2019 Interleaving
 *   - Roediger & Karpicke 2006 Retrieval Practice
 *   - Hutchinson & Waters 1987 / Basturkmen 2022 ESP
 *   - Knowles 1980 Andragogy
 */

export type PacingLabel = 'Scientific' | 'Balanced' | 'Pragmatic';

export interface StudentProfileLite {
  name?: string | null;
  english_level?: string | null;
  main_goal?: string | null;
  main_goal_target_date?: string | null;
  dslm_pacing_mode?: number | null;
  dslm_use_roadmap?: boolean | null;
  // Optional fields (may not exist in DB yet — accessed defensively)
  profession?: string | null;
  industry?: string | null;
  interests?: string | null;
  language_style?: number | null;
  notes?: string | null;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function pacingLabel(p: number): PacingLabel {
  if (p <= 30) return 'Scientific';
  if (p >= 70) return 'Pragmatic';
  return 'Balanced';
}

/**
 * Auto-compute pacing index when teacher hasn't manually set it (default = 50).
 * Scientific (0) ↔ Pragmatic (100).
 */
export function computePacingIndex(
  student: StudentProfileLite,
  weeksUntilDeadline: number | null
): number {
  // If teacher explicitly set non-default, respect it.
  const stored = student.dslm_pacing_mode;
  if (typeof stored === 'number' && stored !== 50) return clamp(stored, 0, 100);

  let p = 50;
  const goal = (student.main_goal || '').toLowerCase();

  if (/academic|exam|cae|fce|cpe|ielts|toefl/.test(goal)) p -= 30;
  if (/work|business|career|travel|conversation|social|meeting|interview/.test(goal)) p += 20;

  if (weeksUntilDeadline !== null) {
    if (weeksUntilDeadline <= 8) p += 25;
    else if (weeksUntilDeadline <= 16) p += 15;
  }

  const lvl = (student.english_level || '').toUpperCase();
  if (lvl.startsWith('A')) p -= 10;

  return clamp(p, 0, 100);
}

/**
 * "X days ago" / "today" / "yesterday" badge for recency weighting.
 */
export function daysAgoLabel(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.max(0, Math.round(ms / 86400000));
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

function recencyWeight(iso: string | null | undefined): 'AUTHORITATIVE' | 'RECENT' | 'STALE' {
  if (!iso) return 'STALE';
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (days <= 7) return 'AUTHORITATIVE';
  if (days <= 30) return 'RECENT';
  return 'STALE';
}

/**
 * SLA scientific framework — injected at the top of every prompt.
 * Citations are explicit so the LLM understands the authority and does not drift.
 * Length: ~450 tokens.
 */
export function buildScientificPrinciplesBlock(level: string | null | undefined, pacing: number): string {
  const lvl = (level || 'B1').toUpperCase();
  const label = pacingLabel(pacing);

  const lvlRule = lvl.startsWith('A')
    ? `Level ${lvl}: FORBID productive use of passives, reported speech, mixed conditionals, perfect modals. Allow ONLY receptive exposure to these structures.`
    : lvl.startsWith('B1')
      ? `Level B1: Introduce simple passives and 2nd conditional in production. Reported speech still mostly receptive.`
      : `Level ${lvl}: Full grammatical range allowed in production.`;

  const pacingDirective = label === 'Scientific'
    ? 'STRICT Natural Order Hypothesis enforcement. Heavy input phase before output. Sequence grammar bottom-up.'
    : label === 'Pragmatic'
      ? 'TBLT-FIRST. Just-in-time grammar. Give student usable phrases TODAY even if they technically "skip" the natural order — front-load high-frequency formulaic chunks.'
      : 'Balanced: respect Natural Order, but anchor every step in student professional/personal domain from day one.';

  return `═══ SLA SCIENTIFIC FRAMEWORK (mandatory — these rules override stylistic preferences) ═══

PACING MODE: ${pacing}/100 (${label}) — ${pacingDirective}

GRANULAR PACING SIGNALS (use the EXACT numeric value above, not just the bucket label):
- INPUT/OUTPUT RATIO: ${100 - pacing}% input-focused (reading/listening/recognition) / ${pacing}% output-focused (speaking/writing/production).
- GRAMMAR EXPLICITNESS: ${pacing < 30 ? 'high — explicit rules introduced before exposure, with clear meta-language.' : pacing > 70 ? 'low — just-in-time micro-rules embedded in formulaic chunks; avoid meta-language.' : 'medium — short rule reminders introduced after exposure to examples.'}
- CONTEXT IMMERSION: ${pacing}% of vocabulary/scenarios drawn from the student's professional/personal domain (the rest may be generic high-frequency).
- TASK AUTHENTICITY: ${pacing < 30 ? 'controlled, didactic micro-tasks dominate.' : pacing > 70 ? 'real-world communicative tasks dominate from step 1.' : 'mixed: each step pairs one controlled task with one communicative task.'}

1. NATURAL ORDER (Krashen 1981; Dulay & Burt 1974; meta-analysis Goldschneider & DeKeyser 2005):
   ${lvlRule}

2. COGNITIVE LOAD (Sweller; Roussel-Sweller-Tricot 2022):
   - Working memory ≈ 4±1 chunks. NEVER bundle more than 2 NEW grammar points per step.
   - All vocabulary MUST originate from the student's profession / interests / stated goal domain.
   - Generic "school topics" (animals, generic holidays, third-party hobbies) are FORBIDDEN.

3. TBLT — Task-Based Language Teaching (Ellis 2009, 2017):
   - Step / phase titles are REAL ADULT TASKS, not grammar labels.
     ❌ "Present Perfect Continuous Practice"
     ✅ "Explaining a Long-Standing Bug to Your CTO at the Standup"
   - The "goal" field describes the OUTCOME the student can perform after completion.

4. SPACED & INTERLEAVED PRACTICE (Cepeda et al. 2006; Kim & Webb 2022; Nakata & Suzuki 2019):
   - If a weak skill was targeted in the last 1-2 steps, do NOT target it in the very next step.
     Re-target it 3-5 steps later (spacing window). Apply same logic at phase level.
   - Within a single step, mix vocabulary-focused and grammar-focused exercises (interleaving).

5. RETRIEVAL PRACTICE / TESTING EFFECT (Roediger & Karpicke 2006; Karpicke 2008):
   - Each step MUST include ≥2 productive exercises (answer-questions, dialogue, discussion,
     fill-in-blanks WITHOUT options) to force retrieval, not just recognition.

6. ESP — English for Specific Purposes (Hutchinson & Waters 1987; Basturkmen 2022):
   - Every step explicitly anchored in the student's career/domain.

7. ANDRAGOGY (Knowles 1980):
   - Adult/professional tone. No childlike imagery, no school metaphors.
   - The goal must be applicable in the student's real life within 1 week.

═══ END FRAMEWORK ═══`;
}

/**
 * Student profile block with explicit CLT anchoring instruction.
 */
export function buildStudentProfileBlock(student: StudentProfileLite, pacing: number): string {
  const profession = student.profession || 'unspecified';
  const industry = student.industry || 'unspecified';
  const interests = student.interests || 'unspecified';
  const style = typeof student.language_style === 'number' ? `${student.language_style}/5` : 'unspecified';
  const useRoadmap = student.dslm_use_roadmap !== false;
  const notes = student.notes ? `\n- General notes: ${student.notes}` : '';

  return `STUDENT PROFILE (use for CLT context anchoring):
- Name: ${student.name || 'Student'}
- Level: ${student.english_level || 'unknown'}
- Main Goal: ${student.main_goal || 'General English improvement'}
- Profession: ${profession}
- Industry/Domain: ${industry}
- Interests: ${interests}
- Preferred register: ${style} (1=very casual, 5=very formal)
- Pacing mode: ${pacing}/100 (${pacingLabel(pacing)})
- Roadmap influence: ${useRoadmap ? 'ACTIVE — phases drive step generation' : 'IGNORED — generate free-floating steps'}${notes}

CRITICAL CLT RULE: All vocabulary, examples, and scenarios in generated content MUST originate from the student's profession/industry/interests domain (or main goal domain when those are unspecified). Cross-domain vocabulary is FORBIDDEN unless the student's goal is explicitly multi-domain.`;
}

/**
 * Recency-weighted skill metric summary.
 */
export function buildWeakAreasBlock(metrics: any[], limit = 10): string {
  if (!metrics || metrics.length === 0) return 'no weak areas detected';
  const weak = metrics
    .filter((m: any) => (m.current_mastery || 0) < 60)
    .slice(0, limit);
  if (weak.length === 0) return 'no weak areas under 60% mastery';

  return weak.map((m: any) => {
    const w = recencyWeight(m.updated_at);
    const tag = w === 'AUTHORITATIVE' ? '⚡ AUTHORITATIVE' : w === 'STALE' ? '(STALE — re-test)' : '';
    const trend = m.trend === 'declining' ? ', declining' : m.trend === 'improving' ? ', improving' : '';
    const cat = `${m.skill_category || 'general'}/${m.micro_skill || m.skill_name || 'general'}`;
    return `- ${cat}: ${m.current_mastery || 0}% [${daysAgoLabel(m.updated_at)}${trend}] ${tag}`.trim();
  }).join('\n  ');
}

/**
 * Recency-badged knowledge entries.
 */
export function buildKnowledgeBlock(knowledge: any[], limit = 8): string {
  if (!knowledge || knowledge.length === 0) return 'no notes';
  return knowledge.slice(0, limit).map((k: any) =>
    `[${daysAgoLabel(k.created_at)}] [${k.category || 'general'}] ${k.content}`
  ).join('\n  ');
}

/**
 * Recency-badged worksheet history.
 */
export function buildWorksheetHistoryBlock(worksheets: any[], limit = 10): string {
  if (!worksheets || worksheets.length === 0) return 'none';
  return worksheets.slice(0, limit).map((w: any) =>
    `"${w.topic}" (${daysAgoLabel(w.created_at)})`
  ).join(', ');
}

/**
 * Goals block with deadline emphasis (drives pacing).
 */
export function buildGoalsBlock(goals: any[]): string {
  if (!goals || goals.length === 0) return 'No specific goals set';
  return goals.map((g: any) => {
    const deadline = g.target_date ? ` ⏰ [DEADLINE: ${g.target_date}]` : '';
    return `- ${g.title} (${g.goal_type})${g.description ? ': ' + g.description : ''}${deadline}`;
  }).join('\n');
}

/**
 * Existing roadmap phases — for complementarity in generate-curriculum-phases.
 */
export function buildExistingPhasesBlock(phases: any[]): string {
  if (!phases || phases.length === 0) return 'NONE — this is a fresh roadmap.';
  return phases.map((p: any) => {
    const focus = Array.isArray(p.focus_areas) && p.focus_areas.length
      ? ` — focus: [${p.focus_areas.join(', ')}]`
      : '';
    const desc = p.description ? ` — ${p.description.slice(0, 100)}` : '';
    return `[seq ${p.sequence_number}, status=${p.status}] "${p.title}"${focus}${desc}`;
  }).join('\n');
}

/**
 * Existing pending steps — for complementarity in generate-timeline.
 */
export function buildExistingStepsBlock(steps: any[], limit = 20): string {
  if (!steps || steps.length === 0) return 'NONE — queue is empty.';
  return steps.slice(0, limit).map((s: any) => {
    const grammar = s.suggested_grammar_focus ? ` (grammar: ${s.suggested_grammar_focus})` : '';
    // v6.9.49 — when caller joined `dslm_curriculum_phases(sequence_number,title)`
    // we surface `[Phase #N "title"]` so the AI understands which macro block a
    // step belongs to and can correctly complement *across* phases.
    const joinedPhase = s.dslm_curriculum_phases || s.phase || null;
    let phase = ' [free queue]';
    if (joinedPhase && (joinedPhase.sequence_number != null || joinedPhase.title)) {
      const seq = joinedPhase.sequence_number != null ? `#${joinedPhase.sequence_number}` : '';
      const title = joinedPhase.title ? ` "${String(joinedPhase.title).slice(0, 40)}"` : '';
      phase = ` [Phase ${seq}${title}]`;
    } else if (s.phase_id) {
      phase = ` [in phase ${String(s.phase_id).slice(0, 8)}]`;
    }
    return `- "${s.suggested_topic}"${grammar}${phase}`;
  }).join('\n');
}

/**
 * Adaptive exercise rules per pacing.
 */
export function getAdaptiveExerciseRules(pacing: number): string {
  if (pacing >= 70) {
    return 'PRAGMATIC pacing: each step MUST include ≥3 productive exercises (dialogue, answer-questions, discussion, fill-in-blanks without options). Front-load output.';
  }
  if (pacing <= 30) {
    return 'SCIENTIFIC pacing: each step MUST include ≥2 receptive exercises (reading, multiple-choice, matching, true-false) before any productive task. Honor input-before-output.';
  }
  return 'BALANCED pacing: 4 vocabulary-focused + 4 grammar-focused exercises, mixed (interleaved), with ≥2 productive tasks.';
}
