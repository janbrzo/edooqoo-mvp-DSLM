/**
 * PathwayView v4.2 — Unified Next Steps × Phases + Roadmap toggle.
 *
 * Next Steps section = ALL active phase_steps (across phases) + legacy free-floating next_steps,
 * sorted by (phase.sequence_number ASC, suggestion.sequence_number ASC).
 * displayIndex is stable per item (1..N global), shown in both Next Steps and inside the phase.
 * Edit dialog is shared via SuggestionEditDialog (now incl. exercises + V/G focus map).
 * Per-step regeneration uses regenerateInPlace — preserves the original sequence position.
 * When useRoadmap=false: phase context is ignored when generating next steps.
 */
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useFutureTimeline } from '@/hooks/useFutureTimeline';
import { useStudentKnowledge } from '@/hooks/useStudentKnowledge';
import { useCurriculumPhases } from '@/hooks/dslm/useCurriculumPhases';
import { NextStepsSection } from './NextStepsSection';
import { MacroTimeline } from './MacroTimeline';
import { SuggestionEditDialog, type SuggestionEditValue } from './SuggestionEditDialog';
import { StudentKnowledgeEntryCard } from '@/components/student-knowledge/StudentKnowledgeEntryCard';
import { ChevronDown, StickyNote, Map } from 'lucide-react';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { PacingProposalCard } from './PacingProposalCard';
import { usePacingProposals } from '@/hooks/usePacingProposals';
import { cn } from '@/lib/utils';

interface PathwayViewProps {
  studentId: string;
  teacherId: string;
  studentName: string;
  englishLevel: string;
  mainGoal: string;
  studentNotes?: string[];
  /** When false, the Learning Roadmap is shown but excluded from generation. */
  useRoadmap?: boolean;
  onUseRoadmapChange?: (next: boolean) => void;
  /** v4.4: pacing 0-100 (Scientific ↔ Pragmatic). */
  pacingMode?: number;
  onPacingModeChange?: (next: number) => void;
  onUseWorksheetSuggestion?: (
    topic: string, goal: string, additionalInfo?: string, grammarFocus?: string,
    exercises?: string[], exerciseFocusMap?: Record<string, string>,
    autoGenerate?: boolean,
    suggestionId?: string
  ) => void;
}

const EMPTY_EDIT: SuggestionEditValue = {
  topic: '', goal: '', additionalInfo: '', grammarFocus: '', exercises: [], exerciseFocusMap: {},
};

