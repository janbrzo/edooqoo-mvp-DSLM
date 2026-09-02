import { useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useDemoContext } from '@/contexts/DemoContext';
import { devWarn } from '@/utils/logger';
import type { Tables } from '@/integrations/supabase/types';

/**
 * useNextUpStudents — data layer for the "Next up" zone of the Today dashboard.
 *
 * For each student resolves (a) the next booked lesson within 7 days and
 * (b) the most recent DSLM focus signal (Skill Assessment entry whose
 * `metadata.skill_subtype` is weakness / mistake / practice).
 * Two batched queries — no per-student fetching.
 *
 * Demo mode: derives everything from `demoData`, zero Supabase calls.
 * Any query error degrades to an empty list (dashboard must never crash
 * because of a helper section).
 */

type Student = Tables<'students'>;

export interface NextUpStudent {
  id: string;
  name: string;
  englishLevel: string | null;
  mainGoal: string | null;
  /** slot_date 'YYYY-MM-DD', start_time 'HH:MM:SS' */
  nextLesson: { date: string; time: string } | null;
  /** Latest weakness / mistake / practice signal, short text */
  focusSignal: string | null;
}

export interface NextUpSlotRow {
  student_id: string | null;
  slot_date: string;
  start_time: string;
}

export interface NextUpSignalRow {
  student_id: string;
  content: string | null;
  metadata: unknown;
  created_at: string;
}

const FOCUS_SUBTYPES = new Set(['weakness', 'mistake', 'practice']);
const FOCUS_MAX_LEN = 80;

/** Minimal student shape needed by the aggregator (keeps demo objects compatible). */
export type NextUpStudentInput = Pick<Student, 'id' | 'name'> & {
  english_level?: string | null;
  main_goal?: string | null;
};

function toFocusText(row: NextUpSignalRow): string | null {
  const meta = (row.metadata ?? {}) as { nano_skill?: string; reason?: string };
  const raw = (meta.nano_skill || row.content || '').trim();
  if (!raw) return null;
  const firstLine = raw.split('\n')[0].trim();
  return firstLine.length > FOCUS_MAX_LEN ? `${firstLine.slice(0, FOCUS_MAX_LEN - 1).trimEnd()}…` : firstLine;
}

/**
 * Pure aggregation — exported for unit tests and demo reuse.
 * `slots` must be sorted by slot_date, start_time ascending;
 * `signals` must be sorted by created_at descending.
 */
export function aggregateNextUp(
  students: NextUpStudentInput[],
  slots: NextUpSlotRow[],
  signals: NextUpSignalRow[],
  limit: number,
): NextUpStudent[] {
  const nextLessonByStudent = new Map<string, { date: string; time: string }>();
  for (const s of slots) {
    if (!s.student_id || nextLessonByStudent.has(s.student_id)) continue;
    nextLessonByStudent.set(s.student_id, { date: s.slot_date, time: s.start_time });
  }

  const focusByStudent = new Map<string, string>();
  for (const sig of signals) {
    if (focusByStudent.has(sig.student_id)) continue;
    const sub = (sig.metadata as { skill_subtype?: string } | null)?.skill_subtype;
    if (!sub || !FOCUS_SUBTYPES.has(sub)) continue;
    const text = toFocusText(sig);
    if (text) focusByStudent.set(sig.student_id, text);
  }

  const items: NextUpStudent[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    englishLevel: s.english_level ?? null,
    mainGoal: s.main_goal ?? null,
    nextLesson: nextLessonByStudent.get(s.id) ?? null,
    focusSignal: focusByStudent.get(s.id) ?? null,
  }));

  const withLesson = items
    .filter((i) => i.nextLesson)
    .sort((a, b) =>
      `${a.nextLesson!.date} ${a.nextLesson!.time}`.localeCompare(`${b.nextLesson!.date} ${b.nextLesson!.time}`),
    );
  const withoutLesson = items.filter((i) => !i.nextLesson); // keeps input order (updated_at desc)

  return [...withLesson, ...withoutLesson].slice(0, limit);
}

export function useNextUpStudents(students: Student[], limit = 3): { items: NextUpStudent[]; loading: boolean } {
  const { data: user } = useAuthUser();
  const teacherId = user?.id;
  const { isDemoMode, demoData } = useDemoContext();
  const ids = students.map((s) => s.id);

  const query = useQuery<NextUpStudent[]>({
    queryKey: ['dashboard-next-up', teacherId, ids.join(','), isDemoMode, limit],
    enabled: (isDemoMode ? !!demoData : !!teacherId) && ids.length > 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const in7 = format(addDays(new Date(), 7), 'yyyy-MM-dd');

      if (isDemoMode) {
        if (!demoData) return [];
        const slots: NextUpSlotRow[] = demoData.calendarSlots
          .filter((s) => s.status === 'booked' && s.slot_date >= today && s.slot_date <= in7)
          .sort((a, b) => `${a.slot_date} ${a.start_time}`.localeCompare(`${b.slot_date} ${b.start_time}`));
        const signals: NextUpSignalRow[] = demoData.knowledgeEntries
          .filter((e) => e.category === 'Skill Assessment' && !e.deleted_at && !e.is_outdated)
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        return aggregateNextUp(students, slots, signals, limit);
      }

      const [slotsRes, signalsRes] = await Promise.all([
        supabase
          .from('calendar_slots')
          .select('student_id, slot_date, start_time')
          .eq('teacher_id', teacherId!)
          .eq('status', 'booked')
          .in('student_id', ids)
          .gte('slot_date', today)
          .lte('slot_date', in7)
          .order('slot_date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('student_knowledge_entries')
          .select('student_id, content, metadata, created_at')
          .eq('teacher_id', teacherId!)
          .in('student_id', ids)
          .eq('category', 'Skill Assessment')
          .is('deleted_at', null)
          .eq('is_outdated', false)
          .order('created_at', { ascending: false })
          .limit(Math.max(ids.length * 5, 20)),
      ]);

      if (slotsRes.error) devWarn('useNextUpStudents slots error:', slotsRes.error.message);
      if (signalsRes.error) devWarn('useNextUpStudents signals error:', signalsRes.error.message);

      return aggregateNextUp(
        students,
        (slotsRes.data ?? []) as NextUpSlotRow[],
        (signalsRes.data ?? []) as NextUpSignalRow[],
        limit,
      );
    },
  });

  const waitingForDemo = isDemoMode && !demoData;
  return {
    items: query.data ?? [],
    loading: waitingForDemo || (ids.length > 0 && query.isLoading),
  };
}
