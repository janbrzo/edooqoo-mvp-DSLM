import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatGoal } from '@/lib/students/formatGoal';
import { filterStudents, studentPrepPath, type QuickAccessStudent } from '@/lib/students/quickAccess';

interface StudentQuickSearchProps {
  students: QuickAccessStudent[];
}

/**
 * v6.9.110 — "Jump to student" search on the Today dashboard.
 * Keyboard: arrows + Enter, Esc closes, `/` or Cmd/Ctrl+K focuses from anywhere.
 * Every result navigates straight into prep (`/student/:id?tab=dslm`).
 */
export const StudentQuickSearch: React.FC<StudentQuickSearchProps> = ({ students }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(
    () => (query.trim().length >= 2 ? filterStudents(students, query, 8) : []),
    [students, query],
  );

  useEffect(() => setActive(0), [query]);

  // Global shortcuts: "/" and Cmd/Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      const isSlash = e.key === '/' && !typing;
      const isCmdK = e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey);
      if (isSlash || isCmdK) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    navigate(studentPrepPath(id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[active] ?? results[0];
      if (target) go(target.id);
    }
  };

  if (students.length === 0) return null;

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="student-quick-search-results"
        aria-label="Jump to student"
        placeholder="Jump to student…   /"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="pl-9"
      />

      {showPanel && (
        <div
          id="student-quick-search-results"
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md"
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No student matching “{query.trim()}”.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={studentPrepPath(s.id)}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                      e.preventDefault();
                      go(s.id);
                    }}
                    className={cn(
                      'flex items-center justify-between gap-3 px-3 py-2 text-sm',
                      i === active ? 'bg-muted' : 'hover:bg-muted/60',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{s.name}</span>
                      {s.main_goal && (
                        <span className="block truncate text-xs text-muted-foreground">{formatGoal(s.main_goal)}</span>
                      )}
                    </span>
                    {s.english_level && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {s.english_level}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentQuickSearch;
