/**
 * Student Progress Tab - tracks goals, learning elements, and future worksheets
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { useFutureTimeline } from '@/hooks/useFutureTimeline';
import { ELEMENT_TYPES, GOAL_TYPES } from '@/types/studentProgress';
import { MAIN_GOALS, formatGoalLabel } from '@/constants/studentGoals';
import { Plus, Target, Sparkles, Star, Trash2, Calendar, TrendingUp, BookOpen, Loader2, Edit, Check, X } from 'lucide-react';
import { GoalCard } from './GoalCard';
import { DeadlinePicker } from '@/components/shared/DeadlinePicker';
import { EditGoalDialog } from './EditGoalDialog';
import { useGoalProgress } from '@/hooks/useGoalProgress';
import { toast } from 'sonner';

interface StudentProgressTabProps {
  studentId: string;
  teacherId: string;
  studentName: string;
  englishLevel: string;
  mainGoal: string;
  studentNotes?: string[];
  onMainGoalChange?: (newGoal: string) => void;
  onUseWorksheetSuggestion?: (topic: string, goal: string, additionalInfo?: string, grammarFocus?: string, exercises?: string[], exerciseFocusMap?: Record<string, string>) => void;
}

export const StudentProgressTab: React.FC<StudentProgressTabProps> = ({
  studentId,
  teacherId,
  studentName,
  englishLevel,
  mainGoal,
  studentNotes,
  onMainGoalChange,
  onUseWorksheetSuggestion
}) => {
  const { 
    goals, loading, addGoal, updateGoal, deleteGoal, archiveGoal, unarchiveGoal,
    addElement, updateElementRating, deleteElement, getProgressStats 
  } = useStudentProgress({ studentId, teacherId });
  
  const { 
    suggestions, generating, generateTimeline, deleteSuggestion, updateSuggestion 
  } = useFutureTimeline({ studentId, teacherId });

  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddElement, setShowAddElement] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState({ type: 'supporting', title: '', description: '', targetDate: '' });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [newElement, setNewElement] = useState({ type: 'grammar', title: '', description: '' });
  
  // Main goal editing
  const [isEditingMainGoal, setIsEditingMainGoal] = useState(false);
  const [editedMainGoal, setEditedMainGoal] = useState(mainGoal);
  
  // Timeline editing
  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null);
  const [editedSuggestion, setEditedSuggestion] = useState({ 
    topic: '', 
    goal: '',
    additionalInfo: '',
    grammarFocus: ''
  });
  
  // Regenerate confirmation
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const stats = getProgressStats();

  // v6.9.11 fix: hooks must be called above any early return (Rules of Hooks).
  // Previously this was below the `if (loading) return ...` line which caused
  // React error #310 (rendered more hooks than during the previous render).
  const { map: progressMap } = useGoalProgress(goals as any, studentId, teacherId);

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

  const handleGenerateClick = () => {
    if (suggestions.length > 0) {
      setShowRegenerateConfirm(true);
    } else {
      handleGenerateTimeline('replace');
    }
  };

  const handleGenerateTimeline = async (mode: 'replace' | 'add') => {
    setShowRegenerateConfirm(false);
    await generateTimeline(mode);
  };

  const handleUseSuggestion = (s: any) => {
    if (onUseWorksheetSuggestion) {
      onUseWorksheetSuggestion(
        s.suggested_topic, 
        s.suggested_goal || '',
        s.suggested_additional_info || '',
        s.suggested_grammar_focus || '',
        s.suggested_exercises || []
      );
    }
  };

  const handleEditSuggestion = (s: any) => {
    setEditingSuggestionId(s.id);
    setEditedSuggestion({ 
      topic: s.suggested_topic, 
      goal: s.suggested_goal || '',
      additionalInfo: s.suggested_additional_info || '',
      grammarFocus: s.suggested_grammar_focus || ''
    });
  };

  const handleSaveSuggestion = async () => {
    if (!editingSuggestionId || !editedSuggestion.topic.trim()) return;
    await updateSuggestion(
      editingSuggestionId, 
      editedSuggestion.topic, 
      editedSuggestion.goal,
      editedSuggestion.additionalInfo,
      editedSuggestion.grammarFocus
    );
    setEditingSuggestionId(null);
  };

  const handleSaveMainGoal = async () => {
    if (onMainGoalChange && editedMainGoal !== mainGoal) {
      await onMainGoalChange(editedMainGoal);
    }
    setIsEditingMainGoal(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const supportingGoals = goals.filter(g => g.goal_type === 'supporting');
  const additionalGoals = goals.filter(g => g.goal_type === 'additional');
  const editingGoal = editingGoalId ? (goals.find(g => g.id === editingGoalId) || null) : null;
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

  return (
    <div className="space-y-6">
      {/* Progress Overview (70%) + Main Learning Goal (30%) - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-10 gap-6">
        {/* Progress Overview - 70% width (7 cols) */}
        <Card className="md:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Progress Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{stats.totalGoals}</div>
                <div className="text-sm text-muted-foreground">Goals</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{stats.totalElements}</div>
                <div className="text-sm text-muted-foreground">Learning Elements</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{stats.averageRating || '-'}</div>
                <div className="text-sm text-muted-foreground">Avg. Rating</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.masteredElements}</div>
                <div className="text-sm text-muted-foreground">Mastered</div>
              </div>
            </div>
            {stats.totalElements > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Overall Progress</span>
                  <span>{stats.progressPercentage}%</span>
                </div>
                <Progress value={stats.progressPercentage} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Learning Goal - 30% width (3 cols) */}
        <Card className="md:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Main Goal
              </CardTitle>
              {!isEditingMainGoal && (
                <Button size="sm" variant="ghost" onClick={() => { setEditedMainGoal(mainGoal); setIsEditingMainGoal(true); }}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingMainGoal ? (
              <div className="space-y-2">
                <Select value={editedMainGoal} onValueChange={setEditedMainGoal}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAIN_GOALS.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={handleSaveMainGoal}>
                    <Check className="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingMainGoal(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Badge variant="secondary" className="text-base px-4 py-2">
                {formatGoalLabel(mainGoal)}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supporting Goals - Full Width */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Supporting Goals
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setNewGoal({ ...newGoal, type: 'supporting' }); setShowAddGoal(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <CardDescription>Goals that support the main learning objective</CardDescription>
        </CardHeader>
        <CardContent>
          {supportingGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No supporting goals yet</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {supportingGoals.map(renderGoalCard)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Goals - Full Width */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-secondary-foreground" />
              Additional Goals
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setNewGoal({ ...newGoal, type: 'additional' }); setShowAddGoal(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <CardDescription>Important side objectives for the student</CardDescription>
        </CardHeader>
        <CardContent>
          {additionalGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No additional goals yet</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {additionalGoals.map(renderGoalCard)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Future Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Future Timeline
              </CardTitle>
              <CardDescription>Suggested worksheets for upcoming lessons</CardDescription>
            </div>
            <Button onClick={handleGenerateClick} disabled={generating || goals.length === 0}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate Timeline
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {goals.length === 0 
                ? "Add some goals first, then generate your timeline" 
                : "Click 'Generate Timeline' to get AI-powered worksheet suggestions"}
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {suggestions.map((s, idx) => (
                <Card key={s.id} className="border-dashed">
                  <CardContent className="pt-4">
                    {editingSuggestionId === s.id ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">Topic</Label>
                          <Input 
                            value={editedSuggestion.topic} 
                            onChange={(e) => setEditedSuggestion({ ...editedSuggestion, topic: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Goal</Label>
                          <Input 
                            value={editedSuggestion.goal} 
                            onChange={(e) => setEditedSuggestion({ ...editedSuggestion, goal: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Additional Information</Label>
                          <Textarea 
                            value={editedSuggestion.additionalInfo} 
                            onChange={(e) => setEditedSuggestion({ ...editedSuggestion, additionalInfo: e.target.value })}
                            className="h-16 text-sm"
                            placeholder="Extra context & personal details..."
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Grammar Focus</Label>
                          <Input 
                            value={editedSuggestion.grammarFocus} 
                            onChange={(e) => setEditedSuggestion({ ...editedSuggestion, grammarFocus: e.target.value })}
                            placeholder="e.g., Present Perfect, Conditionals..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveSuggestion} disabled={!editedSuggestion.topic.trim()}>
                            <Check className="h-4 w-4 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingSuggestionId(null)}>
                            <X className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <Badge variant="outline" className="mb-2">Lesson {idx + 1}</Badge>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditSuggestion(s)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteSuggestion(s.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <h4 className="font-medium">{s.suggested_topic}</h4>
                        {s.suggested_goal && <p className="text-sm text-muted-foreground mt-1">{s.suggested_goal}</p>}
                        {(s as any).suggested_grammar_focus && (
                          <p className="text-xs text-primary mt-1">Grammar: {(s as any).suggested_grammar_focus}</p>
                        )}
                        {s.rationale && <p className="text-xs text-muted-foreground mt-2 italic">{s.rationale}</p>}
                        {/* Layer D: Focus Skills badges */}
                        {(s as any).focus_skill_names?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(s as any).focus_skill_names.slice(0, 4).map((skill: string) => (
                              <Badge key={skill} variant="secondary" className="text-[10px]">
                                {skill.replace(/^ns\.[A-C][12]\./, '').replace(/[._]/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {/* Layer D: Estimated Impact */}
                        {(s as any).estimated_impact && typeof (s as any).estimated_impact === 'object' && Object.keys((s as any).estimated_impact).length > 0 && (
                          <p className="text-xs text-green-600 mt-1">
                            Expected: {Object.entries((s as any).estimated_impact).map(([k,v]) => `${k} ${v}`).join(', ')}
                          </p>
                        )}
                        {/* Layer D: Difficulty badge */}
                        {(s as any).difficulty_level && (
                          <Badge variant="outline" className="text-[10px] mt-1">{(s as any).difficulty_level}</Badge>
                        )}
                        <Button 
                          size="sm" 
                          className="mt-3 w-full" 
                          onClick={() => handleUseSuggestion(s)}
                        >
                          Use This
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate New Timeline</AlertDialogTitle>
            <AlertDialogDescription>
              You already have {suggestions.length} suggestion(s). What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleGenerateTimeline('add')} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
              Add More
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleGenerateTimeline('replace')}>
              Replace All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <DeadlinePicker value={newGoal.targetDate} onChange={(v) => setNewGoal({ ...newGoal, targetDate: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGoal(false)}>Cancel</Button>
            <Button onClick={handleAddGoal} disabled={!newGoal.title.trim()}>Add Goal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
};

// GoalCard extracted to ./GoalCard.tsx — import used above

export default StudentProgressTab;
