/**
 * QuickNoteBox — "what should I remember" (v6.9.111, M4 step 2).
 *
 * One frictionless field plus the three most recent notes. Saving and tagging
 * are owned by the page (`studentKnowledge.addEntry` / the quick-add modal);
 * this component only collects text and reports intent.
 */

import React, { useState } from 'react';
import { StickyNote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeAge } from '@/lib/students/prepPlan';
import type { StudentKnowledgeEntry } from '@/types/studentKnowledge';

export interface QuickNoteBoxProps {
  recentNotes: readonly StudentKnowledgeEntry[];
  isLoading: boolean;
  isSaving: boolean;
  onSave: (content: string) => Promise<void>;
  onExpand: () => void;
  onViewAll: () => void;
}

export const QuickNoteBox: React.FC<QuickNoteBoxProps> = ({
  recentNotes,
  isLoading,
  isSaving,
  onSave,
  onExpand,
  onViewAll,
}) => {
  const [value, setValue] = useState('');
  const canSave = value.trim().length > 0 && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    await onSave(value.trim());
    setValue('');
  };

  return (
    <Card data-testid="prep-quick-note">
      <CardContent className="p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quick note
          </span>
          <Button variant="ghost" size="sm" onClick={onExpand}>
            Add with details
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void handleSave();
              }
            }}
            rows={2}
            placeholder="What did you notice in this lesson?"
            aria-label="Quick note"
            className="min-h-[60px] flex-1 resize-none"
          />
          <Button
            variant="secondary"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="sm:w-auto"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-2/3" />
            </>
          ) : recentNotes.length > 0 ? (
            recentNotes.map((note) => (
              <div key={note.id} className="flex items-start gap-2 text-sm">
                <StickyNote
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{note.content}</span>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  {formatRelativeAge(note.created_at)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No notes yet — anything you type here feeds the learning model.
            </p>
          )}
        </div>

        <div className="mt-3 text-right">
          <Button variant="link" size="sm" className="h-auto p-0" onClick={onViewAll}>
            All notes → Learning model
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickNoteBox;
