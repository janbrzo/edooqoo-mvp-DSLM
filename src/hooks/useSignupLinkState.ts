import { useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

/**
 * Centralizes "remember where user came from" before /signup or /login.
 *
 * Usage:
 *   const { signupTo, signupState, goToSignup } = useSignupLinkState();
 *   <Link to={signupTo} state={signupState}>Sign up</Link>
 *   <button onClick={() => goToSignup()}>Sign up</button>
 *   <button onClick={() => goToSignup('/signup?level=B1')}>Sign up</button>
 */
export function useSignupLinkState() {
  const loc = useLocation();
  const nav = useNavigate();
  const from = loc.pathname + loc.search;
  const signupState = useMemo(() => ({ from }), [from]);
  const goToSignup = useCallback(
    (to: string = '/signup') => nav(to, { state: signupState }),
    [nav, signupState]
  );
  const goToLogin = useCallback(
    (to: string = '/login') => nav(to, { state: signupState }),
    [nav, signupState]
  );
  return {
    signupTo: '/signup',
    loginTo: '/login',
    signupState,
    from,
    goToSignup,
    goToLogin,
  };
}
