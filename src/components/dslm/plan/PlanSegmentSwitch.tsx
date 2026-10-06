/**
 * PlanSegmentSwitch: Plan / Insights. Two short labels fit at 360 px, so the
 * switch is never truncated and never sticky (it used to slide under the
 * StickyNav).
 */
import React from 'react';
import { BarChart3, Route } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModelSegment } from '@/lib/students/workspaceTabs';

const SEGMENTS: { id: ModelSegment; label: string; Icon: typeof Route }[] = [
  { id: 'plan', label: 'Plan', Icon: Route },
  { id: 'insights', label: 'Insights', Icon: BarChart3 },
];

interface PlanSegmentSwitchProps {
  value: ModelSegment;
  onChange: (segment: ModelSegment) => void;
}

export const PlanSegmentSwitch: React.FC<PlanSegmentSwitchProps> = ({ value, onChange }) => (
  <div
    role="group"
    aria-label="Learning plan views"
    className="grid w-full grid-cols-2 gap-1 rounded-md bg-muted p-1 sm:max-w-xs"
  >
    {SEGMENTS.map(({ id, label, Icon }) => {
      const active = value === id;
      return (
        <button
          key={id}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(id)}
          className={cn(
            'inline-flex min-h-9 items-center justify-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      );
    })}
  </div>
);
