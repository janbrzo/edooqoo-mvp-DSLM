import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthenticatedPageShell } from '@/components/AuthenticatedPageShell';
import StickyNav from '@/components/landing/StickyNav';
import { PageSeo } from '@/components/seo/PageSeo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddStudentDialog } from '@/components/dashboard/AddStudentDialog';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useTokenSystem } from '@/hooks/useTokenSystem';
import { useStudents } from '@/hooks/useStudents';
import { useNextUpStudents, type NextUpStudent } from '@/hooks/useNextUpStudents';
import { useStudentsOverview } from '@/hooks/useStudentsOverview';
import { formatGoal } from '@/lib/students/formatGoal';
import { formatLesson } from '@/components/dashboard/NextUpCard';
import { ArrowLeft, Plus, Search, Users } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'>;
type SortKey = 'recent' | 'name-asc' | 'name-desc' | 'next-lesson';

/**
 * v6.9.109 Phase 4 — `/students`.
 * Takes over the student search/sort that was removed from the Today dashboard.
 * Flat rows, no per-row hooks: one `useStudents` + one `useStudentsOverview`
 * (worksheet counts) + one `useNextUpStudents` (next booked lesson).
 */
export function sortStudents(
  students: Student[],
  sort: SortKey,
  nextLessonById: Record<string, NextUpStudent['nextLesson']>,
): Student[] {
  const list = [...students];
  switch (sort) {
    case 'name-asc':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-desc':
      return list.sort((a, b) => b.name.localeCompare(a.name));
    case 'next-lesson':
      return list.sort((a, b) => {
        const la = nextLessonById[a.id];
        const lb = nextLessonById[b.id];
        if (la && lb) return `${la.date} ${la.time}`.localeCompare(`${lb.date} ${lb.time}`);
        if (la) return -1;
        if (lb) return 1;
        return 0; // keep updated_at desc from useStudents
      });
    case 'recent':
    default:
      return list; // useStudents already orders by updated_at desc
  }
}

const AllStudentsPage = () => {
  const { user, loading, isRegisteredUser } = useAuthFlow();
  const { tokenLeft, profile } = useTokenSystem(user?.id);
  const { students, loading: studentsLoading } = useStudents();
  const navigate = useNavigate();

  const ids = useMemo(() => students.map((s) => s.id), [students]);
  const { worksheetCountByStudent } = useStudentsOverview(ids);
  const { items: nextUp } = useNextUpStudents(students, Math.max(students.length, 1));

  const nextLessonById = useMemo(() => {
    const map: Record<string, NextUpStudent['nextLesson']> = {};
    for (const item of nextUp) map[item.id] = item.nextLesson;
    return map;
  }, [nextUp]);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isRegisteredUser) navigate('/');
  }, [loading, isRegisteredUser, navigate]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? students.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.student_email ?? '').toLowerCase().includes(q) ||
            formatGoal(s.main_goal).toLowerCase().includes(q),
        )
      : students;
    return sortStudents(filtered, sort, nextLessonById);
  }, [students, search, sort, nextLessonById]);

  if (loading || (studentsLoading && students.length === 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto h-32 w-32 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-foreground">Loading students…</p>
        </div>
      </div>
    );
  }

  if (!isRegisteredUser) return null;

  const subscriptionType = profile?.subscription_type || 'Free Demo';

  return (
    <AuthenticatedPageShell>
      <PageSeo
        title="Students — Edooqoo"
        description="All your students in one place: level, goal, next lesson and worksheets."
        path="/students"
        robots="noindex,nofollow"
      />
      <StickyNav
        isRegisteredUser={true}
        tokenLeft={tokenLeft}
        user={user}
        subscriptionType={subscriptionType}
        onGenerateWorksheet={() => {
          sessionStorage.setItem('forceNewWorksheet', 'true');
          navigate('/');
        }}
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="px-2">
              <Link to="/dashboard" aria-label="Back to dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
              <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              Students ({students.length})
            </h1>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add student
          </Button>
        </div>

        {students.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Search students"
                placeholder="Search students…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Sort students">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently active</SelectItem>
                <SelectItem value="name-asc">Name A–Z</SelectItem>
                <SelectItem value="name-desc">Name Z–A</SelectItem>
                <SelectItem value="next-lesson">Next lesson</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {students.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-foreground">No students yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first student to start preparing lessons in under a minute.</p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add student
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            No students matching “{search}”.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Students list">
            {visible.map((s) => {
              const lesson = nextLessonById[s.id];
              const goal = formatGoal(s.main_goal);
              const count = worksheetCountByStudent[s.id] ?? 0;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/student/${s.id}`} className="truncate font-medium text-foreground hover:underline">
                        {s.name}
                      </Link>
                      {s.english_level && <Badge variant="secondary" className="shrink-0 text-xs">{s.english_level}</Badge>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {goal && <span className="truncate">Goal: {goal}</span>}
                      <span>Next: {lesson ? formatLesson(lesson) : '—'}</span>
                      <span>{count} {count === 1 ? 'worksheet' : 'worksheets'}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild className="shrink-0">
                    <Link to={`/student/${s.id}`}>Open</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AddStudentDialog triggerButton={false} open={addOpen} onOpenChange={setAddOpen} />
    </AuthenticatedPageShell>
  );
};

export default AllStudentsPage;
