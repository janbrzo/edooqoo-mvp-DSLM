/**
 * SuggestionWhyPanel — "why this lesson": everything the old banner hid
 * behind "Show details" plus the fit reasons, in one readable block.
 * Built only from fields stored on the suggestion row.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { computeConfidence, describeFit } from '@/lib/dslm/confidenceScore';

export interface SuggestionLike {
  suggested_topic?: string | null;
  suggested_goal?: string | null;
  suggested_grammar_focus?: string | null;
  suggested_exercises?: string[] | null;
  suggested_exercise_focus_map?: Record<string, string> | null;
  rationale?: string | null;
  focus_skill_names?: string[] | null;
  generation_context?: Record<string, unknown> | null;
  estimated_impact?: Record<string, unknown> | null;
  difficulty_level?: string | null;
}

const formatSkillLabel = (skill: string) =>
  skill.replace(/^ns\.[A-C][12]\./, '').replace(/^ns\./, '').replace(/[._]/g, ' ');

const formatExercise = (id: string) => id.replace(/-/g, ' ');

const count = (value: unknown) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildEvidenceLine(s: SuggestionLike): string | null {
  const ctx = (s.generation_context || {}) as Record<string, unknown>;
  const parts = [
    count(ctx.metrics_count) > 0 ? plural(count(ctx.metrics_count), 'skill signal', 'skill signals') : null,
    count(ctx.goals_count) > 0 ? plural(count(ctx.goals_count), 'goal', 'goals') : null,
    count(ctx.knowledge_count) > 0 ? plural(count(ctx.knowledge_count), 'note', 'notes') : null,
  ].filter(Boolean);
  return parts.length > 0 ? `Built from ${parts.join(' · ')}` : null;
}

interface SuggestionWhyPanelProps {
  suggestion: SuggestionLike;
  /** Skip the rationale when the caller already shows it as the "Why" line. */
  hideRationale?: boolean;
}

export const SuggestionWhyPanel: React.FC<SuggestionWhyPanelProps> = ({ suggestion: s, hideRationale }) => {
  const confidence = computeConfidence({ suggestion: s });
  const fit = describeFit(confidence.score);
  const exercises = Array.isArray(s.suggested_exercises) ? s.suggested_exercises : [];
  const focusMap = s.suggested_exercise_focus_map || {};
  const skills = Array.isArray(s.focus_skill_names) ? s.focus_skill_names.slice(0, 6) : [];
  const evidence = buildEvidenceLine(s);
  const ctx = (s.generation_context || {}) as Record<string, unknown>;
  const impact = s.estimated_impact && typeof s.estimated_impact === 'object'
    ? Object.entries(s.estimated_impact).slice(0, 4)
    : [];

  return (
    <div className="space-y-2 text-sm">
      {!hideRationale && s.rationale && <p className="text-muted-foreground">{s.rationale}</p>}
      {s.suggested_goal && (
        <p>
          <span className="font-medium text-foreground">Lesson goal:</span>{' '}
          <span className="text-muted-foreground">{s.suggested_goal}</span>
        </p>
      )}
      {s.suggested_grammar_focus && (
        <p>
          <span className="font-medium text-foreground">Grammar:</span>{' '}
          <span className="text-muted-foreground">{s.suggested_grammar_focus}</span>
        </p>
      )}
      {exercises.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {exercises.map((ex, i) => (
            <Badge key={`${ex}-${i}`} variant="secondary" className="font-normal">
              {formatExercise(ex)}
              {focusMap[ex] === 'vocabulary' || focusMap[ex] === 'grammar' ? (
                <span className="ml-1 text-muted-foreground">· {focusMap[ex]}</span>
              ) : null}
            </Badge>
          ))}
        </div>
      )}
      {skills.length > 0 && (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Targets:</span> {skills.map(formatSkillLabel).join(', ')}
        </p>
      )}
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">{fit}</span>
          {confidence.reasons.length > 0 ? ` — ${confidence.reasons.join(' · ')}` : ''}
        </p>
        {(evidence || ctx.pacing_label || s.difficulty_level) && (
          <p className="mt-1">
            {[evidence, ctx.pacing_label ? `pacing ${String(ctx.pacing_label)}` : null, s.difficulty_level ? `difficulty ${s.difficulty_level}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {impact.length > 0 && (
          <p className="mt-1">Expected: {impact.map(([key, value]) => `${key} ${String(value)}`).join(', ')}</p>
        )}
      </div>
    </div>
  );
};
