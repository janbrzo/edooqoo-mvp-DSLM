import { describe, it, expect } from 'vitest';
import { notificationPath } from '../notificationRoute';

describe('notificationPath', () => {
  it('opens the review page by homework id for a submission (never the share link)', () => {
    expect(notificationPath({ notification_type: 'completed', homework_id: 'hw1', student_id: 's1' }))
      .toBe('/homework/hw1/review');
  });

  it('opens the student Tests tab for a completed Welcome Test', () => {
    expect(notificationPath({ notification_type: 'welcome_test_completed', homework_id: null, student_id: 's1' }))
      .toBe('/student/s1?tab=tests');
  });

  it('opens the student homework for viewed and overdue notifications', () => {
    expect(notificationPath({ notification_type: 'viewed', homework_id: 'hw1', student_id: 's1' }))
      .toBe('/student/s1?tab=homework');
    expect(notificationPath({ notification_type: 'overdue', homework_id: 'hw1', student_id: 's1' }))
      .toBe('/student/s1?tab=homework');
  });

  it('falls back to the dashboard when nothing identifies the target', () => {
    expect(notificationPath({ notification_type: 'completed', homework_id: null, student_id: null })).toBe('/dashboard');
  });
});

describe('both bells use the shared route', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof import('node:path');
  const read = (f: string) => readFileSync(join(__dirname, '../../../', f), 'utf8');

  it.each([
    'components/notifications/UnifiedBell.tsx',
    'components/homework/HomeworkNotificationBadge.tsx',
  ])('%s navigates through notificationPath and never to the student share link', (file) => {
    const src = read(file);
    expect(src).toContain('notificationPath(');
    expect(src).not.toMatch(/navigate\(`\/homework\/\$\{[^}]*share_token/);
  });
});
