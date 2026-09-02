import { describe, expect, it } from 'vitest';
import { aggregateNextUp } from '@/hooks/useNextUpStudents';
import { buildStudentNameResolver, mapAttentionItems } from '@/hooks/useDashboardAttention';
import { formatGoal } from '@/lib/students/formatGoal';

const students = [
  { id: 's1', name: 'Anna Kowalska', english_level: 'B2', main_goal: 'work' },
  { id: 's2', name: 'Marco Rossi', english_level: 'A2', main_goal: 'travel' },
  { id: 's3', name: 'Li Wei', english_level: 'C1', main_goal: 'academic' },
];

describe('aggregateNextUp', () => {
  it('puts students with a lesson first, sorted by date + time', () => {
    const slots = [
      { student_id: 's3', slot_date: '2026-09-03', start_time: '18:00:00' },
      { student_id: 's3', slot_date: '2026-09-05', start_time: '09:00:00' },
      { student_id: 's1', slot_date: '2026-09-03', start_time: '20:00:00' },
    ];
    const items = aggregateNextUp(students, slots, [], 3);
    expect(items.map((i) => i.id)).toEqual(['s3', 's1', 's2']);
    expect(items[0].nextLesson).toEqual({ date: '2026-09-03', time: '18:00:00' });
    expect(items[2].nextLesson).toBeNull();
  });

  it('keeps input order for students without a lesson and respects limit', () => {
    const items = aggregateNextUp(students, [], [], 2);
    expect(items.map((i) => i.id)).toEqual(['s1', 's2']);
  });

  it('picks the latest weakness/mistake/practice signal and ignores strengths', () => {
    const signals = [
      { student_id: 's1', content: 'Great reading', metadata: { skill_subtype: 'strength' }, created_at: '2026-09-02' },
      { student_id: 's1', content: 'Mixes up past simple and present perfect', metadata: { skill_subtype: 'mistake' }, created_at: '2026-09-01' },
      { student_id: 's2', content: null, metadata: { skill_subtype: 'weakness', nano_skill: 'articles' }, created_at: '2026-09-01' },
    ];
    const items = aggregateNextUp(students, [], signals, 3);
    expect(items.find((i) => i.id === 's1')?.focusSignal).toBe('Mixes up past simple and present perfect');
    expect(items.find((i) => i.id === 's2')?.focusSignal).toBe('articles');
    expect(items.find((i) => i.id === 's3')?.focusSignal).toBeNull();
  });
});

describe('mapAttentionItems', () => {
  const nameOf = buildStudentNameResolver(students);

  it('maps all three kinds with resolved names and sorts newest first', () => {
    const items = mapAttentionItems(
      {
        homework: [{ id: 'hw1', title: 'Email Writing', student_id: 's1', completed_at: '2026-09-01T10:00:00Z' }],
        welcomeTests: [{ id: 'n1', student_id: 's2', message: null, created_at: '2026-09-02T10:00:00Z' }],
        bookings: [{ id: 'b1', message: 'Li Wei booked Tue 18:00', student_name: 'Li Wei', slot_id: 'x', created_at: '2026-08-31T10:00:00Z' }],
      },
      nameOf,
      5,
    );
    expect(items.map((i) => i.kind)).toEqual(['welcome_test_done', 'homework_to_review', 'booking_new']);
    expect(items[1]).toMatchObject({
      id: 'homework_to_review:hw1',
      text: 'Anna Kowalska submitted "Email Writing"',
      ctaLabel: 'Review',
      href: '/homework/hw1/review',
    });
    expect(items[0]).toMatchObject({ text: 'Marco Rossi finished the Welcome Test', href: '/student/s2?tab=tests' });
    expect(items[2]).toMatchObject({ text: 'Li Wei booked Tue 18:00', href: '/calendar', ctaLabel: 'Open calendar' });
  });

  it('falls back to "A student" for unknown ids and applies limit', () => {
    const items = mapAttentionItems(
      {
        homework: [
          { id: 'hw1', title: null, student_id: 'ghost', completed_at: '2026-09-01T10:00:00Z' },
          { id: 'hw2', title: 'B', student_id: 's1', completed_at: '2026-09-02T10:00:00Z' },
        ],
        welcomeTests: [],
        bookings: [],
      },
      nameOf,
      1,
    );
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('homework_to_review:hw2');
    const all = mapAttentionItems(
      { homework: [{ id: 'hw1', title: null, student_id: 'ghost', completed_at: '2026-09-01T10:00:00Z' }], welcomeTests: [], bookings: [] },
      nameOf,
      5,
    );
    expect(all[0].text).toBe('A student submitted "Homework"');
  });
});

describe('formatGoal', () => {
  it('maps legacy codes and passes free text through', () => {
    expect(formatGoal('work')).toBe('Work/Business');
    expect(formatGoal('Business English — meetings')).toBe('Business English — meetings');
    expect(formatGoal(null)).toBe('');
  });
});
