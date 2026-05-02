/**
 * LearningTimeline — vertical list of worksheet suggestions.
 * Supports `compact` mode (used inside MacroTimeline phases) — hides rationale/skills/impact behind a toggle.
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Edit, Trash2, Check, X, ChevronDown, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LearningTimelineProps {
  suggestions: any[];
  onUse: (suggestion: any) => void;
  onEdit: (suggestion: any) => void;
  onDelete: (suggestionId: string) => void;
  editingSuggestionId: string | null;
  editedSuggestion: { topic: string; goal: string; additionalInfo: string; grammarFocus: string };
  onEditChange: (updates: Partial<{ topic: string; goal: string; additionalInfo: string; grammarFocus: string }>) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  compact?: boolean;
  hideHeader?: boolean;
}

const CompactCard: React.FC<{
  suggestion: any;
  index: number;
  onUse: (s: any) => void;
  onEdit: (s: any) => void;
  onDelete: (id: string) => void;
}> = ({ suggestion: s, index, onUse, onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-dashed">
        <CardContent className="p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-medium truncate">{s.suggested_topic}</p>
                {s.suggested_grammar_focus && (
                  <span className="text-[10px] text-primary truncate">· {s.suggested_grammar_focus}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Generate worksheet" onClick={() => onUse(s)}>
                <Play className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => onEdit(s)}>
                <Edit className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Remove" onClick={() => onDelete(s.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Toggle details">
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent className="pt-2 space-y-1.5 ml-7">
            {s.suggested_goal && <p className="text-xs text-muted-foreground">{s.suggested_goal}</p>}
            {s.rationale && <p className="text-xs text-muted-foreground italic">{s.rationale}</p>}
            {s.focus_skill_names?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {s.focus_skill_names.slice(0, 4).map((skill: string) => (
                  <Badge key={skill} variant="secondary" className="text-[10px]">
                    {skill.replace(/^ns\.[A-C][12]\./, '').replace(/[._]/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}
            {s.estimated_impact && typeof s.estimated_impact === 'object' && Object.keys(s.estimated_impact).length > 0 && (
              <p className="text-[11px] text-emerald-600">
                Expected: {Object.entries(s.estimated_impact).map(([k, v]) => `${k} ${v}`).join(', ')}
              </p>
            )}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};

export const LearningTimeline: React.FC<LearningTimelineProps> = ({
  suggestions,
  onUse,
  onEdit,
  onDelete,
  editingSuggestionId,
  editedSuggestion,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  compact = false,
  hideHeader = false,
}) => {
  if (suggestions.length === 0) return null;

  // Inline editor (shared)
  const renderEditor = (s: any) => (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Topic</Label>
        <Input value={editedSuggestion.topic} onChange={(e) => onEditChange({ topic: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Goal</Label>
        <Input value={editedSuggestion.goal} onChange={(e) => onEditChange({ goal: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Additional Information</Label>
        <Textarea value={editedSuggestion.additionalInfo} onChange={(e) => onEditChange({ additionalInfo: e.target.value })} className="h-16 text-sm" placeholder="Extra context..." />
      </div>
      <div>
        <Label className="text-xs">Grammar Focus</Label>
        <Input value={editedSuggestion.grammarFocus} onChange={(e) => onEditChange({ grammarFocus: e.target.value })} placeholder="e.g., Present Perfect..." />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSaveEdit} disabled={!editedSuggestion.topic.trim()}>
          <Check className="h-4 w-4 mr-1" /> Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancelEdit}>
          <X className="h-4 w-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-2">
        {!hideHeader && (
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Worksheets ({suggestions.length})
          </h3>
        )}
        <div className="space-y-1.5">
          {suggestions.map((s, idx) => (
            <div key={s.id}>
              {editingSuggestionId === s.id ? (
                <Card className="border-dashed"><CardContent className="p-3">{renderEditor(s)}</CardContent></Card>
              ) : (
                <CompactCard suggestion={s} index={idx} onUse={onUse} onEdit={onEdit} onDelete={onDelete} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Original full layout (preserved for backward compatibility)
  return (
    <div className="space-y-3">
      {!hideHeader && (
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Learning Plan ({suggestions.length} upcoming)
        </h3>
      )}
      <div className="space-y-2">
        {suggestions.map((s, idx) => (
          <Card key={s.id} className="border-dashed">
            <CardContent className="pt-4 pb-3">
              {editingSuggestionId === s.id ? renderEditor(s) : (
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-bold text-muted-foreground shrink-0 mt-0.5">
                    {idx + 2}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm">{s.suggested_topic}</h4>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(s)}><Edit className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(s.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    {s.suggested_goal && <p className="text-xs text-muted-foreground">{s.suggested_goal}</p>}
                    {s.suggested_grammar_focus && <p className="text-xs text-primary mt-0.5">Grammar: {s.suggested_grammar_focus}</p>}
                    {s.rationale && <p className="text-xs text-muted-foreground mt-1 italic">{s.rationale}</p>}
                    {s.focus_skill_names?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.focus_skill_names.slice(0, 4).map((skill: string) => (
                          <Badge key={skill} variant="secondary" className="text-[10px]">
                            {skill.replace(/^ns\.[A-C][12]\./, '').replace(/[._]/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {s.estimated_impact && typeof s.estimated_impact === 'object' && Object.keys(s.estimated_impact).length > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        Expected: {Object.entries(s.estimated_impact).map(([k, v]) => `${k} ${v}`).join(', ')}
                      </p>
                    )}
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => onUse(s)}>Use This</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
