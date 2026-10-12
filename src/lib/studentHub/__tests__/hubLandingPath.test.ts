import { describe, it, expect } from 'vitest';
import { hubLandingPath, pickHubTeacher, sanitizeHubTeacherToken } from '../hubLandingPath';

describe('hubLandingPath', () => {
  it('keeps a valid teacher token', () => {
    expect(hubLandingPath('abc_123-X')).toBe('/my?teacher=abc_123-X');
  });
  it('falls back to /my without or with an unsafe token', () => {
    expect(hubLandingPath(undefined)).toBe('/my');
    expect(hubLandingPath('a/b?c')).toBe('/my');
    expect(sanitizeHubTeacherToken('<script>')).toBeNull();
  });
});

describe('pickHubTeacher', () => {
  const a = { token: 'a', name: 'A' };
  const b = { token: 'b', name: 'B' };
  it('prefers the token from the link', () => {
    expect(pickHubTeacher([a, b], 'b')).toBe(b);
  });
  it('uses the only teacher when no match', () => {
    expect(pickHubTeacher([a], 'zzz')).toBe(a);
  });
  it('returns null when ambiguous', () => {
    expect(pickHubTeacher([a, b], null)).toBeNull();
    expect(pickHubTeacher([a, b], 'zzz')).toBeNull();
  });
});
