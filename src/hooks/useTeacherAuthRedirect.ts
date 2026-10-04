import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveTeacherAuthRedirect } from '@/lib/auth/teacherAuthRedirect';

/** Redirects non-registered visitors away from a teacher-only page (see teacherAuthRedirect.ts). */
export function useTeacherAuthRedirect(loading: boolean, isRegisteredUser: boolean) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const wasRegistered = useRef(false);

  useEffect(() => {
    if (isRegisteredUser) wasRegistered.current = true;
    const target = resolveTeacherAuthRedirect({
      loading,
      isRegisteredUser: !!isRegisteredUser,
      wasRegistered: wasRegistered.current,
      pathname,
      search,
    });
    if (!target) return;
    navigate(target.to, { replace: true, state: target.state });
  }, [loading, isRegisteredUser, pathname, search, navigate]);
}
