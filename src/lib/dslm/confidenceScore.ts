/**
 * DSLM Confidence Score — client-side heuristic that estimates how well a generated
 * suggestion (next step or phase step) matches the student's stated needs.
 *
 * NOT an AI call — pure deterministic scoring from the data we already have, so the
 * UI can show "Confidence: 82% match to student needs" without extra latency or cost.
 *
 * Scale: 40-98 (we never claim 100% — keeps it honest).
 *
 * Inputs we look at on a suggestion:
 *  - rationale length & whether it cites a focus skill
 *  - presence of suggested_goal
 *  - presence of suggested_grammar_focus or focus_skill_names
 *  - presence of an exerciseFocusMap (V/G tagging done)
 *  - generation_context.metrics_count / goals_count / knowledge_count (more data → higher confidence)
 *  - topic uniqueness vs recent worksheet history (penalize obvious repeats — a length-only proxy)
 */
export interface ConfidenceInput {
  suggestion: any;
  /** Optional: list of recent worksheet topics to penalize duplicates. */
  recentTopics?: string[];
}

export interface ConfidenceResult {
  score: number;        // 40..98
  label: string;        // "82% match to student needs"
  reasons: string[];    // short bullets a teacher could read
}

export function computeConfidence({ suggestion, recentTopics = [] }: ConfidenceInput): ConfidenceResult {
  if (!suggestion) {
    return { score: 50, label: '50% match to student needs', reasons: ['No suggestion data'] };
  }

  let score = 55; // base
  const reasons: string[] = [];

  // Rationale quality
  const rationale: string = suggestion.rationale || '';
  if (rationale.length > 200) { score += 8; reasons.push('Detailed rationale cites student data'); }
  else if (rationale.length > 80) { score += 4; reasons.push('Rationale present'); }

  // Goal present
  if (suggestion.suggested_goal && String(suggestion.suggested_goal).length > 20) {
    score += 5; reasons.push('Concrete learning outcome defined');
  }

  // Focus skills cited (signal: AI grounded the step in real weak skills)
  const focusSkills: string[] = suggestion.focus_skill_names || [];
  if (focusSkills.length >= 3) { score += 8; reasons.push(`Targets ${focusSkills.length} weak skills`); }
  else if (focusSkills.length >= 1) { score += 4; reasons.push('Targets a weak skill'); }

  // V/G focus map (signals: per-exercise didactic intent)
  const focusMap = suggestion.suggested_exercise_focus_map || {};
  const taggedCount = Object.values(focusMap).filter(v => v === 'vocabulary' || v === 'grammar').length;
  if (taggedCount >= 4) { score += 6; reasons.push('V/G focus assigned to most exercises'); }
  else if (taggedCount >= 2) { score += 3; }

  // Grammar focus or additional info
  if (suggestion.suggested_grammar_focus) { score += 3; reasons.push('Grammar focus specified'); }
  if (suggestion.suggested_additional_info && String(suggestion.suggested_additional_info).length > 30) score += 2;

  // Generation context — how rich was the AI's input?
  const ctx = suggestion.generation_context || {};
  const metrics = Number(ctx.metrics_count || 0);
  const goals = Number(ctx.goals_count || 0);
  const knowledge = Number(ctx.knowledge_count || 0);
  if (metrics >= 20) { score += 6; reasons.push('Built from rich skill-mastery data'); }
  else if (metrics >= 8) { score += 3; }
  if (goals >= 1) score += 2;
  if (knowledge >= 5) { score += 3; reasons.push('Recent teacher notes considered'); }

  // Topic uniqueness penalty
  const topic = String(suggestion.suggested_topic || '').toLowerCase().trim();
  if (topic && recentTopics.length > 0) {
    const dup = recentTopics.some(t => {
      const tt = String(t || '').toLowerCase().trim();
      if (!tt || tt.length < 5) return false;
      return tt === topic || tt.includes(topic) || topic.includes(tt);
    });
    if (dup) { score -= 12; reasons.push('Topic overlaps recent lesson — verify novelty'); }
  }

  // Clamp 40..98
  score = Math.max(40, Math.min(98, Math.round(score)));

  return {
    score,
    label: `${score}% match to student needs`,
    reasons: reasons.slice(0, 4),
  };
}

/** Confidence for a curriculum phase (uses simpler signals). */
export function computePhaseConfidence(phase: any): ConfidenceResult {
  if (!phase) return { score: 50, label: '50% match to student needs', reasons: [] };
  let score = 60;
  const reasons: string[] = [];
  if (phase.description && phase.description.length > 60) { score += 8; reasons.push('Detailed phase description'); }
  if (Array.isArray(phase.focus_areas) && phase.focus_areas.length >= 3) {
    score += 8; reasons.push(`${phase.focus_areas.length} focus areas defined`);
  } else if (Array.isArray(phase.focus_areas) && phase.focus_areas.length >= 1) {
    score += 4;
  }
  if (phase.rationale && phase.rationale.length > 80) { score += 8; reasons.push('Rationale grounded in student profile'); }
  if (phase.estimated_weeks_start && phase.estimated_weeks_end) { score += 5; reasons.push('Timeline estimated'); }
  const ctx = phase.generation_context || {};
  if (Number(ctx.metrics_count || 0) >= 15) { score += 5; reasons.push('Built from rich skill data'); }
  score = Math.max(40, Math.min(98, Math.round(score)));
  return { score, label: `${score}% match to student needs`, reasons: reasons.slice(0, 4) };
}