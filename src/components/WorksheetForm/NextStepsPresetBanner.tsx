/**
 * v6.9.10 — NextStepsPresetBanner
 *
 * Renders a thin banner above the Exercise Selection cards that surfaces up to 3
 * pre-existing learning-plan suggestions (`future_worksheet_suggestions`) for the
 * currently selected student. Click on a chip prefills the parent WorksheetForm
 * via `onApplyPreset` (which uses `normalizeSuggestionPrefill`).
 *
 * If the student has no suggestions, the banner becomes a soft CTA pointing the
 * teacher to the Progress tab to generate a learning plan first.
 *
 * Sanctity: this component does NOT modify the worksheet generation prompt. It
 * only reads from `useFutureTimeline` and triggers parent state setters.
 */
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lightbulb, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFutureTimeline } from '@/hooks/useFutureTimeline';
import {
  PICTURE_EXERCISE_IDS,
  AUDIO_EXERCISE_IDS,
  type MediaTypeLite,
} from '@/lib/dslm/normalizeSuggestionPrefill';

export interface PresetPayload {
  topic: string;
  goal: string;
  additionalInfo: string;
  grammarFocus: string;
  exercises: string[];
  exerciseFocusMap: Record<string, string>;
  mediaTypes: MediaTypeLite[];
  sourceSuggestionId: string;
}

interface NextStepsPresetBannerProps {
  studentId: string | null;
  studentName?: string;
  teacherId: string | null;
  onApplyPreset: (preset: PresetPayload) => void;
}

/** Infer media family from exercise IDs (picture > audio > none). */
function inferMediaTypes(exercises: string[]): MediaTypeLite[] {
  const hasPic = exercises.some((id) => (PICTURE_EXERCISE_IDS as readonly string[]).includes(id));
  const hasAudio = exercises.some((id) => (AUDIO_EXERCISE_IDS as readonly string[]).includes(id));
  if (hasPic) return ['picture'];
  if (hasAudio) return ['audio'];
  return [];
}

function truncate(s: string, n: number) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function NextStepsPresetBanner({
  studentId,
  studentName,
  teacherId,
  onApplyPreset,
}: NextStepsPresetBannerProps) {
  const navigate = useNavigate();

  // Skip the hook entirely when no student is selected (return null below) — but
  // we still must always-call the hook for React rules. Pass empty strings so the
  // internal validity check inside useFutureTimeline short-circuits the query.
  const enabledStudentId = studentId || '';
  const enabledTeacherId = teacherId || '';
  const { nextSteps, phaseSteps, loading, useSuggestion } = useFutureTimeline({
    studentId: enabledStudentId,
    teacherId: enabledTeacherId,
  });

  // Prefer phase-bound steps (more contextual), fall back to free next_steps.
  const presets = useMemo(() => {
    return [...phaseSteps, ...nextSteps].slice(0, 3);
  }, [phaseSteps, nextSteps]);

  // After parent's worksheet generation succeeds, mark the applied preset as used.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const id = detail.suggestionId as string | undefined;
      const wsId = (detail.worksheetId as string | undefined) || null;
      if (!id) return;
      // Fire-and-forget; useFutureTimeline handles its own toasts/refetch.
      useSuggestion(id, wsId);
    };
    window.addEventListener('markPresetUsed', handler as EventListener);
    return () => window.removeEventListener('markPresetUsed', handler as EventListener);
  }, [useSuggestion]);

  // No student selected → render nothing (form stays compact).
  if (!studentId || !teacherId) return null;

  // Loading skeleton — keep the banner height stable to avoid layout shift.
  if (loading) {
    return (
      <div className="mb-3 min-h-[44px]">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    );
  }

  // Empty state — gentle CTA toward Learning Plan.
  if (presets.length === 0) {
    return (
      <div className="mb-3 min-h-[44px]">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-900/15 dark:border-amber-700/50 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
            <Lightbulb className="h-4 w-4 flex-shrink-0" />
            <span>
              No learning plan for <strong>{studentName || 'this student'}</strong> yet — plans help AI generate cohesive, goal-driven worksheets.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-100"
            onClick={() => navigate(`/student/${studentId}?tab=progress`)}
          >
            Open Learning Plan
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // Populated state — show up to 3 chip presets.
  return (
    <TooltipProvider delayDuration={200}>
      <div className="mb-3 min-h-[44px]">
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-worksheet-purpleLight dark:bg-purple-900/20 border border-worksheet-purple/20 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-worksheet-purpleDark dark:text-purple-200">
            <Sparkles className="h-3.5 w-3.5" />
            Suggested next steps:
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {presets.map((p: any) => {
              const exercises: string[] = Array.isArray(p.suggested_exercises) ? p.suggested_exercises : [];
              const focusMap: Record<string, string> = (p.suggested_exercise_focus_map as Record<string, string>) || {};
              const payload: PresetPayload = {
                topic: p.suggested_topic || '',
                goal: p.suggested_goal || '',
                additionalInfo: p.suggested_additional_info || '',
                grammarFocus: p.suggested_grammar_focus || '',
                exercises,
                exerciseFocusMap: focusMap,
                mediaTypes: inferMediaTypes(exercises),
                sourceSuggestionId: p.id,
              };
              const tooltipText = [p.suggested_goal, p.rationale].filter(Boolean).join(' — ');
              return (
                <Tooltip key={p.id}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 bg-white/80 dark:bg-background/40 border-worksheet-purple/30 text-xs"
                      onClick={() => onApplyPreset(payload)}
                    >
                      <Sparkles className="h-3 w-3 text-worksheet-purple" />
                      <span className="max-w-[180px] truncate">{truncate(payload.topic || 'Untitled step', 40)}</span>
                    </Button>
                  </TooltipTrigger>
                  {tooltipText && (
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs">{tooltipText}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default NextStepsPresetBanner;