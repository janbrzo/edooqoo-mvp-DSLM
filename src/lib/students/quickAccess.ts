import { formatGoal } from './formatGoal';

/**
 * quickAccess — pure helpers behind the dashboard quick student access
 * (v6.9.110: header search + recent pills + inline All students list).
 *
 * Kept free of React/Supabase so the matching rules can be unit-tested and
 * shared by every quick-access surface.
 */
export interface QuickAccessStudent {
  id: string;
  name: string;
  student_email?: string | null;
  main_goal?: string | null;
  english_level?: string | null;
  updated_at?: string | null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Filter students by name, email or goal label. Empty/whitespace query returns
 * the list unchanged (callers decide whether to render anything).
 * Name matches rank above email/goal matches; original order breaks ties.
 */
export function filterStudents<T extends QuickAccessStudent>(
  students: T[],
  query: string,
  limit = 8,
): T[] {
  const q = normalize(query ?? '');
  if (!q) return students.slice(0, limit);

  const nameHits: T[] = [];
  const otherHits: T[] = [];

  for (const s of students) {
    if (normalize(s.name ?? '').includes(q)) {
      nameHits.push(s);
      continue;
    }
    const haystack = `${s.student_email ?? ''} ${formatGoal(s.main_goal)}`;
    if (normalize(haystack).includes(q)) otherHits.push(s);
  }

  return [...nameHits, ...otherHits].slice(0, limit);
}

/**
 * Most recently touched students (`updated_at` desc), skipping ids already
 * surfaced elsewhere on the page (Next up cards).
 */
export function pickRecentStudents<T extends QuickAccessStudent>(
  students: T[],
  excludeIds: string[] = [],
  limit = 8,
): T[] {
  const excluded = new Set(excludeIds);
  return [...students]
    .filter((s) => !excluded.has(s.id))
    .sort((a, b) => {
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

/** Canonical destination for every quick-access click: straight into prep. */
export function studentPrepPath(studentId: string): string {
  return `/student/${studentId}?tab=dslm`;
}