export const PathwayView: React.FC<PathwayViewProps> = ({
  studentId,
  teacherId,
  useRoadmap = true,
  onUseRoadmapChange,
  pacingMode = 50,
  onPacingModeChange,
  onUseWorksheetSuggestion,
}) => {
  const {
    nextSteps, phaseSteps, usedSteps, generating,
    generateNextSteps, deleteSuggestion, updateSuggestion, regenerateInPlace,
    useSuggestion, restoreSuggestion,
  } = useFutureTimeline({ studentId, teacherId });
  const { phases } = useCurriculumPhases({ studentId, teacherId });
  const { goals } = useStudentProgress({ studentId, teacherId });
  const planningNotes = useStudentKnowledge({ studentId, teacherId });
  const { proposals: pacingProposals } = usePacingProposals(studentId);

  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editedSuggestion, setEditedSuggestion] = useState<SuggestionEditValue>(EMPTY_EDIT);
  const [notesOpen, setNotesOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(true);

  const nextLessonNotes = planningNotes.entries.filter(e => e.category === 'Next Lesson Ideas');

  const currentPhase = useMemo(() => phases.find(p => p.status === 'in_progress') || null, [phases]);

  const phaseLabelById = useMemo(() => {
    const m: Record<string, string> = {};
    phases.forEach(p => { m[p.id] = `Phase ${p.sequence_number}`; });
    return m;
  }, [phases]);

  const phaseOrderById = useMemo(() => {
    const m: Record<string, number> = {};
    phases.forEach(p => { m[p.id] = p.sequence_number; });
    return m;
  }, [phases]);

  const displayIndexById = useMemo(() => {
    const m: Record<string, number> = {};
    const byPhase: Record<string, any[]> = {};
    for (const s of phaseSteps) {
      if (!s.phase_id) continue;
      (byPhase[s.phase_id] ||= []).push(s);
    }
    for (const pid of Object.keys(byPhase)) {
      const sorted = [...byPhase[pid]].sort((a, b) => a.sequence_number - b.sequence_number);
      sorted.forEach((s, idx) => { m[s.id] = idx + 1; });
    }
    const sortedLegacy = [...nextSteps].sort((a, b) => a.sequence_number - b.sequence_number);
    sortedLegacy.forEach((s, idx) => { m[s.id] = idx + 1; });
    return m;
  }, [phaseSteps, nextSteps]);

  const allActiveItems = useMemo(() => {
    const phaseSorted = [...phaseSteps].sort((a, b) => {
      const pa = a.phase_id ? (phaseOrderById[a.phase_id] ?? 999) : 999;
      const pb = b.phase_id ? (phaseOrderById[b.phase_id] ?? 999) : 999;
      const aActive = currentPhase && a.phase_id === currentPhase.id ? -1 : 0;
      const bActive = currentPhase && b.phase_id === currentPhase.id ? -1 : 0;
      if (aActive !== bActive) return aActive - bActive;
      if (pa !== pb) return pa - pb;
      return a.sequence_number - b.sequence_number;
    });
    const legacy = [...nextSteps].sort((a, b) => a.sequence_number - b.sequence_number);
    const combined = [...phaseSorted, ...legacy];
    return combined.map(s => ({
      s,
      displayIndex: displayIndexById[s.id] ?? 0,
      phaseLabel: s.phase_id ? (phaseLabelById[s.phase_id] ?? null) : null,
    }));
  }, [phaseSteps, nextSteps, currentPhase, phaseOrderById, phaseLabelById, displayIndexById]);

  const callSuggestion = (s: any, autoGenerate: boolean) => {
    if (!onUseWorksheetSuggestion) return;
    onUseWorksheetSuggestion(
      s.suggested_topic,
      s.suggested_goal || '',
      s.suggested_additional_info || '',
      s.suggested_grammar_focus || '',
      s.suggested_exercises || [],
      s.suggested_exercise_focus_map || {},
      autoGenerate,
      s.id,
    );
  };

  const handleUse = (s: any) => callSuggestion(s, false);
  const handleUseAndGenerate = (s: any) => callSuggestion(s, true);
  const handleMarkUsed = async (suggestionId: string) => {
    await useSuggestion(suggestionId, null);
  };

  const handleEditSuggestion = (s: any) => {
    setEditingSuggestionId(s.id);
    setEditedSuggestion({
      topic: s.suggested_topic,
      goal: s.suggested_goal || '',
      additionalInfo: s.suggested_additional_info || '',
      grammarFocus: s.suggested_grammar_focus || '',
      exercises: Array.isArray(s.suggested_exercises) ? [...s.suggested_exercises] : [],
      exerciseFocusMap: s.suggested_exercise_focus_map ? { ...s.suggested_exercise_focus_map } : {},
    });
  };

  const handleSaveSuggestion = async () => {
    if (!editingSuggestionId || !editedSuggestion.topic.trim()) return;
    await updateSuggestion(
      editingSuggestionId,
      editedSuggestion.topic, editedSuggestion.goal,
      editedSuggestion.additionalInfo, editedSuggestion.grammarFocus,
      editedSuggestion.exercises, editedSuggestion.exerciseFocusMap,
    );
    setEditingSuggestionId(null);
  };

  // Roadmap toggle: when off, never bind to a phase.
  const targetPhaseId = useRoadmap ? (currentPhase?.id ?? null) : null;
  const currentPhaseLabelForUI = useRoadmap && currentPhase
    ? `${phaseLabelById[currentPhase.id]}: ${currentPhase.title}` : null;

  const regenerateOne = async (id: string, comment: string) => {
    return regenerateInPlace(id, comment);
  };

  return (
    <div className="space-y-4">
      {pacingProposals.length > 0 && (
        <div className="space-y-2">
          {pacingProposals.map(p => (
            <PacingProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      )}
      <NextStepsSection
        items={allActiveItems}
        studentId={studentId}
        generating={generating}
        hasGoals={goals.length > 0}
        currentPhaseLabel={currentPhaseLabelForUI}
        onUseAndGenerate={handleUseAndGenerate}
        onUse={handleUse}
        onEdit={handleEditSuggestion}
        onDelete={deleteSuggestion}
        onMarkUsed={handleMarkUsed}
        usedSteps={usedSteps}
        onRestore={restoreSuggestion}
        onGenerateMore={(count, excludeIds) =>
          generateNextSteps({
            mode: excludeIds.length > 0 ? 'add' : 'replace',
            count, excludeIds, phaseId: targetPhaseId,
          })
        }
        onRegenerateOne={regenerateOne}
      />

      <Collapsible open={roadmapOpen} onOpenChange={setRoadmapOpen}>
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex-1 justify-between text-muted-foreground">
              <span className="flex items-center gap-2">
                <Map className="h-4 w-4" />
                Learning Roadmap
                {!useRoadmap && (
                  <Badge variant="outline" className="text-[9px] ml-1">Disabled</Badge>
                )}
              </span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', roadmapOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1">
            {onUseRoadmapChange && (
              <div className="flex items-center gap-1.5 px-2">
                <Switch
                  id="dslm-use-roadmap"
                  checked={useRoadmap}
                  onCheckedChange={onUseRoadmapChange}
                />
                <Label htmlFor="dslm-use-roadmap" className="text-[11px] text-muted-foreground cursor-pointer">
                  Roadmap
                </Label>
              </div>
            )}
          </div>
        </div>
        <CollapsibleContent className="pt-2">
          <div className={cn(!useRoadmap && 'opacity-60 pointer-events-none')}>
            <MacroTimeline
              studentId={studentId}
              teacherId={teacherId}
              suggestions={phaseSteps}
              displayIndexById={displayIndexById}
              generatingSteps={generating}
              onUseSuggestion={handleUse}
              onUseAndGenerate={handleUseAndGenerate}
              onEditSuggestion={handleEditSuggestion}
              onDeleteSuggestion={deleteSuggestion}
              onMarkUsed={handleMarkUsed}
              onRegenerateOne={regenerateOne}
              onGenerateForPhase={(phaseId, count, comment) =>
                generateNextSteps({ mode: 'add', count, teacherComment: comment, phaseId })
              }
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-muted-foreground">
            <span className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Next Lesson Ideas ({nextLessonNotes.length})
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', notesOpen && 'rotate-180')} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          {nextLessonNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No planning notes yet</p>
          ) : (
            nextLessonNotes.map(entry => (
              <StudentKnowledgeEntryCard
                key={entry.id}
                entry={entry}
                onView={() => {}} onEdit={() => {}} onDelete={planningNotes.deleteEntry}
                onMarkOutdated={planningNotes.markAsOutdated}
                onMarkCurrent={planningNotes.markAsCurrent}
              />
            ))
          )}
        </CollapsibleContent>
      </Collapsible>

      <SuggestionEditDialog
        open={!!editingSuggestionId}
        value={editedSuggestion}
        onChange={(updates) => setEditedSuggestion(prev => ({ ...prev, ...updates }))}
        onSave={handleSaveSuggestion}
        onCancel={() => setEditingSuggestionId(null)}
      />
    </div>
  );
};
