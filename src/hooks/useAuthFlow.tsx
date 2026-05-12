
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { devLog, devWarn } from '@/utils/logger';
import { useDemoContext } from '@/contexts/DemoContext';
import { claimPendingWorksheets, getPendingClaimIds } from '@/hooks/useWorksheetClaim';
import { toast } from 'sonner';

export type AccountType = 'demo' | 'side-gig' | 'full-time' | null;

// Synthetic user for demo mode
const DEMO_USER = {
  id: 'demo-teacher',
  email: 'demo@edooqoo.com',
  is_anonymous: false,
  app_metadata: {},
  user_metadata: { first_name: 'Demo', last_name: 'Teacher' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as unknown as User;

export function useAuthFlow() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const { isDemoMode, exitDemo } = useDemoContext();

  useEffect(() => {
    // Demo mode: return synthetic user, skip Supabase
    if (isDemoMode) {
      setUser(DEMO_USER);
      setSession(null);
      setIsAnonymous(false);
      setLoading(false);
      return;
    }

    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const anonymous = session?.user?.is_anonymous === true;
      devLog(`Auth change: ${event}, anonymous=${anonymous}`);
      setSession(session);
      setUser(session?.user ?? null);
      setIsAnonymous(anonymous);
      setLoading(false);

      // v6.1: claim worksheets generated while anonymous, AFTER sign-in /
      // sign-up of a real account. Wrapped in setTimeout(_, 0) to avoid
      // Supabase auth deadlock (sync callbacks must NOT call other Supabase
      // APIs synchronously).
      if (event === 'SIGNED_IN' && session?.user && !session.user.is_anonymous) {
        if (getPendingClaimIds().length > 0) {
          setTimeout(async () => {
            try {
              const claimed = await claimPendingWorksheets();
              if (claimed.length > 0) {
                toast.success(
                  claimed.length === 1
                    ? '1 worksheet saved to your account'
                    : `${claimed.length} worksheets saved to your account`
                );
                window.dispatchEvent(new CustomEvent('worksheetsClaimed', {
                  detail: { ids: claimed },
                }));
              }
            } catch (e) {
              devWarn('[useAuthFlow] claim failed:', e);
            }
          }, 0);
        }
      }
    });

    // Check for existing session without creating anonymous account
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsAnonymous(session?.user?.is_anonymous === true);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isDemoMode]);

  const signOut = async () => {
    if (isDemoMode) {
      exitDemo();
      return;
    }
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const isRegisteredUser = isDemoMode ? true : (user && !isAnonymous && user.email);

  return {
    user,
    session,
    loading,
    isAnonymous,
    isRegisteredUser,
    isDemoMode,
    signOut
  };
}
