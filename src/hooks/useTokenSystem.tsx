
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isFreeCustomDemoWeek } from '@/utils/promoUtils';
import { devLog } from '@/utils/logger';
import { useDemoContext } from '@/contexts/DemoContext';

export const useTokenSystem = (userId?: string | null) => {
  const [tokenLeft, setTokenLeft] = useState<number>(0);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isDemoMode, demoData } = useDemoContext();

  // Tri-state: null = not yet resolved (still loading auth status).
  // Critical: must NOT default to `true` — that produced the false "no tokens" race
  // because the second effect would then short-circuit with tokenLeft=0, loading=false,
  // and Index.tsx would open the paywall modal even for users with positive balance.
  const [isAnonymousUser, setIsAnonymousUser] = useState<boolean | null>(null);

  // Demo mode: return synthetic token data
  useEffect(() => {
    if (isDemoMode && demoData) {
      setTokenLeft(demoData.teacher.available_tokens);
      setProfile(demoData.teacher);
      setIsAnonymousUser(false);
      setLoading(false);
      return;
    }
  }, [isDemoMode, demoData]);

  useEffect(() => {
    if (isDemoMode) return;
    checkUserStatus();
  }, [isDemoMode]);

  useEffect(() => {
    if (isDemoMode) return;
    if (isAnonymousUser === null) {
      // Auth status not yet resolved — keep `loading` true and wait.
      return;
    }
    if (userId && isAnonymousUser === false) {
      fetchTokenBalance();
    } else {
      setLoading(false);
      setTokenLeft(0);
      setProfile(null);
    }
  }, [userId, isAnonymousUser, isDemoMode]);

  const checkUserStatus = async () => {
    if (isDemoMode) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let anonymous = user?.is_anonymous === true;
      
      if (user?.email && user.email.trim() !== '') {
        anonymous = false;
      }
      
      devLog('🔍 User status check:', {
        hasUser: !!user,
        userId: user?.id,
        isAnonymous: user?.is_anonymous,
        hasEmail: !!user?.email,
        email: user?.email,
        finalAnonymousStatus: anonymous
      });
      setIsAnonymousUser(anonymous);
    } catch (error) {
      console.error('Error checking user status:', error);
      setIsAnonymousUser(true);
    }
  };

  const fetchTokenBalance = async () => {
    if (isDemoMode) return;
    if (!userId || isAnonymousUser) {
      devLog('🔍 Skipping token fetch - anonymous user');
      return;
    }
    
    try {
      devLog('🔍 Fetching token balance for authenticated user:', userId);
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('available_tokens, is_tokens_frozen, monthly_worksheet_limit, subscription_type, monthly_worksheets_used, total_worksheets_created, total_tokens_consumed, total_tokens_received, subscription_status, subscription_expires_at')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          devLog('🔍 No profile found for authenticated user - this is normal for new users');
          setTokenLeft(0);
          setProfile(null);
          return;
        }
        throw error;
      }
      
      const availableTokens = profileData?.available_tokens || 0;
      
      devLog('🔍 Token balance fetched:', {
        availableTokens,
        is_tokens_frozen: profileData?.is_tokens_frozen,
        subscription_type: profileData?.subscription_type
      });
      
      setTokenLeft(availableTokens);
      setProfile(profileData);
    } catch (error: any) {
      console.error('Error fetching token balance:', error);
      
      if (!isAnonymousUser) {
        toast({
          title: "Error",
          description: "Failed to fetch token balance",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const consumeToken = async (worksheetId: string): Promise<boolean> => {
    devLog('🎯 consumeToken CALLED:', { 
      userId, 
      worksheetId, 
      isAnonymousUser,
      isFreeWeek: isFreeCustomDemoWeek(),
      currentTokens: tokenLeft,
      profileState: profile
    });
    
    if (!userId || isAnonymousUser) {
      devLog('❌ consumeToken ABORTED: No userId or anonymous user');
      return false;
    }
    
    if (isFreeCustomDemoWeek()) {
      devLog('🎁 FREE DEMO WEEK: Token consumption bypassed for authenticated user');
      await fetchTokenBalance();
      return true;
    }
    
    try {
      devLog('📡 CALLING RPC consume_token with params:', {
        p_teacher_id: userId,
        p_worksheet_id: worksheetId
      });
      
      const { data, error } = await supabase
        .rpc('consume_token', { 
          p_teacher_id: userId, 
          p_worksheet_id: worksheetId 
        });
      
      devLog('📥 RPC RESPONSE:', { 
        data, 
        error,
        errorDetails: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        } : null
      });
      
      if (error) {
        console.error('❌ RPC ERROR:', error);
        throw error;
      }
      
      if (data === true) {
        devLog('✅ Token consumed successfully, refreshing balance...');
        await fetchTokenBalance();
        return true;
      } else {
        devLog('⚠️ Token consumption returned FALSE:', data);
        return false;
      }
    } catch (error: any) {
      console.error('💥 ERROR consuming token:', {
        error,
        message: error?.message,
        code: error?.code,
        details: error?.details
      });
      return false;
    }
  };

  const hasTokens = () => {
    if (isAnonymousUser !== false) {
      devLog('🔍 hasTokens() - Anonymous user, returning true (demo mode)');
      return true;
    }
    
    if (isFreeCustomDemoWeek()) {
      devLog('🎁 FREE DEMO WEEK: hasTokens() - Authenticated user gets free access');
      return true;
    }

    // Client entitlement parity with backend `consume_token`:
    // Backend allows generation when EITHER available_tokens > 0 OR monthly_worksheet_limit
    // is not yet exhausted. Front-end must mirror this so we never show a false paywall
    // to a teacher who still has monthly entitlement left.
    const monthlyLimit = Number(profile?.monthly_worksheet_limit ?? 0);
    const monthlyUsed = Number(profile?.monthly_worksheets_used ?? 0);
    const monthlyRoom = monthlyLimit > 0 && monthlyUsed < monthlyLimit;
    const result = !(profile?.is_tokens_frozen) && (tokenLeft > 0 || monthlyRoom);
    devLog('🔍 hasTokens() - Authenticated user (normal mode):', {
      tokenLeft,
      is_tokens_frozen: profile?.is_tokens_frozen,
      monthlyLimit,
      monthlyUsed,
      result
    });
    return result;
  };

  const isDemo = isDemoMode || isAnonymousUser !== false;

  devLog('🔍 useTokenSystem final state:', {
    userId,
    tokenLeft,
    isDemo,
    isAnonymousUser,
    hasTokens: hasTokens(),
    loading
  });

  return {
    tokenLeft,
    profile,
    loading,
    hasTokens: hasTokens(),
    canGenerateWorksheet: hasTokens(),
    isDemo,
    consumeToken,
    refetchBalance: fetchTokenBalance
  };
};
