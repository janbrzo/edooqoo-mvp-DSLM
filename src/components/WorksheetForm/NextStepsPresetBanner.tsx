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
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lightbulb, ArrowUpRight, Map, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFutureTimeline } from '@/hooks/useFutureTimeline';
import { useCurriculumPhases } from '@/hooks/dslm/useCurriculumPhases';
import { SuggestionEditDialog, type SuggestionEditValue } from '@/components/dslm/SuggestionEditDialog';
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

  const enabledStudentId = studentId || '';
  const enabledTeacherId = teacherId || '';
  const { nextSteps, phaseSteps, loading, useSuggestion, updateSuggestion } = useFutureTimeline({
    studentId: enabledStudentId,
    teacherId: enabledTeacherId,
  });
  const { phases } = useCurriculumPhases({
    studentId: enabledStudentId,
    teacherId: enabledTeacherId,
  });

  // Sort identically to PathwayView: currentPhase first, then by phase order, then sequence.
  // Compute a per-phase displayIndex (1..N within phase) and append legacy free next_steps at the end.
  const { sortedItems } = useMemo(() => {
    const currentPhase = phases.find((p: any) => p.status === 'in_progress') || null;
    const phaseOrderById: Record<string, number> = {};
    const phaseLabelById: Record<string, string> = {};
    phases.forEach((p: any) => {
      phaseOrderById[p.id] = p.sequence_number;
      phaseLabelById[p.id] = `Phase ${p.sequence_number}`;
    });

    // displayIndex per phase
    const displayIndexById: Record<string, number> = {};
    const byPhase: Record<string, any[]> = {};
    for (const s of phaseSteps) {
      if (!s.phase_id) continue;
      (byPhase[s.phase_id] ||= []).push(s);
    }
    Object.keys(byPhase).forEach(pid => {
      const sorted = [...byPhase[pid]].sort((a, b) => a.sequence_number - b.sequence_number);
      sorted.forEach((s, idx) => { displayIndexById[s.id] = idx + 1; });
    });
    const sortedLegacy = [...nextSteps].sort((a, b) => a.sequence_number - b.sequence_number);
    sortedLegacy.forEach((s, idx) => { displayIndexById[s.id] = idx + 1; });

    const phaseSorted = [...phaseSteps].sort((a, b) => {
      const pa = a.phase_id ? (phaseOrderById[a.phase_id] ?? 999) : 999;
      const pb = b.phase_id ? (phaseOrderById[b.phase_id] ?? 999) : 999;
      const aActive = currentPhase && a.phase_id === currentPhase.id ? -1 : 0;
      const bActive = currentPhase && b.phase_id === currentPhase.id ? -1 : 0;
      if (aActive !== bActive) return aActive - bActive;
      if (pa !== pb) return pa - pb;
      return a.sequence_number - b.sequence_number;
    });
    const combined = [...phaseSorted, ...sortedLegacy];
    const items = combined.map((s: any) => ({
      s,
      displayIndex: displayIndexById[s.id] ?? 0,
      phaseLabel: s.phase_id ? (phaseLabelById[s.phase_id] ?? null) : null,
      phaseSeq: s.phase_id ? (phaseOrderById[s.phase_id] ?? null) : null,
    }));
    return { sortedItems: items };
  }, [phaseSteps, nextSteps, phases]);

  // Sliding-window carousel state (3 visible at a time, advances by 1).
  const [windowStart, setWindowStart] = useState(0);
  useEffect(() => { setWindowStart(0); }, [studentId]);
  useEffect(() => {
    if (windowStart > Math.max(0, sortedItems.length - 3)) setWindowStart(0);
  }, [sortedItems.length, windowStart]);
  const visible = sortedItems.slice(windowStart, windowStart + 3);
  const total = sortedItems.length;
  const canPrev = windowStart > 0;
  const canNext = windowStart + 3 < total;

  // v6.9.13 — local Edit dialog (no nav away from form).
  const EMPTY_EDIT: SuggestionEditValue = {
    topic: '', goal: '', additionalInfo: '', grammarFocus: '',
    exercises: [], exerciseFocusMap: {},
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<SuggestionEditValue>(EMPTY_EDIT);
  const openEdit = (s: any) => {
    setEditingId(s.id);
    setEditValue({
      topic: s.suggested_topic || '',
      goal: s.suggested_goal || '',
      additionalInfo: s.suggested_additional_info || '',
      grammarFocus: s.suggested_grammar_focus || '',
      exercises: Array.isArray(s.suggested_exercises) ? [...s.suggested_exercises] : [],
      exerciseFocusMap: s.suggested_exercise_focus_map ? { ...(s.suggested_exercise_focus_map as Record<string, string>) } : {},
    });
  };
  const saveEdit = async () => {
    if (!editingId || !editValue.topic.trim()) return;
    await updateSuggestion(
      editingId,
      editValue.topic,
      editValue.goal,
      editValue.additionalInfo,
      editValue.grammarFocus,
      editValue.exercises,
      editValue.exerciseFocusMap,
    );
    setEditingId(null);
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const id = detail.suggestionId as string | undefined;
      const wsId = (detail.worksheetId as string | undefined) || null;
      if (!id) return;
      useSuggestion(id, wsId);
    };
    window.addEventListener('markPresetUsed', handler as EventListener);
    return () => window.removeEventListener('markPresetUsed', handler as EventListener);
  }, [useSuggestion]);

  if (!studentId || !teacherId) return null;

  if (loading) {
    return (
      <div className="mb-3 min-h-[44px]">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="mb-3">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-900/15 dark:border-amber-700/50 px-3 py-2.5">
          <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100 flex-1 min-w-[260px]">
            <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div>
                💡 No learning plan for <strong>{studentName || 'this student'}</strong> yet.
              </div>
              <div className="text-[12px] opacity-90 leading-snug">
                Students with a structured Learning Plan (Phases + Next Steps) get worksheets that
                build on each other instead of being standalone exercises. <strong>Strongly recommended.</strong>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-100 self-center"
            onClick={() => navigate(`/student/${studentId}?tab=dslm&view=pathway`)}
          >
            Open Learning Plan
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mb-3">
        <div className="rounded-md bg-worksheet-purpleLight dark:bg-purple-900/20 border border-worksheet-purple/20 px-3 py-2">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-worksheet-purpleDark dark:text-purple-200">
              <Map className="h-3.5 w-3.5" />
              Next Steps from Learning Plan
            </div>
            <button
              type="button"
              onClick={() => navigate(`/student/${studentId}?tab=dslm&view=pathway`)}
              className="text-[11px] text-worksheet-purpleDark dark:text-purple-200 hover:underline flex items-center gap-0.5"
            >
              View plan <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          {/* Carousel row */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              disabled={!canPrev}
              onClick={() => setWindowStart(s => Math.max(0, s - 1))}
              aria-label="Previous suggestion"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex flex-wrap items-center gap-1.5 flex-1">
              {visible.map(({ s: p, displayIndex, phaseLabel, phaseSeq }) => {
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
                const label = phaseSeq
                  ? `S${displayIndex}•P${phaseSeq} ${truncate(payload.topic || 'Untitled step', 28)}`
                  : `S${displayIndex} ${truncate(payload.topic || 'Untitled step', 30)}`;
                return (
                  <Tooltip key={p.id}>
                    <TooltipTrigger asChild>
                      <div className="inline-flex items-center rounded-md border border-worksheet-purple/30 bg-white/80 dark:bg-background/40 overflow-hidden">
                        <button
                          type="button"
                          className="h-7 px-2 inline-flex items-center gap-1 text-xs hover:bg-worksheet-purple/10"
                          onClick={() => { onApplyPreset(payload); setWindowStart(0); }}
                        >
                          <Sparkles className="h-3 w-3 text-worksheet-purple" />
                          <span className="max-w-[180px] truncate">{label}</span>
                        </button>
                        <button
                          type="button"
                          aria-label="Edit suggestion"
                          title="Edit suggestion"
                          className="h-7 w-6 inline-flex items-center justify-center border-l border-worksheet-purple/20 text-worksheet-purpleDark hover:bg-worksheet-purple/10"
                          onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-sm">
                      <div className="space-y-1 text-xs">
                        <div className="font-semibold">
                          Step #{displayIndex} • {phaseLabel ?? 'Free step'}
                        </div>
                        <div>{p.suggested_topic}</div>
                        {p.suggested_goal && (
                          <div><span className="opacity-70">Goal:</span> {p.suggested_goal}</div>
                        )}
                        {p.rationale && (
                          <div className="italic opacity-80"><span className="not-italic opacity-70">Why:</span> {p.rationale}</div>
                        )}
                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => openEdit(p)}
                          >
                            <Edit2 className="h-3 w-3" /> Edit suggestion
                          </Button>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              disabled={!canNext}
              onClick={() => setWindowStart(s => Math.min(Math.max(0, total - 3), s + 1))}
              aria-label="Next suggestion"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {total > 3 && (
              <span className="text-[10px] text-worksheet-purpleDark/70 dark:text-purple-200/70 flex-shrink-0 ml-1">
                {windowStart + 1}–{Math.min(windowStart + 3, total)} of {total}
              </span>
            )}
          </div>
        </div>
      </div>
      <SuggestionEditDialog
        open={!!editingId}
        value={editValue}
        onChange={(updates) => setEditValue((prev) => ({ ...prev, ...updates }))}
        onSave={saveEdit}
        onCancel={() => setEditingId(null)}
      />
    </TooltipProvider>
  );
}

export default NextStepsPresetBanner;