/**
 * ConfidenceBadge — standalone, focusable trigger for the DSLM confidence tooltip.
 *
 * Why it exists: previous implementation used <Badge> (a div) wrapped via TooltipTrigger
 * asChild and was sometimes nested inside a parent <button> (collapsible trigger),
 * which produced invalid HTML and blocked the tooltip from showing in many cases.
 *
 * This component renders a real <button type="button"> and stops event propagation
 * so it never accidentally toggles a parent collapsible.
 */
import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface ConfidenceBadgeProps {
  score: number;
  label?: string;
  reasons?: string[];
  /** 'inverse' for white-on-blue banner; 'outline' for compact cards. */
  variant?: 'outline' | 'inverse';
  className?: string;
}

const colorForScore = (s: number) => {
  if (s >= 80) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
  if (s >= 65) return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
};

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  score, label, reasons = [], variant = 'outline', className,
}) => {
  const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };
  const colorCls = variant === 'inverse'
    ? 'bg-white/25 text-primary-foreground border-0'
    : `border ${colorForScore(score)}`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={stop}
            onPointerDown={stop}
            onMouseDown={stop}
            aria-label={`Confidence ${score}%`}
            className={cn(
              'inline-flex items-center rounded-md text-[10px] font-medium px-1.5 py-0.5 h-4 cursor-help',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              colorCls,
              className
            )}
          >
            {variant === 'inverse' ? `Confidence: ${score}%` : `${score}%`}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs" side="top">
          <p className="font-semibold">{label || `${score}% match to student needs`}</p>
          {reasons.length > 0 ? (
            <ul className="text-xs mt-1 list-disc pl-4 space-y-0.5">
              {reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          ) : (
            <p className="text-xs mt-1 opacity-80">
              Deterministic client-side fit heuristic based on goals, rationale, focus tags, and recent signals.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};