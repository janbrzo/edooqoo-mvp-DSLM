import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useDemoContext } from '@/contexts/DemoContext';
import { devWarn } from '@/utils/logger';
import type { Tables } from '@/integrations/supabase/types';

/**
 * useDashboardAttention — data layer for the "Needs your attention" zone
 * of the Today dashboard. Merges three teacher-facing signals into one
 * time-ordered list:
 *   - homework submitted by a student but not yet reviewed
 *   - unread "welcome_test_completed" notifications
 *   - unresolved calendar (booking) notifications
 *
 * Demo mode: only the homework source is derived from `demoData`;
 * the other two are empty. Zero Supabase calls in demo.
 * Any query error degrades to an empty source (never throws).
 */

type Student = Tables<'students'>;

export type AttentionKind = 'homework_to_review' | 'welcome_test_done' | 'booking_new';

export interface AttentionItem {
  /** `${kind}:${sourceId}` */
  id: string;
  kind: AttentionKind;
  /** English sentence with the student name already resolved */
  text: string;
  ctaLabel: 'Review' | 'See results' | 'Open calendar';
  href: string;
  createdAt: string;
}

export interface AttentionHomeworkRow {
  id: string;
  title: string | null;
  student_id: string | null;
  completed_at: string | null;
}
export interface AttentionWelcomeTestRow {
  id: string;
  student_id: string | null;
  message: string | null;
  created_at: string;
}
export interface AttentionBookingRow {
  id: string;
  message: string | null;
  student_name: string | null;
  slot_id: string | null;
  created_at: string;
}

type NameResolver = (studentId: string | null | undefined) => string;

export function buildStudentNameResolver(students: Pick<Student, 'id' | 'name'>[]): NameResolver {
  const byId = new Map(students.map((s) => [s.id, s.name]));
  return (id) => (id ? byId.get(id) : undefined) ?? 'A student';
}

/** Pure mapping + merge — exported for unit tests and demo reuse. */
export function mapAttentionItems(
  input: {
    homework: AttentionHomeworkRow[];
    welcomeTests: AttentionWelcomeTestRow[];
    bookings: AttentionBookingRow[];
  },
  nameOf: NameResolver,
  limit: number,
): AttentionItem[] {
  const homework: AttentionItem[] = input.homework
    .filter((h) => !!h.completed_at)
    .map((h) => ({
      id: `homework_to_review:${h.id}`,
      kind: 'homework_to_review',
      text: `${nameOf(h.student_id)} submitted "${h.title ?? 'Homework'}"`,
      ctaLabel: 'Review',
      href: `/homework/${h.id}/review`,
      createdAt: h.completed_at as string,
    }));

  const welcomeTests: AttentionItem[] = input.welcomeTests.map((n) => ({
    id: `welcome_test_done:${n.id}`,
    kind: 'welcome_test_done',
    text: `${nameOf(n.student_id)} finished the Welcome Test`,
    ctaLabel: 'See results',
    href: n.student_id ? `/student/${n.student_id}?tab=tests` : '/dashboard',
    createdAt: n.created_at,
  }));

  const bookings: AttentionItem[] = input.bookings.map((b) => ({
    id: `booking_new:${b.id}`,
    kind: 'booking_new',
    text: b.message?.trim() || `${b.student_name ?? 'A student'} booked a lesson`,
    ctaLabel: 'Open calendar',
    href: '/calendar',
    createdAt: b.created_at,
  }));

  return [...homework, ...welcomeTests, ...bookings]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function useDashboardAttention(students: Student[], limit = 5): { items: AttentionItem[]; loading: boolean } {
  const { data: user } = useAuthUser();
  const teacherId = user?.id;
  const { isDemoMode, demoData } = useDemoContext();
  const nameOf = buildStudentNameResolver(students);

  const query = useQuery<AttentionItem[]>({
    // students are included only through the resolver; name changes are rare
    // enough that the 60s staleTime covers them.
    queryKey: ['dashboard-attention', teacherId, isDemoMode, limit, students.length],
    enabled: isDemoMode ? !!demoData : !!teacherId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (isDemoMode) {
        if (!demoData) return [];
        const homework: AttentionHomeworkRow[] = demoData.homework.filter(
          (h) => !!h.completed_at && !h.reviewed_at,
        );
        return mapAttentionItems({ homework, welcomeTests: [], bookings: [] }, nameOf, limit);
      }

      const [hwRes, wtRes, bkRes] = await Promise.all([
        supabase
          .from('homework_assignments')
          .select('id, title, student_id, completed_at')
          .eq('teacher_id', teacherId!)
          .not('completed_at', 'is', null)
          .is('reviewed_at', null)
          .order('completed_at', { ascending: false })
          .limit(limit),
        supabase
          .from('homework_notifications')
          .select('id, student_id, message, created_at')
          .eq('teacher_id', teacherId!)
          .eq('notification_type', 'welcome_test_completed')
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('calendar_notifications')
          .select('id, message, student_name, slot_id, created_at')
          .eq('teacher_id', teacherId!)
          .eq('is_resolved', false)
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

      if (hwRes.error) devWarn('useDashboardAttention homework error:', hwRes.error.message);
      if (wtRes.error) devWarn('useDashboardAttention welcome-test error:', wtRes.error.message);
      if (bkRes.error) devWarn('useDashboardAttention booking error:', bkRes.error.message);

      return mapAttentionItems(
        {
          homework: (hwRes.data ?? []) as AttentionHomeworkRow[],
          welcomeTests: (wtRes.data ?? []) as AttentionWelcomeTestRow[],
          bookings: (bkRes.data ?? []) as AttentionBookingRow[],
        },
        nameOf,
        limit,
      );
    },
  });

  const waitingForDemo = isDemoMode && !demoData;
  return { items: query.data ?? [], loading: waitingForDemo || query.isLoading };
}
