import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { pickRecentStudents, studentPrepPath, type QuickAccessStudent } from '@/lib/students/quickAccess';

interface RecentStudentsBarProps {
  students: QuickAccessStudent[];
  /** ids already visible in Next up — skipped to avoid duplication */
  excludeIds?: string[];
}

const DRAG_THRESHOLD_PX = 5;

/**
 * v6.9.110 — one-line horizontal strip of recently touched students.
 * Anchors keep native middle-click / Ctrl-click "open in new tab".
 * Supports mouse drag-to-scroll and vertical wheel → horizontal scroll.
 */
export const RecentStudentsBar: React.FC<RecentStudentsBarProps> = ({ students, excludeIds = [] }) => {
  const navigate = useNavigate();
  const recent = useMemo(() => pickRecentStudents(students, excludeIds, 8), [students, excludeIds]);
  const ref = useRef<HTMLElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // native horizontal gesture
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const max = el.scrollWidth - el.clientWidth;
      const atStart = el.scrollLeft <= 0 && dy < 0;
      const atEnd = el.scrollLeft >= max - 1 && dy > 0;
      if (atStart || atEnd) return; // let page scroll at the edges
      e.preventDefault();
      el.scrollLeft += dy;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [recent.length]);

  if (recent.length === 0) return null;

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !ref.current) return;
    drag.current = { active: true, startX: e.clientX, startScroll: ref.current.scrollLeft, moved: false };
    const onMove = (ev: MouseEvent) => {
      const d = drag.current;
      if (!d.active || !ref.current) return;
      const dx = ev.clientX - d.startX;
      if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD_PX) {
        d.moved = true;
        ref.current.style.cursor = 'grabbing';
        ref.current.style.userSelect = 'none';
      }
      if (d.moved) ref.current.scrollLeft = d.startScroll - dx;
    };
    const onUp = () => {
      drag.current.active = false;
      if (ref.current) {
        ref.current.style.cursor = '';
        ref.current.style.userSelect = '';
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <nav
      ref={ref}
      aria-label="Recent students"
      onMouseDown={onMouseDown}
      onDragStart={(e) => e.preventDefault()}
      className="no-scrollbar -mx-1 flex cursor-grab gap-2 overflow-x-auto px-1 pb-1"
    >
      <span className="shrink-0 self-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Recent
      </span>
      {recent.map((s) => (
        <a
          key={s.id}
          href={studentPrepPath(s.id)}
          draggable={false}
          onClick={(e) => {
            if (drag.current.moved) {
              e.preventDefault();
              drag.current.moved = false;
              return;
            }
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
