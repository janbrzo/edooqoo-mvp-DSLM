import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { formatGoal } from '@/lib/students/formatGoal';
import { filterStudents, studentPrepPath } from '@/lib/students/quickAccess';
import { sortStudents } from '@/pages/AllStudentsPage';
import type { NextUpStudent } from '@/hooks/useNextUpStudents';
import type { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'>;
type SortKey = 'recent' | 'name-asc' | 'next-lesson';

interface AllStudentsInlineProps {
  students: Student[];
  nextLessonById?: Record<string, NextUpStudent['nextLesson']>;
}

const MAX_ROWS = 10;

/**
 * v6.9.110 — lightweight student list expanded in place under the
 * "All students" tile. Same matching rules as the header quick search;
 * every row goes straight into prep.
 */
export const AllStudentsInline: React.FC<AllStudentsInlineProps> = ({ students, nextLessonById = {} }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  const rows = useMemo(() => {
    const filtered = search.trim() ? filterStudents(students, search, students.length) : students;
    return sortStudents(filtered as Student[], sort, nextLessonById);
  }, [students, search, sort, nextLessonById]);

  const visible = rows.slice(0, MAX_ROWS);

  return (
    <div className="mt-2 rounded-lg border border-border p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students…"
            aria-label="Search students"
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="sm:w-48" aria-label="Sort students">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently active</SelectItem>
            <SelectItem value="name-asc">Name A–Z</SelectItem>
            <SelectItem value="next-lesson">Next lesson</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <p className="px-1 py-3 text-sm text-muted-foreground">No student matching “{search.trim()}”.</p>
      ) : (
        <ul className="mt-2 max-h-80 divide-y divide-border overflow-y-auto">
          {visible.map((s) => (
            <li key={s.id}>
              <a
                href={studentPrepPath(s.id)}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                  e.preventDefault();
                  navigate(studentPrepPath(s.id));
                }}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
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

      <div className="mt-2 border-t border-border pt-2 text-right">
        <Link to="/students" className="text-xs font-medium text-primary hover:underline">
          See all {students.length} students
        </Link>
      </div>
    </div>
  );
};

export default AllStudentsInline;
