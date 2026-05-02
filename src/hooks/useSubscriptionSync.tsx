
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSubscriptionSync = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const syncSubscriptionStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription-status');
      
      if (error) throw error;

      if (data?.subscribed) {
        toast({
          title: "Subscription Synchronized",
          description: `Your ${data.subscription_type} subscription is now active!`,
        });
      } else {
        toast({
          title: "No Active Subscription",
          description: "No active subscription found in your account.",
          variant: "destructive"
        });
      }

      return data;
    } catch (error: any) {
      console.error('Error syncing subscription:', error);
      toast({
        title: "Sync Error",
        description: "Failed to sync subscription status. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    syncSubscriptionStatus,
    loading
  };
};
