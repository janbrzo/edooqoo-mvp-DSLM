import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

/**
 * Cached auth user — avoids hitting Supabase Auth on every hook mount.
 * staleTime: Infinity because user identity does not change without sign in/out.
 * The auth state listener in useAuthFlow handles sign-in/out events; on those
 * we invalidate this query elsewhere if needed.
 */
export const useAuthUser = () => {
  return useQuery<User | null>({
    queryKey: ['auth-user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
};
