import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for checking existing authentication session.
 * Does NOT create anonymous accounts - only reads existing sessions.
 */
export function useAnonymousAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function checkExistingSession() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUserId(session.user.id);
        }
      } catch (err) {
        console.error('Error checking session:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    checkExistingSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { userId, loading, error };
}
