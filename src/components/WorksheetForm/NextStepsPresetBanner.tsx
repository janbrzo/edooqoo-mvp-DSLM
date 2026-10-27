/**
 * v6.9.10: NextStepsPresetBanner
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
import { useDemoContext } from '@/contexts/DemoContext';
import { orderUpNext } from '@/lib/dslm/learningPlan';
import { usePlanEvidenceMetrics } from '@/hooks/dslm/usePlanEvidenceMetrics';
import { explainRecommendation } from '@/lib/dslm/recommendationExplainability';
import { resolveAppliedEvidenceSuggestion, type AppliedEvidenceSource, type AppliedLessonFields } from '@/lib/dslm/recommendationEvidenceView';
import { EvidenceBadge, WhyThisLessonBanner } from '@/components/dslm/WhyThisLessonBanner';
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
  appliedEvidenceSource?: AppliedEvidenceSource | null;
  lessonFields?: AppliedLessonFields;
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
  appliedEvidenceSource,
  lessonFields,
}: NextStepsPresetBannerProps) {
  const navigate = useNavigate();
  const { isDemoMode } = useDemoContext();

  // Demo has no suggestion rows; empty ids keep demo ids out of Supabase and
  // the banner is hidden below (it would claim the demo student has no context).
  const enabledStudentId = isDemoMode ? '' : studentId || '';
  const enabledTeacherId = isDemoMode ? '' : teacherId || '';
  const { nextSteps, phaseSteps, loading, useSuggestion, updateSuggestion } = useFutureTimeline({
    studentId: enabledStudentId,
    teacherId: enabledTeacherId,
  });
  const { phases } = useCurriculumPhases({
    studentId: enabledStudentId,
    teacherId: enabledTeacherId,
  });
  // Existing hooks retain their last rows while another learner is loading.
  const scopedPhaseSteps = phaseSteps.filter(row => row.student_id === studentId && row.teacher_id === teacherId);
  const scopedNextSteps = nextSteps.filter(row => row.student_id === studentId && row.teacher_id === teacherId);
  const scopedPhases = phases.filter(row => row.student_id === studentId && row.teacher_id === teacherId);
  const signals = usePlanEvidenceMetrics(enabledStudentId, enabledTeacherId);
  const appliedSuggestion = lessonFields ? resolveAppliedEvidenceSuggestion({
    source: appliedEvidenceSource ?? null, rows: [...phaseSteps, ...nextSteps],
    studentId: studentId || '', teacherId: teacherId || '', fields: lessonFields,
  }) : null;
  const now = Date.now();
  const explain = (suggestion: typeof phaseSteps[number]) => explainRecommendation({
    suggestion, now, metrics: signals.error ? [] : signals.rawMetrics, phases: scopedPhases,
  });

  // Same queue as the Prep card and Learning plan Up next (AGENTS.md: orderUpNext).
  const { sortedItems } = useMemo(() => {
    const phaseSeqById: Record<string, number> = {};
    scopedPhases.forEach((p) => { phaseSeqById[p.id] = p.sequence_number; });
    const items = orderUpNext({ phases: scopedPhases, phaseSteps: scopedPhaseSteps, nextSteps: scopedNextSteps }).map((item) => ({
      s: item.suggestion as any,
      displayIndex: item.displayIndex,
      phaseLabel: item.phaseLabel,
      phaseSeq: item.phaseId ? (phaseSeqById[item.phaseId] ?? null) : null,
    }));
    return { sortedItems: items };
  }, [phaseSteps, nextSteps, phases, studentId, teacherId]);

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

  // v6.9.13: local Edit dialog (no nav away from form).
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

  if (!studentId || !teacherId || isDemoMode) return null;

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
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-start gap-2 text-sm text-foreground">
            <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div>
                No 1-Minute Prep suggestions for <strong>{studentName || 'this student'}</strong> yet.
              </div>
              <div className="text-[12px] opacity-90 leading-snug">
                Add a placement test, goal, or lesson note to make 1-Minute Prep useful for this student.
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-8 gap-1 whitespace-normal self-center"
            onClick={() => navigate(`/student/${studentId}?tab=dslm&view=pathway`)}
          >
            Open student context
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mb-3">
        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
              <Map className="h-3.5 w-3.5" />
              1-Minute Prep suggestions from DSLM
            </div>
            <Button
              type="button"
              variant="link" size="sm"
              onClick={() => navigate(`/student/${studentId}?tab=dslm&view=pathway`)}
              className="h-auto p-0 text-xs flex items-center gap-0.5"
            >
              View plan <ArrowUpRight className="h-3 w-3" />
            </Button>
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

            <div className="flex min-w-0 flex-wrap items-start gap-2 flex-1">
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
                      <div className="min-w-0 max-w-full space-y-1">
                      <div className="flex min-w-0 items-center rounded-md border border-primary/30 bg-background overflow-hidden">
                        <Button
                          type="button"
                          variant="ghost" size="sm"
                          className="h-8 min-w-0 px-2 inline-flex items-center gap-1 text-xs rounded-none"
                          onClick={() => { onApplyPreset(payload); setWindowStart(0); }}
                          aria-label={`Apply suggestion: ${payload.topic}`}
                        >
                          <Sparkles className="h-3 w-3 text-primary" />
                          <span className="min-w-0 max-w-[180px] truncate">{label}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost" size="icon"
                          aria-label="Edit suggestion"
                          title="Edit suggestion"
                          className="h-8 w-7 shrink-0 rounded-none border-l border-primary/20 text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {!signals.loading && !signals.error && <EvidenceBadge explanation={explain(p)} />}
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
                          <div className="italic opacity-80"><span className="not-italic opacity-70">Suggested rationale:</span> {p.rationale}</div>
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
              <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
                {windowStart + 1}–{Math.min(windowStart + 3, total)} of {total}
              </span>
            )}
          </div>
        </div>
        {!loading && appliedSuggestion && (
          <div className="mt-3">
            <WhyThisLessonBanner key={`${studentId}-${appliedSuggestion.id}`} explanation={explain(appliedSuggestion)}
              loading={signals.loading} error={signals.error} onRetry={() => { void signals.refetch(); }}
              rationale={appliedSuggestion.rationale} />
          </div>
        )}
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
