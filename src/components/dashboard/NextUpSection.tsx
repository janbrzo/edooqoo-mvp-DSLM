import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { NextUpCard } from './NextUpCard';
import type { NextUpStudent } from '@/hooks/useNextUpStudents';

interface NextUpSectionProps {
  items: NextUpStudent[];
  loading: boolean;
}

// Static class map so Tailwind generates the utilities.
const GRID_COLS: Record<number, string> = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
};

/** v6.9.109 — zone A of the Today dashboard: 1–3 students to prepare for next. */
export const NextUpSection: React.FC<NextUpSectionProps> = ({ items, loading }) => {
  const cols = GRID_COLS[Math.min(Math.max(items.length, 1), 3)];

  return (
    <section aria-labelledby="next-up-heading">
      <h2 id="next-up-heading" className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Next up
      </h2>
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className={`grid gap-3 ${cols}`}>
          {items.map((item) => (
            <NextUpCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
};

export default NextUpSection;
