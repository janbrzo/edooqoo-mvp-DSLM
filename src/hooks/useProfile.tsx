
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from '@/hooks/use-toast';
import { devLog } from '@/utils/logger';
import { useDemoContext } from '@/contexts/DemoContext';

type Profile = Tables<'profiles'>;

export const useProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDemoMode, demoData } = useDemoContext();

  useEffect(() => {
    if (isDemoMode && demoData) {
      setProfile(demoData.teacher as unknown as Profile);
      setLoading(false);
      return;
    }
    fetchProfile();

    const handleVisibilityChange = () => {
      if (isDemoMode) return;
      if (!document.hidden) {
        setTimeout(async () => {
          try {
            await supabase.functions.invoke('check-subscription-status');
            devLog('[useProfile] Auto subscription sync completed on visibility change');
          } catch (error) {
            console.error('[useProfile] Auto subscription sync failed:', error);
          } finally {
            await fetchProfile();
          }
        }, 1000);
      }
    };

    const handleWindowFocus = () => {
      if (isDemoMode) return;
      const urlParams = new URLSearchParams(window.location.search);
      
      if (urlParams.get('success') === 'true') {
        setTimeout(async () => {
          try {
            await supabase.functions.invoke('check-subscription-status');
            await fetchProfile();
          } catch (error) {
            console.error('[useProfile] Error syncing subscription after payment:', error);
          }
        }, 3000);
      } else {
        setTimeout(async () => {
          try {
            await supabase.functions.invoke('check-subscription-status');
            devLog('[useProfile] Auto subscription sync completed on focus');
            await fetchProfile();
          } catch (error) {
            console.error('[useProfile] Auto subscription sync failed on focus:', error);
            await fetchProfile();
          }
        }, 500);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isDemoMode, demoData]);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isAnonymous = user.is_anonymous === true || !user.email;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (!isAnonymous && error.code !== 'PGRST116') {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive"
          });
        }
        return;
      }
      
      setProfile(data);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      
      const { data: { user } } = await supabase.auth.getUser();
      const isAnonymous = user?.is_anonymous === true || !user?.email;
      
      if (!isAnonymous) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    loading,
    refetch: fetchProfile
  };
};
