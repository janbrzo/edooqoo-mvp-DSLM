/**
 * LearningPlanView: the "Plan" segment of the Learning plan tab.
 *
 * Stage-driven (see `computeModelReadiness`):
 *  - setup  → SetupChecklist (Goal → Level check → Roadmap → Next lessons)
 *  - review / ready → Needs your OK → Up next → Roadmap → Goals
 *
 * It owns every dialog of the plan and every mutation entry point (each one
 * goes through `useDemoGuard`). Data comes from `useLearningPlanData`, called
 * once by DSLMTab. The full editors (MacroTimeline, GoalsView) open unchanged
 * in side sheets. Generation keeps the existing contract:
 * `onUseWorksheetSuggestion` → `writeAutoGenerateIntent` / sessionStorage
 * prefill in StudentPage: the Worksheet Generation Engine is untouched.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, RefreshCw, Target } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { SectionSkeleton } from '@/components/dslm/SectionSkeleton';
import { SuggestionEditDialog, type SuggestionEditValue } from '@/components/dslm/SuggestionEditDialog';
import { GenerateStepsDialog, type PhaseOption } from '@/components/dslm/GenerateStepsDialog';
import { GenerateRoadmapDialog } from '@/components/dslm/GenerateRoadmapDialog';
import { ConfirmDeleteDialog } from '@/components/dslm/ConfirmDeleteDialog';
import { phaseWeeks, recommendedStepsPerBatch, targetStepsForPhase } from '@/components/dslm/MacroTimeline';
import { useDemoGuard } from '@/hooks/useDemoGuard';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import type { LearningPlanData } from '@/hooks/dslm/useLearningPlanData';
import { formatGoal } from '@/lib/students/formatGoal';
import { isSuggestedGoal } from '@/lib/dslm/goals';
import type { ModelAnchor } from '@/lib/students/workspaceTabs';
import type { GoalType } from '@/types/studentProgress';
import { SetupChecklist } from './SetupChecklist';
import { ReviewStrip } from './ReviewStrip';
import { UpNextSection, type PlanSuggestion } from './UpNextSection';
import { RoadmapStrip } from './RoadmapStrip';
import { RoadmapSheet } from './RoadmapSheet';
import { GoalsSummary, type GoalSummaryRow } from './GoalsSummary';
import { GoalsSheet } from './GoalsSheet';
import { AddGoalDialog, type NewGoalValue } from './AddGoalDialog';
import { MainGoalDialog } from './MainGoalDialog';
import { LessonIdeasNotes } from './LessonIdeasNotes';

export type PlanAction = 'add_goal' | 'pick_idea' | 'generate_roadmap';

export interface WelcomeTestControls {
  send: () => Promise<boolean>;
  copyLink: () => Promise<void>;
  busy: boolean;
}

export interface LearningPlanViewProps {
  plan: LearningPlanData;
  studentId: string;
  teacherId: string;
  studentName: string;
  englishLevel: string;
  mainGoal: string;
  mainGoalTargetDate: string | null;
  useRoadmap: boolean;
  onUseRoadmapChange?: (next: boolean) => void;
  pacingMode: number;
  onPacingModeChange?: (next: number) => void;
  onMainGoalChange?: (newGoal: string) => void;
  onMainGoalTargetDateChange?: (date: string | null) => void;
  onUseWorksheetSuggestion?: (
    topic: string, goal: string, additionalInfo?: string, grammarFocus?: string,
    exercises?: string[], exerciseFocusMap?: Record<string, string>,
    autoGenerate?: boolean,
    suggestionId?: string
  ) => void;
  anchor: ModelAnchor;
  pendingAction: PlanAction | null;
  onConsumePendingAction: () => void;
  welcomeTest: WelcomeTestControls;
  onOpenTestResults: () => void;
}

const EMPTY_EDIT: SuggestionEditValue = {
  topic: '', goal: '', additionalInfo: '', grammarFocus: '', exercises: [], exerciseFocusMap: {},
};

const topicOf = (s: PlanSuggestion) => (s.suggested_topic || '').trim() || 'this suggestion';

export const LearningPlanView: React.FC<LearningPlanViewProps> = ({
  plan,
  studentId,
  teacherId,
  studentName,
  englishLevel,
  mainGoal,
  mainGoalTargetDate,
  useRoadmap,
  onUseRoadmapChange,
  pacingMode,
  onPacingModeChange,
  onMainGoalChange,
  onMainGoalTargetDateChange,
  onUseWorksheetSuggestion,
  anchor,
  pendingAction,
  onConsumePendingAction,
  welcomeTest,
  onOpenTestResults,
}) => {
  const { guardAction } = useDemoGuard();
  const [searchParams, setSearchParams] = useSearchParams();
  const { timeline, curriculum, phases, currentPhase, upNext, progress, readiness } = plan;
  const { map: progressMap, mainAggregate } = useGoalProgress(progress.goals, studentId, teacherId);

  // ── Dialog and sheet state ────────────────────────────────────────────────
  const [editing, setEditing] = useState<{ id: string; value: SuggestionEditValue } | null>(null);
  const [regenTarget, setRegenTarget] = useState<PlanSuggestion | null>(null);
  const [regenComment, setRegenComment] = useState('');
  const [removeTarget, setRemoveTarget] = useState<PlanSuggestion | null>(null);
  const [stepsDialog, setStepsDialog] = useState<null | 'first' | 'more'>(null);
  const [roadmapDialogOpen, setRoadmapDialogOpen] = useState(false);
  const [noGoalsConfirmOpen, setNoGoalsConfirmOpen] = useState(false);
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [mainGoalOpen, setMainGoalOpen] = useState(false);
  const [roadmapSheet, setRoadmapSheet] = useState<{ open: boolean; phaseId: string | null }>({ open: false, phaseId: null });
  const [goalsSheetOpen, setGoalsSheetOpen] = useState(false);

  const goalsRef = useRef<HTMLElement>(null);
  const setupRef = useRef<HTMLDivElement>(null);

  // ── Generation targets (same rules as the former PathwayView) ─────────────
  const phaseOptions: PhaseOption[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of timeline.phaseSteps) {
      if (s.phase_id) counts[s.phase_id] = (counts[s.phase_id] || 0) + 1;
    }
    return phases.map((p): PhaseOption => ({
      id: p.id,
      label: p.title,
      sequence: p.sequence_number,
      status: p.status,
      have: counts[p.id] || 0,
      need: targetStepsForPhase(p),
      perBatch: recommendedStepsPerBatch(p),
      weeks: phaseWeeks(p),
    }));
  }, [phases, timeline.phaseSteps]);

  const recommendedTargetPhaseId = useMemo<string | null>(() => {
    if (!useRoadmap) return null;
    const inProgress = phaseOptions.filter((p) => p.status === 'in_progress');
    const planned = phaseOptions.filter((p) => p.status === 'planned');
    for (const p of [...inProgress, ...planned]) {
      if (p.have < p.need) return p.id;
    }
    return null;
  }, [useRoadmap, phaseOptions]);

  const displayIndexById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of upNext) map[item.suggestion.id] = item.displayIndex;
    return map;
  }, [upNext]);

  const goalOptions = useMemo(
    () =>
      plan.activeGoals.map((g) => ({
        id: g.id,
        title: g.title,
        goal_type: g.goal_type ?? null,
        target_date: g.target_date ?? null,
      })),
    [plan.activeGoals],
  );

  // ── Suggestion actions ───────────────────────────────────────────────────
  const callSuggestion = useCallback(
    (s: PlanSuggestion, autoGenerate: boolean) => {
      if (!onUseWorksheetSuggestion) return;
      onUseWorksheetSuggestion(
        s.suggested_topic || '',
        s.suggested_goal || '',
        (s as { suggested_additional_info?: string | null }).suggested_additional_info || '',
        s.suggested_grammar_focus || '',
        s.suggested_exercises || [],
        s.suggested_exercise_focus_map || {},
        autoGenerate,
        s.id,
      );
    },
    [onUseWorksheetSuggestion],
  );

  const openEdit = useCallback((s: PlanSuggestion) => {
    setEditing({
      id: s.id,
      value: {
        topic: s.suggested_topic || '',
        goal: s.suggested_goal || '',
        additionalInfo: (s as { suggested_additional_info?: string | null }).suggested_additional_info || '',
        grammarFocus: s.suggested_grammar_focus || '',
        exercises: Array.isArray(s.suggested_exercises) ? [...s.suggested_exercises] : [],
        exerciseFocusMap: s.suggested_exercise_focus_map ? { ...s.suggested_exercise_focus_map } : {},
      },
    });
  }, []);

  const saveEdit = () => {
    if (!editing || !editing.value.topic.trim()) return;
    const { id, value } = editing;
    guardAction('Editing suggestions', () => {
      void timeline
        .updateSuggestion(id, value.topic, value.goal, value.additionalInfo, value.grammarFocus, value.exercises, value.exerciseFocusMap)
        .then((ok) => { if (ok) setEditing(null); });
    });
  };

  const openRegenerate = (s: PlanSuggestion) => {
    setRegenComment('');
    setRegenTarget(s);
  };
  const submitRegenerate = () => {
    if (!regenTarget) return;
    const id = regenTarget.id;
    const comment = regenComment.trim();
    setRegenTarget(null);
    guardAction('Regenerating suggestions', () => { void timeline.regenerateInPlace(id, comment); });
  };

  const markTaught = (s: PlanSuggestion) =>
    guardAction('Marking suggestions as taught', () => { void timeline.useSuggestion(s.id, null); });

  const restore = (s: PlanSuggestion) =>
    guardAction('Restoring suggestions', () => { void timeline.restoreSuggestion(s.id); });

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const id = removeTarget.id;
    guardAction('Removing suggestions', () => { void timeline.deleteSuggestion(id); });
  };

  const generateSteps = async (count: number, phaseId: string | null, mode: 'first' | 'more') => {
    const excludeIds = mode === 'more' ? upNext.map((item) => item.suggestion.id) : [];
    const validPhaseId = phaseId && phaseOptions.some((p) => p.id === phaseId) ? phaseId : null;
    await timeline.generateNextSteps({
      mode: excludeIds.length > 0 ? 'add' : 'replace',
      count,
      excludeIds,
      phaseId: useRoadmap ? validPhaseId : null,
    });
  };

  const openStepsDialog = useCallback(
    (mode: 'first' | 'more') => guardAction('Generating lesson suggestions', () => setStepsDialog(mode)),
    [guardAction],
  );

  // ── Roadmap and goals actions ────────────────────────────────────────────
  const requestGenerateRoadmap = useCallback(() => {
    guardAction('Generating a roadmap', () => {
      if (progress.goals.length > 0) setRoadmapDialogOpen(true);
      else setNoGoalsConfirmOpen(true);
    });
  }, [guardAction, progress.goals.length]);

  const openAddGoal = useCallback(() => {
    // One modal at a time: a request coming from inside a sheet closes it first.
    setRoadmapSheet((prev) => (prev.open ? { ...prev, open: false } : prev));
    setGoalsSheetOpen(false);
    setAddGoalOpen(true);
  }, []);

  const submitGoal = async (value: NewGoalValue) => {
    let added: unknown = null;
    guardAction('Adding goals', () => {
      added = progress.addGoal(value.type as GoalType, value.title, value.description, value.targetDate || undefined);
    });
    await added;
  };

  // ── Requests from DSLMTab (focus deep links, status-line hints, events) ──
  useEffect(() => {
    if (!pendingAction || !plan.isReady) return;
    if (pendingAction === 'add_goal') {
      openAddGoal();
    } else if (pendingAction === 'generate_roadmap') {
      requestGenerateRoadmap();
    } else if (pendingAction === 'pick_idea') {
      if (upNext.length === 0) openStepsDialog('first');
      else {
        requestAnimationFrame(() => {
          document.querySelector('[data-spotlight="pick-idea"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    }
    onConsumePendingAction();
  }, [pendingAction, plan.isReady, upNext.length, openAddGoal, requestGenerateRoadmap, openStepsDialog, onConsumePendingAction]);

  // Any other surface may still ask for a suggestion pick (legacy event).
  useEffect(() => {
    const handler = () => {
      if (upNext.length === 0) openStepsDialog('first');
      else document.querySelector('[data-spotlight="pick-idea"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    window.addEventListener('pathway:pickIdea', handler);
    return () => window.removeEventListener('pathway:pickIdea', handler);
  }, [upNext.length, openStepsDialog]);

  // `view=goals` deep link: scroll to the goals (or to the checklist in setup).
  useEffect(() => {
    if (anchor !== 'goals' || !plan.isReady) return;
    const frame = requestAnimationFrame(() => {
      const target = readiness.stage === 'setup' ? setupRef.current : goalsRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, plan.isReady, readiness.stage]);

  // `editSuggestion=<id>` (NextStepsPresetBanner): open the editor, consume the param.
  const editSuggestionParam = searchParams.get('editSuggestion');
  useEffect(() => {
    if (!editSuggestionParam) return;
    const all = [...timeline.phaseSteps, ...timeline.nextSteps] as PlanSuggestion[];
    const target = all.find((s) => s.id === editSuggestionParam);
    if (!target) return;
    queueMicrotask(() => openEdit(target));
    setSearchParams(
      (prev) => {
        if (!prev.has('editSuggestion')) return prev;
        const next = new URLSearchParams(prev);
        next.delete('editSuggestion');
        return next;
      },
      { replace: true },
    );
  }, [editSuggestionParam, timeline.phaseSteps, timeline.nextSteps, openEdit, setSearchParams]);

  // ── Derived view data ────────────────────────────────────────────────────
  const goalRows: GoalSummaryRow[] = useMemo(() => {
    const order = (type: string) => (type === 'supporting' ? 0 : type === 'additional' ? 1 : 2);
    return plan.activeGoals
      .filter((g) => !isSuggestedGoal(g))
      .sort((a, b) => order(a.goal_type) - order(b.goal_type) || (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((g) => ({ id: g.id, title: g.title, targetDate: g.target_date, pct: progressMap.get(g.id)?.pct ?? null }));
  }, [plan.activeGoals, progressMap]);

  const queuedInCurrentPhase = currentPhase
    ? upNext.filter((item) => item.phaseId === currentPhase.id).length
    : 0;
  const currentPhaseCaption = currentPhase ? `Phase ${currentPhase.sequence_number}: ${currentPhase.title}` : null;
  const mainGoalLabel = formatGoal(mainGoal) || null;

  if (!plan.isReady) return <SectionSkeleton />;

  const actions = {
    onGenerate: (s: PlanSuggestion) => callSuggestion(s, true),
    onFillForm: (s: PlanSuggestion) => callSuggestion(s, false),
    onEdit: openEdit,
    onRegenerate: openRegenerate,
    onMarkTaught: markTaught,
    onRemove: (s: PlanSuggestion) => setRemoveTarget(s),
  };

  return (
    <div className="space-y-8" data-testid="learning-plan-view">
      <ReviewStrip
        studentId={studentId}
        englishLevel={englishLevel}
        pendingCount={plan.pendingReviewCount}
        showLevelChange={plan.attention.level}
        pacingProposals={plan.pacing.proposals}
        goals={progress.goals}
        hasSuggestedGoals={plan.suggestedGoals.length > 0}
        updateGoal={progress.updateGoal}
        deleteGoal={progress.deleteGoal}
        onResolved={() => plan.attention.refetch()}
      />

      {readiness.stage === 'setup' ? (
        <div ref={setupRef} className="scroll-mt-24">
          <SetupChecklist
            studentName={studentName}
            steps={readiness.steps}
            nextStepKey={readiness.nextStepKey}
            mainGoalLabel={mainGoalLabel}
            activeGoalsCount={goalRows.length}
            welcomeTest={{ state: plan.welcomeTest.state, sentAt: plan.welcomeTest.sentAt }}
            phasesCount={phases.length}
            currentPhaseCaption={currentPhaseCaption}
            testBusy={welcomeTest.busy}
            roadmapBusy={curriculum.generating}
            suggestionsBusy={timeline.generating}
            onSetMainGoal={() => setMainGoalOpen(true)}
            onAddGoal={openAddGoal}
            onManageGoals={() => setGoalsSheetOpen(true)}
            onSendTest={() => guardAction('Sending the Welcome Test', () => { void welcomeTest.send(); })}
            onCopyTestLink={() => guardAction('Creating a Welcome Test link', () => { void welcomeTest.copyLink(); })}
            onOpenTestResults={onOpenTestResults}
            onGenerateRoadmap={requestGenerateRoadmap}
            onOpenRoadmap={() => setRoadmapSheet({ open: true, phaseId: currentPhase?.id ?? null })}
            onGetSuggestions={() => openStepsDialog('first')}
          />
          <div className="mt-2">
            <LessonIdeasNotes studentId={studentId} teacherId={teacherId} />
          </div>
        </div>
      ) : (
        <>
          <UpNextSection
            studentId={studentId}
            items={upNext}
            usedSteps={timeline.usedSteps}
            generating={timeline.generating}
            onAddMore={() => openStepsDialog('more')}
            onRestore={restore}
            onRemoveUsed={(s) => setRemoveTarget(s)}
            {...actions}
          >
            <LessonIdeasNotes studentId={studentId} teacherId={teacherId} />
          </UpNextSection>
          <RoadmapStrip
            phases={phases}
            currentPhaseId={currentPhase?.id ?? null}
            queuedInCurrentPhase={queuedInCurrentPhase}
            useRoadmap={useRoadmap}
            generating={curriculum.generating}
            onOpenPhase={(phaseId) => setRoadmapSheet({ open: true, phaseId })}
            onGenerateRoadmap={requestGenerateRoadmap}
          />
          <GoalsSummary
            ref={goalsRef}
            mainGoalLabel={mainGoalLabel}
            mainGoalTargetDate={mainGoalTargetDate}
            mainGoalPct={mainAggregate.pct}
            goals={goalRows}
            totalGoals={progress.goals.length}
            onEditMainGoal={() => setMainGoalOpen(true)}
            onAddGoal={openAddGoal}
            onOpenAll={() => setGoalsSheetOpen(true)}
          />
        </>
      )}

      {/* ── Side panels: the full editors, unchanged ── */}
      <RoadmapSheet
        open={roadmapSheet.open}
        onOpenChange={(open) => setRoadmapSheet((prev) => ({ ...prev, open }))}
        initialPhaseId={roadmapSheet.phaseId}
        studentId={studentId}
        teacherId={teacherId}
        useRoadmap={useRoadmap}
        onUseRoadmapChange={onUseRoadmapChange
          ? (next) => guardAction('Changing roadmap settings', () => onUseRoadmapChange(next))
          : undefined}
        pacingMode={pacingMode}
        onPacingModeChange={onPacingModeChange
          ? (next) => guardAction('Changing pacing', () => onPacingModeChange(next))
          : undefined}
        phaseSteps={timeline.phaseSteps}
        displayIndexById={displayIndexById}
        generatingSteps={timeline.generating}
        onUseSuggestion={(s) => callSuggestion(s, false)}
        onUseAndGenerate={(s) => callSuggestion(s, true)}
        onEditSuggestion={openEdit}
        onDeleteSuggestion={(id) => guardAction('Removing suggestions', () => { void timeline.deleteSuggestion(id); })}
        onMarkUsed={(id) => guardAction('Marking suggestions as taught', () => { void timeline.useSuggestion(id, null); })}
        onRegenerateOne={(id, comment) => timeline.regenerateInPlace(id, comment)}
        onGenerateForPhase={(phaseId, count, comment) =>
          timeline.generateNextSteps({ mode: 'add', count, teacherComment: comment, phaseId })}
      />
      <GoalsSheet
        open={goalsSheetOpen}
        onOpenChange={setGoalsSheetOpen}
        studentId={studentId}
        teacherId={teacherId}
        studentName={studentName}
        englishLevel={englishLevel}
        mainGoal={mainGoal}
        mainGoalTargetDate={mainGoalTargetDate}
        onMainGoalChange={onMainGoalChange}
        onMainGoalTargetDateChange={onMainGoalTargetDateChange}
      />

      {/* ── Dialogs ── */}
      <SuggestionEditDialog
        open={!!editing}
        value={editing?.value ?? EMPTY_EDIT}
        onChange={(updates) => setEditing((prev) => (prev ? { ...prev, value: { ...prev.value, ...updates } } : prev))}
        onSave={saveEdit}
        onCancel={() => setEditing(null)}
      />

      <Dialog open={!!regenTarget} onOpenChange={(open) => { if (!open) setRegenTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate this suggestion</DialogTitle>
            <DialogDescription>
              Tell the AI what to change. Leave empty to regenerate with default logic. Only this suggestion is replaced, in the same place in the queue.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={regenComment}
            onChange={(e) => setRegenComment(e.target.value)}
            placeholder="e.g., Focus more on speaking practice for negotiations. Avoid grammar drills."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenTarget(null)}>Cancel</Button>
            <Button onClick={submitRegenerate} disabled={timeline.generating}>
              {timeline.generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />}
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!removeTarget}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        label={removeTarget ? `"${topicOf(removeTarget)}"` : 'suggestion'}
        description="The suggestion leaves the plan. You can generate new ones at any time."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
      />

      <GenerateStepsDialog
        open={stepsDialog !== null}
        onOpenChange={(open) => { if (!open) setStepsDialog(null); }}
        mode={stepsDialog ?? 'first'}
        defaultCount={3}
        defaultTargetPhaseId={recommendedTargetPhaseId}
        phaseOptions={phaseOptions}
        showPhaseSelector={useRoadmap}
        generating={timeline.generating}
        activeQueueSize={upNext.length}
        onConfirm={(count, phaseId) => generateSteps(count, phaseId, stepsDialog ?? 'first')}
      />

      <GenerateRoadmapDialog
        open={roadmapDialogOpen}
        onOpenChange={setRoadmapDialogOpen}
        mode="replace"
        goals={goalOptions}
        generating={curriculum.generating}
        isRegeneration={phases.length > 0}
        onConfirm={async (opts) => { await curriculum.generatePhases('replace', opts); }}
      />

      <AlertDialog open={noGoalsConfirmOpen} onOpenChange={setNoGoalsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate roadmap without goals?</AlertDialogTitle>
            <AlertDialogDescription>
              This student has no learning goals defined. The AI will fall back to the main goal and English level only, which usually produces a more generic plan. You can add a goal first for a sharper roadmap.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={() => { setNoGoalsConfirmOpen(false); openAddGoal(); }}>
              <Target className="mr-1 h-4 w-4" aria-hidden="true" /> Add goal first
            </Button>
            <AlertDialogAction
              onClick={() => {
                setNoGoalsConfirmOpen(false);
                void curriculum.generatePhases('replace');
              }}
            >
              Generate anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddGoalDialog
        open={addGoalOpen}
        onOpenChange={setAddGoalOpen}
        studentName={studentName}
        onSubmit={submitGoal}
      />

      <MainGoalDialog
        open={mainGoalOpen}
        onOpenChange={setMainGoalOpen}
        mainGoal={mainGoal}
        mainGoalTargetDate={mainGoalTargetDate}
        onMainGoalChange={onMainGoalChange
          ? (goal) => guardAction('Changing the main goal', () => onMainGoalChange(goal))
          : undefined}
        onMainGoalTargetDateChange={onMainGoalTargetDateChange
          ? (date) => guardAction('Changing the deadline', () => onMainGoalTargetDateChange(date))
          : undefined}
      />

    </div>
  );
};
