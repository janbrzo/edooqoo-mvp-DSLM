/**
 * GoalsView — "Where they're going" — learning goals and objectives.
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
import { ELEMENT_TYPES, GOAL_TYPES } from '@/types/studentProgress';
import { MAIN_GOALS, formatGoalLabel } from '@/constants/studentGoals';
import { GoalCard } from '@/components/student-progress/GoalCard';
import { StudentKnowledgeEntryCard } from '@/components/student-knowledge/StudentKnowledgeEntryCard';
import { CollapsibleSection } from './CollapsibleSection';
import { Target, BookOpen, Plus, Edit, Check, X, Calendar, StickyNote, Archive, CheckCircle2 } from 'lucide-react';
import { DeadlinePicker } from '@/components/shared/DeadlinePicker';
import { EditGoalDialog } from '@/components/student-progress/EditGoalDialog';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import { GoalProgressBar } from '@/components/student-progress/GoalProgressBar';

interface GoalsViewProps {
  studentId: string;
  teacherId: string;
  studentName: string;
  englishLevel: string;
  mainGoal: string;
  mainGoalTargetDate: string | null;
  onMainGoalChange?: (newGoal: string) => void;
  onMainGoalTargetDateChange?: (date: string | null) => void;
  /** v6.9.29 — set by DSLMTab when window event `dslm:addGoal` fires from Roadmap. */
  pendingAddGoal?: boolean;
  onConsumePendingAddGoal?: () => void;
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
}) => {
  const { goals, loading, addGoal, updateGoal, deleteGoal, archiveGoal, unarchiveGoal, addElement, updateElementRating, deleteElement } = useStudentProgress({ studentId, teacherId });
  const goalNotes = useStudentKnowledge({ studentId, teacherId });

  const [isEditingMainGoal, setIsEditingMainGoal] = useState(false);
  const [editedMainGoal, setEditedMainGoal] = useState(mainGoal);
  const [editedTargetDate, setEditedTargetDate] = useState(mainGoalTargetDate || '');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddElement, setShowAddElement] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState({ type: 'supporting', title: '', description: '', targetDate: '' });
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

  // v6.9.29 — open Add-Goal modal when DSLMTab signals a pending request.
  React.useEffect(() => {
    if (pendingAddGoal) {
      // v6.9.36 — default new goal type to 'supporting' so the modal opens
      // in the expected mode (matches the Add button used elsewhere).
      setNewGoal((prev) => ({ ...prev, type: 'supporting' }));
      setShowAddGoal(true);
      onConsumePendingAddGoal?.();
    }
  }, [pendingAddGoal, onConsumePendingAddGoal]);

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

  const handleAddGoal = async () => {
    if (!newGoal.title.trim()) return;
    await addGoal(newGoal.type as any, newGoal.title, newGoal.description, newGoal.targetDate || undefined);
    setNewGoal({ type: 'supporting', title: '', description: '', targetDate: '' });
    setShowAddGoal(false);
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
      onClick={(e) => { e.stopPropagation(); setNewGoal({ ...newGoal, type }); setShowAddGoal(true); }}
    >
      <Plus className="h-3 w-3 mr-1" /> Add
    </Button>
  );

  return (
    <div className="space-y-3">
      {/* Main Goal — compact inline */}
      <Card>
        <CardContent className="p-3">
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
              <span className="text-sm font-semibold">Main Goal:</span>
              <Badge variant="secondary" className="text-xs">{formatGoalLabel(mainGoal)}</Badge>
              {deadlineDisplay && (
                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  {deadlineDisplay}
                </Badge>
              )}
              <GoalProgressBar value={mainAggregate.pct} signalsLabel={mainAggregate.signalsLabel} className="ml-2" />
              <Button
                size="sm" variant="ghost" className="h-7 ml-auto"
                onClick={() => { setEditedMainGoal(mainGoal); setEditedTargetDate(mainGoalTargetDate || ''); setIsEditingMainGoal(true); }}
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supporting Goals — open by default */}
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

      {/* Additional Goals — collapsed by default */}
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

      {/* v5.0: Achieved Goals — collapsed by default */}
      {achievedGoals.length > 0 && (
        <CollapsibleSection id="goals-achieved" title="Achieved Goals" icon={CheckCircle2} count={achievedGoals.length}>
          <div className="grid md:grid-cols-2 gap-3">
            {achievedGoals.map(renderGoalCard)}
          </div>
        </CollapsibleSection>
      )}

      {/* v5.0: Archived Goals — collapsed by default */}
      {archivedGoals.length > 0 && (
        <CollapsibleSection id="goals-archived" title="Archived Goals" icon={Archive} count={archivedGoals.length}>
          <div className="grid md:grid-cols-2 gap-3">
            {archivedGoals.map(renderGoalCard)}
          </div>
        </CollapsibleSection>
      )}

      {/* Goal Notes — collapsed */}
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

      {/* Add Goal Dialog */}
      <Dialog open={showAddGoal} onOpenChange={setShowAddGoal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Goal</DialogTitle>
            <DialogDescription>Create a new learning goal for {studentName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Goal Type</Label>
              <Select value={newGoal.type} onValueChange={(v) => setNewGoal({ ...newGoal, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} placeholder="e.g. Master business email writing" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={newGoal.description} onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })} placeholder="More details about this goal..." />
            </div>
            <div>
              <Label>Deadline (optional)</Label>
              <DeadlinePicker
                value={newGoal.targetDate}
                onChange={(v) => setNewGoal({ ...newGoal, targetDate: v })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">When set, AI will pace phases/steps to complete before this date.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGoal(false)}>Cancel</Button>
            <Button onClick={handleAddGoal} disabled={!newGoal.title.trim()}>Add Goal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
