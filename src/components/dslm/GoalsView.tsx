/**
 * GoalsView, "Where they're going", learning goals and objectives.
 * Compact: Main Goal inline, Supporting open by default, Additional collapsed, Notes collapsed.
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { useStudentKnowledge } from '@/hooks/useStudentKnowledge';
import { ELEMENT_TYPES } from '@/types/studentProgress';
import { MAIN_GOALS, formatGoalLabel } from '@/constants/studentGoals';
import { GoalCard } from '@/components/student-progress/GoalCard';
import { StudentKnowledgeEntryCard } from '@/components/student-knowledge/StudentKnowledgeEntryCard';
import { CollapsibleSection } from './CollapsibleSection';
import { Target, BookOpen, Plus, Edit, Check, X, Calendar, StickyNote, Archive, CheckCircle2 } from 'lucide-react';
import { DeadlinePicker } from '@/components/shared/DeadlinePicker';
import { EditGoalDialog } from '@/components/student-progress/EditGoalDialog';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import { GoalProgressBar } from '@/components/student-progress/GoalProgressBar';
import { SuggestedGoalsCard } from './plan/SuggestedGoalsCard';
import { AddGoalDialog, type NewGoalValue } from './plan/AddGoalDialog';

interface GoalsViewProps {
  studentId: string;
  teacherId: string;
  studentName: string;
  englishLevel: string;
  mainGoal: string;
  mainGoalTargetDate: string | null;
  onMainGoalChange?: (newGoal: string) => void;
  onMainGoalTargetDateChange?: (date: string | null) => void;
  /** v6.9.29: set by DSLMTab when window event `dslm:addGoal` fires from Roadmap. */
  pendingAddGoal?: boolean;
  onConsumePendingAddGoal?: () => void;
  /**
   * 2026-10: when false, GoalsView ignores the global `dslm:addGoal` event.
   * The Learning plan owns that event (one dialog, never two); GoalsView
   * inside the goals panel only reacts to its own "Add" buttons.
   */
  listenForAddGoalEvents?: boolean;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  studentId,
  teacherId,
  studentName,
  englishLevel,
  mainGoal,
  mainGoalTargetDate,
  onMainGoalChange,
  onMainGoalTargetDateChange,
  pendingAddGoal,
  onConsumePendingAddGoal,
  listenForAddGoalEvents = true,
}) => {
  const { goals, loading, addGoal, updateGoal, deleteGoal, archiveGoal, unarchiveGoal, addElement, updateElementRating, deleteElement } = useStudentProgress({ studentId, teacherId });
  const goalNotes = useStudentKnowledge({ studentId, teacherId });

  const [isEditingMainGoal, setIsEditingMainGoal] = useState(false);
  const [editedMainGoal, setEditedMainGoal] = useState(mainGoal);
  const [editedTargetDate, setEditedTargetDate] = useState(mainGoalTargetDate || '');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddElement, setShowAddElement] = useState<string | null>(null);
  const [addGoalType, setAddGoalType] = useState<string>('supporting');
  const [newElement, setNewElement] = useState({ type: 'grammar', title: '', description: '' });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  const goalNotesEntries = goalNotes.entries.filter(e => e.category === 'Goals');
  const isActive = (g: any) => !g.is_achieved && !g.archived_at;
  const supportingGoals = goals.filter(g => g.goal_type === 'supporting' && isActive(g));
  const additionalGoals = goals.filter(g => g.goal_type === 'additional' && isActive(g));
  const achievedGoals = goals.filter(g => g.is_achieved && !g.archived_at);
  const archivedGoals = goals.filter(g => !!(g as any).archived_at);

  const { map: progressMap, mainAggregate } = useGoalProgress(goals as any, studentId, teacherId);
  const editingGoal = editingGoalId ? (goals.find(g => g.id === editingGoalId) || null) : null;

  // v6.9.29: open Add-Goal modal when DSLMTab signals a pending request.
  React.useEffect(() => {
    if (pendingAddGoal) {
      // v6.9.36: default new goal type to 'supporting' so the modal opens
      // in the expected mode (matches the Add button used elsewhere).
      setAddGoalType('supporting');
      setShowAddGoal(true);
      onConsumePendingAddGoal?.();
    }
  }, [pendingAddGoal, onConsumePendingAddGoal]);

  // v6.9.41 P2: also open via window event so late mounts still
  // catch the request after focus=add-goal-modal has already been consumed.
  React.useEffect(() => {
    if (!listenForAddGoalEvents) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.studentId && detail.studentId !== studentId) return;
      setAddGoalType('supporting');
      setShowAddGoal(true);
    };
    window.addEventListener('dslm:addGoal', handler as EventListener);
    return () => window.removeEventListener('dslm:addGoal', handler as EventListener);
  }, [studentId, listenForAddGoalEvents]);

  const renderGoalCard = (goal: any) => {
    const r = progressMap.get(goal.id);
    return (
      <GoalCard
        key={goal.id} goal={goal}
        progressPct={r?.pct ?? null}
        isManualOverride={r?.isManualOverride}
        signalsLabel={r?.signalsLabel}
        onDelete={() => deleteGoal(goal.id)}
        onAddElement={() => setShowAddElement(goal.id)}
        onRateElement={updateElementRating}
        onDeleteElement={deleteElement}
        onEdit={() => setEditingGoalId(goal.id)}
        onArchive={() => archiveGoal(goal.id)}
        onUnarchive={() => unarchiveGoal(goal.id)}
        onMarkAchieved={() => updateGoal(goal.id, { is_achieved: true })}
        onSetManualProgress={(pct) => updateGoal(goal.id, { manual_progress_pct: pct } as any)}
        isSuggested={goal.source === 'welcome_test_auto' && !goal.accepted_at}
      />
    );
  };

  const handleSaveMainGoal = async () => {
    if (onMainGoalChange && editedMainGoal !== mainGoal) {
      await onMainGoalChange(editedMainGoal);
    }
    if (onMainGoalTargetDateChange) {
      await onMainGoalTargetDateChange(editedTargetDate || null);
    }
    setIsEditingMainGoal(false);
  };

  const handleAddGoal = async (value: NewGoalValue) => {
    if (!value.title.trim()) return;
    await addGoal(value.type as any, value.title, value.description, value.targetDate || undefined);
  };

  const handleAddElement = async (goalId: string) => {
    if (!newElement.title.trim()) return;
    await addElement(goalId, newElement.type as any, newElement.title, newElement.description);
    setNewElement({ type: 'grammar', title: '', description: '' });
    setShowAddElement(null);
  };

  const deadlineDisplay = (() => {
    if (!mainGoalTargetDate) return null;
    const target = new Date(mainGoalTargetDate);
    const now = new Date();
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Past deadline';
    if (diffDays === 0) return 'Today';
    if (diffDays <= 30) return `${diffDays} days left`;
    const months = Math.round(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} left`;
  })();

  const addBtn = (type: 'supporting' | 'additional') => (
    <Button
      size="sm" variant="ghost" className="h-7 text-xs"
      onClick={(e) => { e.stopPropagation(); setAddGoalType(type); setShowAddGoal(true); }}
    >
      <Plus className="h-3 w-3 mr-1" /> Add
    </Button>
  );

  return (
    <div className="space-y-3">
      {/* Main Goal: compact inline */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-4">
          {isEditingMainGoal ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Main Goal</span>
              </div>
              <Select value={editedMainGoal} onValueChange={setEditedMainGoal}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAIN_GOALS.map(g => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DeadlinePicker value={editedTargetDate} onChange={setEditedTargetDate} compact />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8" onClick={handleSaveMainGoal}>
                  <Check className="h-3 w-3 mr-1" /> Save
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setIsEditingMainGoal(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Target className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Main goal</span>
              <span className="text-base font-semibold">{formatGoalLabel(mainGoal)}</span>
              {deadlineDisplay && (
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  {deadlineDisplay}
                </Badge>
              )}
              <GoalProgressBar value={mainAggregate.pct} signalsLabel={mainAggregate.signalsLabel} className="ml-2" />
              <Button
                size="sm" variant="ghost" className="h-7 ml-auto" aria-label="Edit main goal"
                onClick={() => { setEditedMainGoal(mainGoal); setEditedTargetDate(mainGoalTargetDate || ''); setIsEditingMainGoal(true); }}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <SuggestedGoalsCard goals={goals} updateGoal={updateGoal} deleteGoal={deleteGoal} />

      {/* Supporting Goals: open by default */}
      <CollapsibleSection
        id="goals-supporting"
        title="Supporting Goals"
        icon={Target}
        count={supportingGoals.length}
        defaultOpen
        rightSlot={addBtn('supporting')}
        description="Goals that support the main learning objective"
      >
        {supportingGoals.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No supporting goals yet</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {supportingGoals.map(renderGoalCard)}
          </div>
        )}
      </CollapsibleSection>

      {/* Model Cockpit K3, secondary goal lists behind one disclosure. */}
      <CollapsibleSection
        id="goals-more"
        title="More goals & notes"
        icon={StickyNote}
        count={additionalGoals.length + achievedGoals.length + archivedGoals.length + goalNotesEntries.length}
        description="Side objectives, achieved and archived goals, and goal notes"
        forceMountContent
        className="border-dashed"
      >
        <div className="space-y-3">
        {/* Additional Goals: collapsed by default */}
        <CollapsibleSection
          id="goals-additional"
          title="Additional Goals"
          icon={BookOpen}
          count={additionalGoals.length}
          rightSlot={addBtn('additional')}
          description="Important side objectives for the student"
        >
          {additionalGoals.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No additional goals yet</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {additionalGoals.map(renderGoalCard)}
            </div>
          )}
        </CollapsibleSection>

        {/* v5.0: Achieved Goals, collapsed by default */}
        {achievedGoals.length > 0 && (
          <CollapsibleSection id="goals-achieved" title="Achieved Goals" icon={CheckCircle2} count={achievedGoals.length}>
            <div className="grid md:grid-cols-2 gap-3">
              {achievedGoals.map(renderGoalCard)}
            </div>
          </CollapsibleSection>
        )}

        {/* v5.0: Archived Goals, collapsed by default */}
        {archivedGoals.length > 0 && (
          <CollapsibleSection id="goals-archived" title="Archived Goals" icon={Archive} count={archivedGoals.length}>
            <div className="grid md:grid-cols-2 gap-3">
              {archivedGoals.map(renderGoalCard)}
            </div>
          </CollapsibleSection>
        )}

        {/* Goal Notes: collapsed */}
        <CollapsibleSection id="goals-notes" title="Goal Notes" icon={StickyNote} count={goalNotesEntries.length}>
          {goalNotesEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No goal notes yet</p>
          ) : (
            <div className="space-y-2">
              {goalNotesEntries.map(entry => (
                <StudentKnowledgeEntryCard
                  key={entry.id} entry={entry}
                  onView={() => {}} onEdit={() => {}} onDelete={goalNotes.deleteEntry}
                  onMarkOutdated={goalNotes.markAsOutdated}
                  onMarkCurrent={goalNotes.markAsCurrent}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>
        </div>
      </CollapsibleSection>

      {/* Add Goal Dialog (shared with the Learning plan) */}
      <AddGoalDialog
        open={showAddGoal}
        onOpenChange={setShowAddGoal}
        studentName={studentName}
        initialType={addGoalType}
        onSubmit={handleAddGoal}
      />

      {/* Add Element Dialog */}
      <Dialog open={!!showAddElement} onOpenChange={() => setShowAddElement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Learning Element</DialogTitle>
            <DialogDescription>Add a specific skill or knowledge item to track</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Element Type</Label>
              <Select value={newElement.type} onValueChange={(v) => setNewElement({ ...newElement, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ELEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input value={newElement.title} onChange={(e) => setNewElement({ ...newElement, title: e.target.value })} placeholder="e.g. Present Perfect Tense" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={newElement.description} onChange={(e) => setNewElement({ ...newElement, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddElement(null)}>Cancel</Button>
            <Button onClick={() => showAddElement && handleAddElement(showAddElement)} disabled={!newElement.title.trim()}>Add Element</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* v5.0: Edit Goal Dialog */}
      <EditGoalDialog
        open={!!editingGoalId}
        onOpenChange={(open) => !open && setEditingGoalId(null)}
        goal={editingGoal as any}
        onSave={async (updates) => {
          if (!editingGoalId) return;
          await updateGoal(editingGoalId, {
            title: updates.title,
            description: updates.description,
            target_date: updates.target_date,
          });
        }}
      />
    </div>
  );
};
