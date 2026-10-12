/**
 * Student Hub landing URL that keeps the teacher the student came from.
 * `/my/:teacherToken` pages redirect here when no email is saved (new browser,
 * expired TTL, re-auth); `?teacher=` lets the landing page skip the teacher
 * picker once the email matches that teacher.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function sanitizeHubTeacherToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return TOKEN_PATTERN.test(raw) ? raw : null;
}

export function hubLandingPath(teacherToken?: string | null): string {
  const token = sanitizeHubTeacherToken(teacherToken);
  return token ? `/my?teacher=${encodeURIComponent(token)}` : '/my';
}

/** Picks the teacher matching the preferred token, else the only teacher, else null. */
export function pickHubTeacher<T extends { token: string }>(
  teachers: T[],
  preferredToken: string | null,
): T | null {
  if (preferredToken) {
    const match = teachers.find((t) => t.token === preferredToken);
    if (match) return match;
  }
  return teachers.length === 1 ? teachers[0] : null;
}
