/**
 * EditExerciseSelector — compact picker for SuggestionEditDialog.
 * Lets the teacher (de)select up to 8 exercise types and toggle V/G focus per item.
 * Reuses ALL_EXERCISE_IDS / EXERCISE_LABELS from the shared taxonomy.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ALL_EXERCISE_IDS, EXERCISE_LABELS } from '@/lib/exerciseTaxonomy';
import { cn } from '@/lib/utils';

interface EditExerciseSelectorProps {
  selected: string[];
  focusMap: Record<string, string>;
  onChange: (next: { selected: string[]; focusMap: Record<string, string> }) => void;
  /** Max exercises (defaults to 8 = 60min lesson). */
  max?: number;
}

const FOCUS_CYCLE: Array<'none' | 'vocabulary' | 'grammar'> = ['none', 'vocabulary', 'grammar'];

export const EditExerciseSelector: React.FC<EditExerciseSelectorProps> = ({
  selected, focusMap, onChange, max = 8,
}) => {
  const toggle = (id: string) => {
    const isOn = selected.includes(id);
    if (isOn) {
      const nextSelected = selected.filter(x => x !== id);
      const nextFocus = { ...focusMap };
      delete nextFocus[id];
      onChange({ selected: nextSelected, focusMap: nextFocus });
    } else {
      if (selected.length >= max) return;
      onChange({ selected: [...selected, id], focusMap });
    }
  };

  const cycleFocus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = (focusMap[id] || 'none') as 'none' | 'vocabulary' | 'grammar';
    const idx = FOCUS_CYCLE.indexOf(current);
    const next = FOCUS_CYCLE[(idx + 1) % FOCUS_CYCLE.length];
    const nextMap = { ...focusMap };
    if (next === 'none') delete nextMap[id];
    else nextMap[id] = next;
    onChange({ selected, focusMap: nextMap });
  };

  const warn = selected.length !== max;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Select exercises (max {max}). Click [V/G/-] chip to cycle focus.
        </p>
        <Badge variant={warn ? 'destructive' : 'secondary'} className="text-[10px]">
          {selected.length} / {max}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-1 max-h-[280px] overflow-y-auto pr-1 border rounded-md p-2">
        {ALL_EXERCISE_IDS.map((id) => {
          const isOn = selected.includes(id);
          const focus = focusMap[id];
          return (
            <div key={id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggle(id)}
                disabled={!isOn && selected.length >= max}
                className={cn(
                  'flex-1 text-left text-xs px-2 py-1 rounded border transition-colors truncate',
                  isOn
                    ? 'bg-primary/10 border-primary text-foreground'
                    : 'bg-background border-border text-muted-foreground hover:bg-muted',
                  !isOn && selected.length >= max && 'opacity-40 cursor-not-allowed',
                )}
              >
                {EXERCISE_LABELS[id] || id}
              </button>
              {isOn && (
                <button
                  type="button"
                  onClick={(e) => cycleFocus(id, e)}
                  className={cn(
                    'text-[10px] font-bold w-7 h-6 rounded border shrink-0',
                    focus === 'vocabulary' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/40',
                    focus === 'grammar' && 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/40',
                    !focus && 'bg-muted text-muted-foreground border-border',
                  )}
                  title="Click to cycle: none → V → G"
                >
                  {focus === 'vocabulary' ? 'V' : focus === 'grammar' ? 'G' : '–'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
