import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarPlus, ClipboardCheck, GraduationCap } from 'lucide-react';
import type { AttentionItem, AttentionKind } from '@/hooks/useDashboardAttention';

interface AttentionSectionProps {
  items: AttentionItem[];
  loading: boolean;
  onOpenInbox: () => void;
}

const ICONS: Record<AttentionKind, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>> = {
  homework_to_review: ClipboardCheck,
  welcome_test_done: GraduationCap,
  booking_new: CalendarPlus,
};

/**
 * v6.9.109 — zone B of the Today dashboard. Renders nothing when empty:
 * no "all caught up" filler, the zone simply does not exist.
 */
export const AttentionSection: React.FC<AttentionSectionProps> = ({ items, loading, onOpenInbox }) => {
  if (!loading && items.length === 0) return null;

  return (
    <section aria-labelledby="attention-heading">
      <h2 id="attention-heading" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Needs your attention{!loading && ` (${items.length})`}
      </h2>
      {loading ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {items.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.text}</span>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={item.href}>{item.ctaLabel}</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onOpenInbox}
          >
            View all in notifications
          </button>
        </>
      )}
    </section>
  );
};

export default AttentionSection;
