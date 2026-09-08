import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { pickRecentStudents, studentPrepPath, type QuickAccessStudent } from '@/lib/students/quickAccess';

interface RecentStudentsBarProps {
  students: QuickAccessStudent[];
  /** ids already visible in Next up — skipped to avoid duplication */
  excludeIds?: string[];
}

/**
 * v6.9.110 — one-line horizontal strip of recently touched students.
 * Anchors keep native middle-click / Ctrl-click "open in new tab".
 */
export const RecentStudentsBar: React.FC<RecentStudentsBarProps> = ({ students, excludeIds = [] }) => {
  const navigate = useNavigate();
  const recent = useMemo(() => pickRecentStudents(students, excludeIds, 8), [students, excludeIds]);

  if (recent.length === 0) return null;

  return (
    <nav aria-label="Recent students" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      <span className="shrink-0 self-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Recent
      </span>
      {recent.map((s) => (
        <a
          key={s.id}
          href={studentPrepPath(s.id)}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
            e.preventDefault();
            navigate(studentPrepPath(s.id));
          }}
          className="shrink-0 rounded-full border border-border px-3 py-1 text-sm text-foreground transition-colors hover:bg-muted"
          title="Click to open prep · Middle/Ctrl-click for new tab"
        >
          {s.name}
        </a>
      ))}
    </nav>
  );
};

export default RecentStudentsBar;
