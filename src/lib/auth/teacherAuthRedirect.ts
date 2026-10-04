/**
 * Decides where a teacher-only page sends a visitor who is not a registered user.
 *
 * - still loading or registered            -> stay (null)
 * - was registered on this page, now not   -> '/' (explicit sign-out, same as before)
 * - never registered on this page          -> '/login' carrying the requested path,
 *   so email links such as /dashboard?action=add-student survive the login round trip.
 */
export type TeacherAuthRedirect = { to: string; state?: { from: string } } | null;

interface Input {
  loading: boolean;
  isRegisteredUser: boolean;
  wasRegistered: boolean;
  pathname: string;
  search: string;
}

export function resolveTeacherAuthRedirect({
  loading,
  isRegisteredUser,
  wasRegistered,
  pathname,
  search,
}: Input): TeacherAuthRedirect {
  if (loading || isRegisteredUser) return null;
  if (wasRegistered) return { to: '/' };
  return { to: '/login', state: { from: `${pathname}${search}` } };
}
