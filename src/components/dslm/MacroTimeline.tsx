/**
 * MacroTimeline — DSLM Pathway v4 vertical timeline of curriculum phases.
 * Per-phase: [Generate steps for phase] [Generate with comment].
 * Global toolbar: [Add phase] [Generate phases ▾] [Regenerate roadmap ▾ (just / with comment)].
 */
import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurriculumPhases, type CurriculumPhase, type PhaseStatus } from '@/hooks/dslm/useCurriculumPhases';
import { CompactSuggestionCard } from './CompactSuggestionCard';
import { ScrollableStepList } from './ScrollableStepList';
import { Check, ChevronDown, Sparkles, Loader2, Plus, Edit2, Trash2, Map, MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computePhaseConfidence } from '@/lib/dslm/confidenceScore';
import { ConfidenceBadge } from './ConfidenceBadge';

interface MacroTimelineProps {
  studentId: string;
  teacherId: string;
  suggestions: any[];
  displayIndexById: Record<string, number>;
  generatingSteps: boolean;
  onUseSuggestion: (s: any) => void;
  onUseAndGenerate: (s: any) => void;
  onEditSuggestion: (s: any) => void;
  onDeleteSuggestion: (id: string) => void;
  /** v4.8: optional mark-as-used handler propagated to per-step cards. */
  onMarkUsed?: (id: string) => void;
  onRegenerateOne: (id: string, comment: string) => Promise<boolean> | boolean;
  onGenerateForPhase: (phaseId: string, count: number, teacherComment: string) => Promise<boolean> | boolean;
}

const STATUS_LABEL: Record<PhaseStatus, string> = {
  done: 'completed', in_progress: 'in progress', planned: 'planned', draft: 'draft',
};

