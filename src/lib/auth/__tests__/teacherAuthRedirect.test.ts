import { describe, it, expect } from 'vitest';
import { resolveTeacherAuthRedirect } from '../teacherAuthRedirect';

const base = { pathname: '/dashboard', search: '?action=add-student', wasRegistered: false };

describe('resolveTeacherAuthRedirect', () => {
  it('waits while auth is loading', () => {
    expect(resolveTeacherAuthRedirect({ ...base, loading: true, isRegisteredUser: false })).toBeNull();
  });

  it('stays for registered users', () => {
    expect(resolveTeacherAuthRedirect({ ...base, loading: false, isRegisteredUser: true })).toBeNull();
  });

  it('sends a visitor without a session to login and keeps path + query', () => {
    expect(resolveTeacherAuthRedirect({ ...base, loading: false, isRegisteredUser: false })).toEqual({
      to: '/login',
      state: { from: '/dashboard?action=add-student' },
    });
  });

  it('sends a signed-out teacher to the home page', () => {
    expect(
      resolveTeacherAuthRedirect({ ...base, loading: false, isRegisteredUser: false, wasRegistered: true }),
    ).toEqual({ to: '/' });
  });
});
