/**
 * EntityRow — the single row anatomy for the Student Workspace (v6.9.111, M2).
 *
 * Prep (M4), Timeline (M5) and Library (M6) all render lists of "things that
 * happened or exist for this student". Before M2 each list hand-rolled its own
 * padding, icon size and action cluster. This component owns that anatomy.
 *
 * Interaction rules:
 * - `href` → the title is a real <a> with a full-row ::after overlay, so the
 *   whole row is clickable while middle-click / Cmd+click still open a new tab
 *   and no interactive element is nested inside the anchor;
 * - `onClick` only → the container becomes role="button" with Enter/Space;
 * - neither → a static row.
 *
 * Purely presentational: no queries, no effects.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AttentionDot } from '@/components/ui/AttentionDot';

export type EntityRowTone = 'default' | 'destructive';
export type EntityRowMode = 'link' | 'button' | 'static';

export interface EntityRowProps {
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  needsAction?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  menu?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  dense?: boolean;
  tone?: EntityRowTone;
  className?: string;
  'data-testid'?: string;
}

export interface ResolvedRowClasses {
  mode: EntityRowMode;
  container: string;
  icon: string;
  title: string;
  subtitle: string;
  meta: string;
  action: string;
  overlay: string;
}

/**
 * Pure class/mode resolver — all row decisions live here so they can be
 * unit-tested without a DOM renderer.
 */
export function resolveRowClasses(
  props: Pick<EntityRowProps, 'href' | 'onClick' | 'dense' | 'tone' | 'className'>,
): ResolvedRowClasses {
  const { href, onClick, dense, tone = 'default', className } = props;
  const mode: EntityRowMode = href ? 'link' : onClick ? 'button' : 'static';
  const destructive = tone === 'destructive';
  const interactive = mode !== 'static';

  return {
    mode,
    container: cn(
      'group relative flex items-center gap-3 rounded-lg transition-colors',
      dense ? 'p-3' : 'p-4',
      destructive
        ? 'bg-card border border-destructive/30'
        : 'bg-muted/30',
      interactive && !destructive && 'hover:bg-muted/50',
      interactive && 'cursor-pointer',
      interactive &&
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    ),
    icon: cn(
      'shrink-0',
      dense ? 'h-4 w-4' : 'h-5 w-5',
      destructive ? 'text-destructive/70' : 'text-primary',
    ),
    title: cn('truncate font-medium', dense ? 'text-sm' : 'text-base'),
    subtitle: cn('truncate text-muted-foreground', dense ? 'text-xs' : 'text-sm'),
    meta: 'whitespace-nowrap text-sm text-muted-foreground',
    action:
      'relative z-10 border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30',
    overlay: "after:absolute after:inset-0 after:content-['']",
  };
}

export const EntityRow: React.FC<EntityRowProps> = ({
  icon: Icon,
  title,
  subtitle,
  meta,
  href,
  onClick,
  needsAction,
  actionLabel,
  onAction,
  menu,
  badges,
  actions,
  dense,
  tone = 'default',
  className,
  'data-testid': testId,
}) => {
  const c = resolveRowClasses({ href, onClick, dense, tone, className });

  const containerProps =
    c.mode === 'button'
      ? {
          role: 'button' as const,
          tabIndex: 0,
          onClick,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick?.();
            }
          },
        }
      : {};

  const titleNode = (
    <span className={c.title} title={title}>
      {title}
    </span>
  );

  return (
    <div className={c.container} data-testid={testId} {...containerProps}>
      {needsAction && <AttentionDot show className="ml-0 shrink-0" label={`Needs attention: ${title}`} />}
      <Icon className={c.icon} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {c.mode === 'link' ? (
            <Link to={href!} className={cn('min-w-0 hover:underline', c.overlay)} onClick={onClick}>
              {titleNode}
            </Link>
          ) : (
            titleNode
          )}
          {badges && <span className="relative z-10 flex shrink-0 items-center gap-2">{badges}</span>}
        </div>
        {subtitle && <div className={c.subtitle}>{subtitle}</div>}
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-2">
        {meta && <span className={c.meta}>{meta}</span>}
        {needsAction && actionLabel && onAction && (
          <Button
            size="sm"
            variant="outline"
            className={c.action}
            aria-label={`${actionLabel}: ${title}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAction();
            }}
          >
            {actionLabel}
          </Button>
        )}
        {actions}
        {menu}
      </div>
    </div>
  );
};

export default EntityRow;
