import { describe, expect, it } from 'vitest';
import { addDays, format } from 'date-fns';
import { guidedSteps } from '../GuidedStepsBar';
import { formatLesson } from '../NextUpCard';
import { getGreeting, plural } from '../DashboardHeader';

describe('guidedSteps', () => {
  it('maps onboarding steps to the 3 guided steps in order', () => {
    const steps = guidedSteps({ add_student: true, generate_worksheet: false });
    expect(steps.map((s) => s.key)).toEqual(['add_student', 'generate_worksheet', 'create_homework']);
    expect(steps.map((s) => s.done)).toEqual([true, false, false]);
  });

  it('treats undefined steps as not done', () => {
    expect(guidedSteps(undefined).every((s) => !s.done)).toBe(true);
  });
});

describe('formatLesson', () => {
  it('uses Today / Tomorrow / weekday', () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const later = addDays(new Date(), 3);
    expect(formatLesson({ date: today, time: '18:00:00' })).toBe('Today 18:00');
    expect(formatLesson({ date: tomorrow, time: '09:30:00' })).toBe('Tomorrow 09:30');
    expect(formatLesson({ date: format(later, 'yyyy-MM-dd'), time: '17:15:00' })).toBe(
      `${format(later, 'EEE')} 17:15`,
    );
  });
});

describe('DashboardHeader helpers', () => {
  it('greets by hour', () => {
    expect(getGreeting(8)).toBe('Good morning');
    expect(getGreeting(13)).toBe('Good afternoon');
    expect(getGreeting(21)).toBe('Good evening');
  });
  it('pluralises', () => {
    expect(plural(1, 'student')).toBe('1 student');
    expect(plural(3, 'lesson')).toBe('3 lessons');
  });
});