const StatusDot: React.FC<{ status: PhaseStatus; sequence: number }> = ({ status, sequence }) => {
  const base = 'h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border-2';
  if (status === 'done') return <div className={cn(base, 'bg-emerald-500 text-white border-emerald-500')}><Check className="h-3.5 w-3.5" /></div>;
  if (status === 'in_progress') return <div className={cn(base, 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30')}>NOW</div>;
  if (status === 'planned') return <div className={cn(base, 'bg-muted text-muted-foreground border-muted')}>{sequence}</div>;
  return <div className={cn(base, 'bg-muted/50 text-muted-foreground/70 border-dashed border-muted-foreground/40')}>{sequence}</div>;
};

export const MacroTimeline: React.FC<MacroTimelineProps> = ({
  studentId, teacherId, suggestions, displayIndexById, generatingSteps,
  onUseSuggestion, onUseAndGenerate, onEditSuggestion, onDeleteSuggestion,
  onRegenerateOne, onGenerateForPhase, onMarkUsed,
}) => {
  const { phases, loading, generating, generatePhases, updatePhase, deletePhase, addPhase } = useCurriculumPhases({ studentId, teacherId });
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);
  const [userTouchedExpand, setUserTouchedExpand] = useState(false);
  const [editingPhase, setEditingPhase] = useState<CurriculumPhase | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', status: 'planned' as PhaseStatus, weeks_start: '', weeks_end: '' });

  // Phase comment dialog (regenerate steps for phase)
  const [phaseCommentDialog, setPhaseCommentDialog] = useState<{ open: boolean; phaseId: string | null }>({ open: false, phaseId: null });
  const [phaseComment, setPhaseComment] = useState('');
  const [phaseCommentCount, setPhaseCommentCount] = useState(3);

  // Per-phase quick-generate count (for "Generate steps for this phase" dropdown)
  const [phaseQuickCount, setPhaseQuickCount] = useState<Record<string, number>>({});

  // Per-phase collapse for the "Steps" sub-section
  const [phaseStepsOpen, setPhaseStepsOpen] = useState<Record<string, boolean>>({});

  // Regenerate single step (with comment) dialog
  const [regenDialog, setRegenDialog] = useState<{ open: boolean; suggestionId: string | null }>({ open: false, suggestionId: null });
  const [regenComment, setRegenComment] = useState('');
  const openRegenerateDialog = (id: string) => { setRegenComment(''); setRegenDialog({ open: true, suggestionId: id }); };
  const submitRegenerate = async () => {
    if (!regenDialog.suggestionId) return;
    const id = regenDialog.suggestionId;
    const c = regenComment.trim();
    setRegenDialog({ open: false, suggestionId: null });
    await onRegenerateOne(id, c);
  };

  // Generate phases count dropdown
  const [phaseCount, setPhaseCount] = useState(3);

  // Add phase dialog
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', description: '', status: 'planned' as PhaseStatus, weeks_start: '', weeks_end: '', focus_areas: '' });

  // Default-expand the first in_progress phase ONLY on initial load (don't fight user collapses)
  React.useEffect(() => {
    if (!userTouchedExpand && !expandedPhaseId && phases.length > 0) {
      const inProgress = phases.find(p => p.status === 'in_progress');
      if (inProgress) setExpandedPhaseId(inProgress.id);
    }
  }, [phases, expandedPhaseId, userTouchedExpand]);

  // Group suggestions by phase_id
  const suggestionsByPhase = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of suggestions) {
      if (s.phase_id) {
        if (!map[s.phase_id]) map[s.phase_id] = [];
        map[s.phase_id].push(s);
      }
    }
    return map;
  }, [suggestions]);

  const openEdit = (phase: CurriculumPhase) => {
    setEditingPhase(phase);
    setEditForm({
      title: phase.title,
      description: phase.description || '',
      status: phase.status,
      weeks_start: phase.estimated_weeks_start?.toString() || '',
      weeks_end: phase.estimated_weeks_end?.toString() || '',
    });
  };
  const saveEdit = async () => {
    if (!editingPhase || !editForm.title.trim()) return;
    await updatePhase(editingPhase.id, {
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      status: editForm.status,
      estimated_weeks_start: editForm.weeks_start ? parseInt(editForm.weeks_start, 10) : null,
      estimated_weeks_end: editForm.weeks_end ? parseInt(editForm.weeks_end, 10) : null,
    });
    setEditingPhase(null);
  };

  const submitAddPhase = async () => {
    if (!addForm.title.trim()) return;
    const focusAreas = addForm.focus_areas.split(',').map(t => t.trim()).filter(Boolean);
    await addPhase({
      title: addForm.title.trim(),
      description: addForm.description.trim() || undefined,
      status: addForm.status,
      estimated_weeks_start: addForm.weeks_start ? parseInt(addForm.weeks_start, 10) : undefined,
      estimated_weeks_end: addForm.weeks_end ? parseInt(addForm.weeks_end, 10) : undefined,
      focus_areas: focusAreas,
    });
    setAddDialog(false);
    setAddForm({ title: '', description: '', status: 'planned', weeks_start: '', weeks_end: '', focus_areas: '' });
  };

  const openPhaseCommentDialog = (phaseId: string) => {
    setPhaseComment('');
    setPhaseCommentCount(3);
    setPhaseCommentDialog({ open: true, phaseId });
  };
  const submitPhaseComment = async () => {
    if (!phaseCommentDialog.phaseId) return;
    const id = phaseCommentDialog.phaseId;
    const c = phaseComment.trim();
    const n = phaseCommentCount;
    setPhaseCommentDialog({ open: false, phaseId: null });
    await onGenerateForPhase(id, n, c);
  };


  const getPhaseQuickCount = (id: string) => phaseQuickCount[id] ?? 3;
  const setPhaseQuickCountFor = (id: string, n: number) =>
    setPhaseQuickCount(p => ({ ...p, [id]: Math.min(6, Math.max(1, n)) }));

  // Empty state
  if (!loading && phases.length === 0) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="pt-6 text-center space-y-3">
          <Map className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <h3 className="text-base font-semibold">No curriculum plan yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Generate 3-5 macro learning phases that map out the student's journey toward their goal.
          </p>
          <Button onClick={() => generatePhases('replace')} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate Learning Roadmap
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute left-3.5 top-3 bottom-3 w-0.5 bg-border" aria-hidden />

        <div className="space-y-2">
          {phases.map((phase) => {
            const isExpanded = expandedPhaseId === phase.id;
            const phaseSuggestions = suggestionsByPhase[phase.id] || [];
            const weeksLabel = phase.estimated_weeks_start && phase.estimated_weeks_end
              ? `wk ${phase.estimated_weeks_start}-${phase.estimated_weeks_end}` : null;

            return (
              <div key={phase.id} className="relative">
                <Collapsible open={isExpanded} onOpenChange={(open) => { setUserTouchedExpand(true); setExpandedPhaseId(open ? phase.id : null); }}>
                  <Card className={cn(
                    'border transition-colors',
                    phase.status === 'in_progress' && 'border-primary/40 bg-primary/5',
                    phase.status === 'draft' && 'opacity-75'
                  )}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full text-left p-3 hover:bg-muted/30 transition-colors rounded-md">
                        <div className="flex items-start gap-3">
                          <StatusDot status={phase.status} sequence={phase.sequence_number} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium text-sm leading-snug">{phase.title}</h4>
                              <div className="flex items-center gap-1 shrink-0">
                                {(() => {
                                  const conf = computePhaseConfidence(phase);
                                  return (
                                    <ConfidenceBadge
                                      score={conf.score}
                                      label={conf.label}
                                      reasons={conf.reasons}
                                    />
                                  );
                                })()}
                                <Badge variant="secondary" className="text-[10px] capitalize">{STATUS_LABEL[phase.status]}</Badge>
                                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              {phase.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 flex-1 min-w-0">{phase.description}</p>
                              )}
                              {weeksLabel && (
                                <span className="text-[10px] text-muted-foreground font-medium shrink-0">{weeksLabel}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0 ml-10 space-y-3">
                        {phase.focus_areas?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {phase.focus_areas.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                            ))}
                          </div>
                        )}

                        {phase.rationale && (
                          <p className="text-xs text-muted-foreground italic">{phase.rationale}</p>
                        )}

                        {phaseSuggestions.length > 0 ? (
                          (() => {
                            const stepsOpen = phaseStepsOpen[phase.id] ?? (phase.status === 'in_progress');
                            return (
                              <Collapsible open={stepsOpen} onOpenChange={(o) => setPhaseStepsOpen(p => ({ ...p, [phase.id]: o }))}>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="w-full justify-between h-7 px-2 text-xs text-muted-foreground">
                                    <span>Steps ({phaseSuggestions.length})</span>
                                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', stepsOpen && 'rotate-180')} />
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-1.5">
                                  <ScrollableStepList count={phaseSuggestions.length}>
                                    {phaseSuggestions
                                      .slice()
                                      .sort((a, b) => a.sequence_number - b.sequence_number)
                                      .map((s) => (
                                        <CompactSuggestionCard
                                          key={s.id}
                                          s={s}
                                          displayIndex={displayIndexById[s.id] ?? 0}
                                          onUse={onUseSuggestion}
                                          onUseAndGenerate={onUseAndGenerate}
                                          onEdit={onEditSuggestion}
                                          onDelete={onDeleteSuggestion}
                                          onRegenerateWithComment={(item) => openRegenerateDialog(item.id)}
                                          onMarkUsed={onMarkUsed}
                                        />
                                      ))}
                                  </ScrollableStepList>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })()
                        ) : (
                          <p className="text-xs text-muted-foreground">No worksheet suggestions for this phase yet.</p>
                        )}

                        {/* Per-phase generation actions */}
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={generatingSteps}>
                                {generatingSteps ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                                Generate steps for this phase
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 p-2 space-y-2">
                              <DropdownMenuLabel className="text-xs">How many next steps to add?</DropdownMenuLabel>
                              <Input
                                type="number" min="1" max="6" value={getPhaseQuickCount(phase.id)}
                                onChange={(e) => setPhaseQuickCountFor(phase.id, parseInt(e.target.value) || 1)}
                                className="h-8"
                              />
                              <Button
                                size="sm" className="w-full"
                                onClick={() => onGenerateForPhase(phase.id, getPhaseQuickCount(phase.id), '')}
                                disabled={generatingSteps}
                              >
                                Add {getPhaseQuickCount(phase.id)} step{getPhaseQuickCount(phase.id) > 1 ? 's' : ''}
                              </Button>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => openPhaseCommentDialog(phase.id)}
                            disabled={generatingSteps}
                          >
                            <MessageSquarePlus className="h-3 w-3 mr-1" /> Generate steps with comment
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(phase)}>
                            <Edit2 className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          {phase.status !== 'done' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updatePhase(phase.id, { status: 'done' })}>
                              <Check className="h-3 w-3 mr-1" /> Mark done
                            </Button>
                          )}
                          {phase.status === 'planned' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updatePhase(phase.id, { status: 'in_progress' })}>
                              Start phase
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deletePhase(phase.id)}>
                            <Trash2 className="h-3 w-3 mr-1" /> Remove
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global roadmap toolbar */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={() => setAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add phase
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={generating}>
              <Sparkles className="h-4 w-4 mr-2" /> Generate phases <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-2 space-y-2">
            <DropdownMenuLabel className="text-xs">How many phases to add?</DropdownMenuLabel>
            <Input type="number" min="1" max="8" value={phaseCount}
              onChange={(e) => setPhaseCount(Math.min(8, Math.max(1, parseInt(e.target.value) || 1)))}
              className="h-8" />
            <Button size="sm" className="w-full" onClick={() => generatePhases('add', { count: phaseCount })}>
              Add {phaseCount} phase{phaseCount > 1 ? 's' : ''}
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
        {generating && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
      </div>

      {/* Phase edit dialog */}
      <Dialog open={!!editingPhase} onOpenChange={(open) => !open && setEditingPhase(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit phase</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Title</Label><Input value={editForm.title} onChange={(e) => setEditForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={editForm.description} onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))} className="h-20 text-sm" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Week start</Label><Input type="number" min="1" value={editForm.weeks_start} onChange={(e) => setEditForm(p => ({ ...p, weeks_start: e.target.value }))} /></div>
              <div><Label className="text-xs">Week end</Label><Input type="number" min="1" value={editForm.weeks_end} onChange={(e) => setEditForm(p => ({ ...p, weeks_end: e.target.value }))} /></div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm(p => ({ ...p, status: v as PhaseStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPhase(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={!editForm.title.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add phase dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add phase manually</DialogTitle>
            <DialogDescription>Define a new curriculum phase.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Title *</Label><Input value={addForm.title} onChange={(e) => setAddForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Conditionals & negotiation" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={addForm.description} onChange={(e) => setAddForm(p => ({ ...p, description: e.target.value }))} className="h-16 text-sm" placeholder="What student practices in this phase…" /></div>
            <div><Label className="text-xs">Focus areas (comma-separated)</Label><Input value={addForm.focus_areas} onChange={(e) => setAddForm(p => ({ ...p, focus_areas: e.target.value }))} placeholder="conditionals, negotiation, modals" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Week start</Label><Input type="number" min="1" value={addForm.weeks_start} onChange={(e) => setAddForm(p => ({ ...p, weeks_start: e.target.value }))} /></div>
              <div><Label className="text-xs">Week end</Label><Input type="number" min="1" value={addForm.weeks_end} onChange={(e) => setAddForm(p => ({ ...p, weeks_end: e.target.value }))} /></div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={addForm.status} onValueChange={(v) => setAddForm(p => ({ ...p, status: v as PhaseStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button onClick={submitAddPhase} disabled={!addForm.title.trim()}>Add phase</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase comment dialog */}
      <Dialog open={phaseCommentDialog.open} onOpenChange={(o) => !o && setPhaseCommentDialog({ open: false, phaseId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate steps with comment</DialogTitle>
            <DialogDescription>Guide the AI for this phase.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">How many next steps to add?</Label>
              <Input
                type="number" min="1" max="6" value={phaseCommentCount}
                onChange={(e) => setPhaseCommentCount(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">Your comment (optional)</Label>
              <Textarea value={phaseComment} onChange={(e) => setPhaseComment(e.target.value)} placeholder="e.g., Focus on real client emails, less drills." className="min-h-[100px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhaseCommentDialog({ open: false, phaseId: null })}>Cancel</Button>
            <Button onClick={submitPhaseComment}>Generate {phaseCommentCount} step{phaseCommentCount > 1 ? 's' : ''}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single-step regenerate-with-comment dialog */}
      <Dialog open={regenDialog.open} onOpenChange={(o) => !o && setRegenDialog({ open: false, suggestionId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate this step</DialogTitle>
            <DialogDescription>This step will be replaced by a new AI-generated one in the same phase.</DialogDescription>
          </DialogHeader>
          <Textarea value={regenComment} onChange={(e) => setRegenComment(e.target.value)} placeholder="e.g., Make it more conversation-focused, less drills." className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenDialog({ open: false, suggestionId: null })}>Cancel</Button>
            <Button onClick={submitRegenerate}>Regenerate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
