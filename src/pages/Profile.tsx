import React, { useState, useEffect, useRef } from 'react';
import { AuthenticatedPageShell } from '@/components/AuthenticatedPageShell';
import { PageLoadingState } from '@/components/ui/PageLoadingState';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useProfile } from '@/hooks/useProfile';
import { useTokenSystem } from '@/hooks/useTokenSystem';
import { usePlanLogic } from '@/hooks/usePlanLogic';
import { EditableProfileField } from '@/components/profile/EditableProfileField';
import { ConfirmDowngradeDialog } from '@/components/ConfirmDowngradeDialog';
import { toast } from '@/hooks/use-toast';
import { User, Coins, CreditCard, Calendar, Zap, GraduationCap, Users, Mail } from 'lucide-react';
import { FreeWeekBanner } from '@/components/FreeWeekBanner';
import StickyNav from '@/components/landing/StickyNav';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useDemoContext } from '@/contexts/DemoContext';
import { devLog } from '@/utils/logger';

const Profile = () => {
  const { user, loading, isRegisteredUser } = useAuthFlow();
  const { profile, loading: profileLoading, refetch } = useProfile();
  const { tokenLeft } = useTokenSystem(user?.id);
  const { currentPlan, plans, canUpgradeTo, getUpgradePrice, getUpgradeTokens, getRecommendedFullTimePlan } = usePlanLogic(profile?.subscription_type);
  const { resetOnboarding } = useOnboardingProgress();
  const { isDemoMode } = useDemoContext();
  const navigate = useNavigate();
  
  // FIXED: Use ref to track if user manually selected a plan
  const userSelectedFullTimePlan = useRef(false);
  const [selectedFullTimePlan, setSelectedFullTimePlan] = useState(() => getRecommendedFullTimePlan());
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const syncExecutedRef = useRef(false);
  const upgradeProcessedRef = useRef(false);

  // NEW: Downgrade dialog state
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [pendingDowngrade, setPendingDowngrade] = useState<{
    planType: 'side-gig' | 'full-time';
    targetPlan: any;
  } | null>(null);

  // FIXED: Update selectedFullTimePlan only when currentPlan changes and user hasn't manually selected
  useEffect(() => {
    if (!userSelectedFullTimePlan.current) {
      const recommendedPlan = getRecommendedFullTimePlan();
      setSelectedFullTimePlan(recommendedPlan);
    }
  }, [getRecommendedFullTimePlan, profile?.subscription_type]);

  // FIXED: Handle manual dropdown change
  const handleFullTimePlanChange = (value: string) => {
    userSelectedFullTimePlan.current = true;
    setSelectedFullTimePlan(value);
  };

  // Check if user is properly authenticated (not anonymous) and redirect immediately
  useEffect(() => {
    if (!loading && !isRegisteredUser) {
      navigate('/');
    }
  }, [loading, isRegisteredUser, navigate]);

  // FIXED: Handle Stripe return with idempotency protection
  useEffect(() => {
    if (isDemoMode) return;
    const handleStripeReturn = async () => {
      if (!user?.id || loading || upgradeProcessedRef.current) return;

      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      const success = urlParams.get('success');
      
      if (sessionId && success === 'true') {
        // Prevent multiple processing
        upgradeProcessedRef.current = true;
        
        // Check sessionStorage to prevent duplicate processing
        const processedKey = `upgrade_processed_${sessionId}`;
        if (sessionStorage.getItem(processedKey)) {
          devLog('[Profile] Upgrade already processed for this session, skipping');
          // Clear URL parameters
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
          return;
        }
        
        devLog('[Profile] Detected return from Stripe with session_id:', sessionId);
        
        // ENHANCED DEBUG: Add comprehensive logging for troubleshooting
        devLog('[Profile] DEBUG: URL params:', { sessionId, success });
        devLog('[Profile] DEBUG: User info:', { userId: user?.id, email: user?.email });
        devLog('[Profile] DEBUG: Current profile:', { profile });
        
        try {
          // Mark as processing in sessionStorage
          sessionStorage.setItem(processedKey, 'true');
          
          devLog('[Profile] Calling finalize-upgrade to process all tables...');
          // Call finalize-upgrade as primary mechanism to update all tables
          let upgradeData = null;
          try {
            const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke('finalize-upgrade', {
              body: { session_id: sessionId }
            });
            
            if (finalizeError) {
              console.error('[Profile] Finalize-upgrade error:', finalizeError);
              throw finalizeError;
            }
            
            upgradeData = finalizeData;
            devLog('[Profile] Finalize-upgrade successful:', upgradeData);
          } catch (finalizeErr) {
            console.error('[Profile] Finalize-upgrade failed, falling back to webhook processing:', finalizeErr);
            // Wait for webhook to process as fallback
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
          // Sync subscription status after processing
          devLog('[Profile] Syncing subscription status after processing...');
          const { data: syncData, error: syncError } = await supabase.functions.invoke('check-subscription-status');
          
          if (!syncError && syncData?.subscribed) {
            devLog('[Profile] Subscription synced successfully:', syncData);
            
            toast({
              title: "Upgrade Successful!",
              description: "Your subscription upgrade has been processed successfully.",
            });
            
            // Refresh profile data after upgrade
            await refetch();
          } else {
            devLog('[Profile] Sync completed but no subscription found');
            toast({
              title: "Payment Successful!",
              description: "Your payment has been processed successfully.",
            });
          }
        } catch (error) {
          console.error('[Profile] Error processing webhook response:', error);
          toast({
            title: "Payment Processed",
            description: "Your payment was successful. It may take a moment to update your account.",
          });
          
          // Still try to refresh
          await refetch();
        } finally {
          // Clear URL parameters
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      }
    };

    handleStripeReturn();
  }, [user?.id, loading, refetch]);

  // Sync subscription status on page mount only once
  useEffect(() => {
    if (isDemoMode) return;
    const syncSubscriptionData = async () => {
      if (!user?.id || loading || syncExecutedRef.current) return;
      
      syncExecutedRef.current = true;
      
      try {
        devLog('Syncing subscription status on profile page mount');
        await supabase.functions.invoke('check-subscription-status');
        
        // Fetch fallback subscription data from subscriptions table
        const { data: subData, error: subError } = await supabase
          .from('subscriptions')
          .select('current_period_end, subscription_status')
          .eq('teacher_id', user.id)
          .single();
          
        if (!subError && subData) {
          setSubscriptionData(subData);
          devLog('Fetched subscription data:', subData);
        }
        
        // Refresh profile data
        await refetch();
      } catch (error) {
        console.error('Error syncing subscription:', error);
      }
    };

    syncSubscriptionData();
  }, [user?.id, loading, refetch]);

  const fullTimePlans = [
    { tokens: '30', price: 19 },
    { tokens: '60', price: 39 },
    { tokens: '90', price: 59 },
    { tokens: '120', price: 79 }
  ];

  const selectedPlan = fullTimePlans.find(plan => plan.tokens === selectedFullTimePlan);

  const checkUserForSubscription = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to subscribe to a plan.",
          variant: "destructive"
        });
        navigate('/auth');
        return false;
      }

      if (!user.email) {
        toast({
          title: "Email Required",
          description: "Please complete your registration with a valid email address to subscribe.",
          variant: "destructive"
        });
        navigate('/auth');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking user authentication:', error);
      toast({
        title: "Authentication Error",
        description: "Please sign in again to continue.",
        variant: "destructive"
      });
      navigate('/auth');
      return false;
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out.",
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleUpdateProfile = async (field: string, value: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: value })
        .eq('id', user.id);

      if (error) throw error;

      await refetch();
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleForceNewWorksheet = () => {
    sessionStorage.setItem('forceNewWorksheet', 'true');
    navigate('/');
  };

  // NEW: Handle downgrade confirmation
  const handleDowngradeConfirm = async () => {
    if (!pendingDowngrade) return;
    
    setIsLoading(pendingDowngrade.planType);
    try {
      const { planType, targetPlan } = pendingDowngrade;
      
      devLog('Attempting downgrade:', { planType, targetPlan });

      const { data, error } = await supabase.functions.invoke('downgrade-subscription', {
        body: {
          planType: planType,
          monthlyLimit: targetPlan.tokens || targetPlan.monthlyLimit,
          price: targetPlan.price,
          planName: targetPlan.name
        }
      });

      if (error) {
        console.error('Downgrade error details:', error);
        throw error;
      }

      if (data?.success) {
        devLog('Downgrade successful:', data);
        toast({
          title: "Plan Changed Successfully!",
          description: `Your subscription has been changed to ${data.newPlan}. The change is effective immediately.`,
        });

        // Refresh profile data
        await supabase.functions.invoke('check-subscription-status');
        await refetch();
      } else {
        throw new Error(data?.error || 'Downgrade failed');
      }
    } catch (error: any) {
      console.error('Downgrade error:', error);
      toast({
        title: "Plan Change Error",
        description: error.message || "Failed to change plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(null);
      setShowDowngradeDialog(false);
      setPendingDowngrade(null);
    }
  };

  const handleSubscribe = async (planType: 'side-gig' | 'full-time') => {
    // Check user authentication first
    const canSubscribe = await checkUserForSubscription();
    if (!canSubscribe) return;

    setIsLoading(planType);
    try {
      const planData = planType === 'side-gig' 
        ? { name: 'Side-Gig Plan', price: 9, tokens: 15 }
        : { name: `Full-Time Plan (${selectedFullTimePlan} worksheets)`, price: selectedPlan?.price || 19, tokens: parseInt(selectedFullTimePlan) };

      // Find the target plan from plans array
      const targetPlan = planType === 'side-gig' 
        ? plans.find(p => p.id === 'side-gig')
        : plans.find(p => p.tokens === parseInt(selectedFullTimePlan) && p.type === 'full-time');

      if (!targetPlan) {
        throw new Error('Target plan not found');
      }

      // Calculate upgrade pricing
      const upgradePrice = getUpgradePrice(targetPlan);
      const upgradeTokens = getUpgradeTokens(targetPlan);

      devLog('Attempting to create subscription:', { planType, planData, upgradePrice, upgradeTokens });

      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: {
          planType: planType,
          monthlyLimit: planData.tokens,
          price: upgradePrice, // Use upgrade price instead of full price
          planName: planData.name,
          upgradeTokens: upgradeTokens, // Pass upgrade tokens
          isUpgrade: currentPlan.type !== 'free'
        }
      });

      if (error) {
        console.error('Subscription error details:', error);
        
        // Handle specific error types
        if (error.message?.includes('requiresRegistration') || error.message?.includes('Email required')) {
          toast({
            title: "Registration Required",
            description: "Please complete your registration with a valid email address to subscribe.",
            variant: "destructive"
          });
          navigate('/auth');
          return;
        }
        
        if (error.message?.includes('Authentication')) {
          toast({
            title: "Authentication Required",
            description: "Please sign in to subscribe to a plan.",
            variant: "destructive"
          });
          navigate('/auth');
          return;
        }

        throw error;
      }

      // Handle redirect to Customer Portal for existing customers
      if (data?.redirect_to_portal && data?.url) {
        devLog('Redirecting to Stripe Customer Portal for upgrade:', data.url);
        window.open(data.url, '_blank');
        return;
      }

      if (data?.url) {
        devLog('Redirecting to Stripe checkout:', data.url);
        // Redirect to Stripe checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received from server');
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      
      let errorMessage = "Failed to create subscription. Please try again.";
      let shouldRedirectToAuth = false;

      if (error.message?.includes('Authentication') || error.message?.includes('sign in')) {
        errorMessage = "Please sign in to subscribe to a plan.";
        shouldRedirectToAuth = true;
      } else if (error.message?.includes('Email required') || error.message?.includes('registration')) {
        errorMessage = "Please complete your registration with a valid email address.";
        shouldRedirectToAuth = true;
      } else if (error.message?.includes('Payment service not configured')) {
        errorMessage = "Payment service is currently unavailable. Please contact support.";
      }

      toast({
        title: "Subscription Error",
        description: errorMessage,
        variant: "destructive"
      });

      if (shouldRedirectToAuth) {
        navigate('/auth');
      }
    } finally {
      setIsLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    // Check user authentication first
    const canManage = await checkUserForSubscription();
    if (!canManage) return;

    try {
      devLog('Attempting to open customer portal...');
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) {
        console.error('Portal error details:', error);
        throw error;
      }

      if (data?.url) {
        devLog('Opening customer portal:', data.url);
        window.open(data.url, '_blank');
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      toast({
        title: "Error",
        description: "Failed to open subscription management. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getRenewalInfo = () => {
    let expiryDate = profile?.subscription_expires_at;
    
    if (!expiryDate && subscriptionData?.current_period_end) {
      expiryDate = subscriptionData.current_period_end;
      devLog('Using fallback expiry date from subscriptions table:', expiryDate);
    }
    
    if (!expiryDate) {
      devLog('No expiry date available from profile or subscriptions table');
      return null;
    }
    
    const currentStatus = profile?.subscription_status || subscriptionData?.subscription_status;
    const subscriptionType = profile?.subscription_type || 'Free Demo';
    
    if (subscriptionType === 'Free Demo' || subscriptionType === 'Inactive') return null;
    
    try {
      const renewalDate = new Date(expiryDate);
      return renewalDate.toLocaleDateString();
    } catch (error) {
      console.error('Error parsing subscription expiry date:', error);
      return null;
    }
  };

  const getSubscriptionLabel = () => {
    const currentStatus = profile?.subscription_status || subscriptionData?.subscription_status;
    const subscriptionType = profile?.subscription_type || 'Free Demo';
    
    if (!currentStatus) return null;
    if (subscriptionType === 'Free Demo' || subscriptionType === 'Inactive') return null;
    
    if (currentStatus === 'active_cancelled') {
      return 'Expires';
    } else if (currentStatus === 'active') {
      return 'Renews';
    }
    return null;
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isRegisteredUser) {
    return null;
  }

  const displayName = profile?.first_name || 'Teacher';
  const subscriptionType = profile?.subscription_type || 'Free Demo';
  const monthlyLimit = profile?.monthly_worksheet_limit;

  const availableTokens = profile?.available_tokens || 0;
  const rolloverTokens = profile?.rollover_tokens || 0;
  const totalWorksheetsCreated = profile?.total_worksheets_created || 0;
  
  const tokensAvailableForUse = profile?.is_tokens_frozen ? 0 : availableTokens;

  const renewalInfo = getRenewalInfo();
  const subscriptionLabel = getSubscriptionLabel();

  const sideGigPlan = plans.find(p => p.id === 'side-gig');
  const canUpgradeToSideGig = sideGigPlan ? canUpgradeTo(sideGigPlan) : false;
  const sideGigUpgradePrice = sideGigPlan ? getUpgradePrice(sideGigPlan) : 0;
  const isSideGigLowerPlan = currentPlan.type === 'full-time' && !!sideGigPlan;

  const fullTimePlan = plans.find(p => p.tokens === parseInt(selectedFullTimePlan) && p.type === 'full-time');
  const canUpgradeToFullTime = fullTimePlan ? canUpgradeTo(fullTimePlan) : false;
  const fullTimeUpgradePrice = fullTimePlan ? getUpgradePrice(fullTimePlan) : 0;

  // NEW: Determine if it's a downgrade action
  const isFullTimeDowngrade = fullTimePlan && currentPlan.type === 'full-time' && fullTimePlan.tokens < currentPlan.tokens;

  // UPDATED: Button text now shows "Lower Plan" instead of "Downgrade to..."
  const getSideGigButtonText = () => {
    if (isSideGigLowerPlan) return 'Lower Plan';
    if (!canUpgradeToSideGig) return 'Current Plan';
    return currentPlan.type === 'free' ? 'Upgrade to Side-Gig' : 'Upgrade to Side-Gig';
  };

  const getFullTimeButtonText = () => {
    if (isFullTimeDowngrade) return 'Lower Plan';
    if (!canUpgradeToFullTime) return 'Current Plan';
    return currentPlan.type === 'free' ? 'Upgrade to Full-Time' : 'Upgrade to Full-Time';
  };

  const getSideGigButtonStyle = () => {
    if (isSideGigLowerPlan) return 'bg-black text-white hover:bg-black/90';
    return '';
  };

  const getFullTimeButtonStyle = () => {
    if (isFullTimeDowngrade) return 'bg-black text-white hover:bg-black/90';
    return 'bg-primary hover:bg-primary/90';
  };

  // UPDATED: Handle downgrade actions with confirmation dialog
  const handleSideGigAction = () => {
    if (isSideGigLowerPlan) {
      // Show downgrade confirmation dialog
      setPendingDowngrade({
        planType: 'side-gig',
        targetPlan: { ...sideGigPlan, tokens: 15, monthlyLimit: 15 }
      });
      setShowDowngradeDialog(true);
    } else {
      // Upgrade action - use existing subscription flow
      handleSubscribe('side-gig');
    }
  };

  const handleFullTimeAction = () => {
    if (isFullTimeDowngrade) {
      // Show downgrade confirmation dialog
      setPendingDowngrade({
        planType: 'full-time',
        targetPlan: { ...fullTimePlan, tokens: parseInt(selectedFullTimePlan), monthlyLimit: parseInt(selectedFullTimePlan) }
      });
      setShowDowngradeDialog(true);
    } else {
      // Upgrade action - use existing subscription flow
      handleSubscribe('full-time');
    }
  };

  return (
    <AuthenticatedPageShell>
      <FreeWeekBanner />
      <StickyNav isRegisteredUser={true} tokenLeft={tokensAvailableForUse} user={user} />

      <div className="p-4">
        <div className="max-w-7xl mx-auto">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
                <CardDescription>Your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <EditableProfileField
                    label="First Name"
                    value={profile?.first_name}
                    placeholder="Not set"
                    onSave={(value) => handleUpdateProfile('first_name', value)}
                  />
                  <EditableProfileField
                    label="Last Name"
                    value={profile?.last_name}
                    placeholder="Not set"
                    onSave={(value) => handleUpdateProfile('last_name', value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-base flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4" />
                    {user?.email || profile?.email || 'Not available'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your email address associated with your account.
                  </p>
                </div>
                <EditableProfileField
                  label="School/Institution"
                  value={profile?.school_institution}
                  placeholder="Not set"
                  onSave={(value) => handleUpdateProfile('school_institution', value)}
                />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Member Since</label>
                  <p className="text-base flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4" />
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <Link 
                    to="/?forceNew=true"
                    className="w-full inline-flex items-center justify-center h-9 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    Generate Worksheet
                  </Link>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    size="sm"
                  >
                    <GraduationCap className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={async () => {
                      await resetOnboarding();
                      toast({
                        title: "Onboarding Reset",
                        description: "The onboarding checklist will appear again when you visit the dashboard.",
                      });
                      // v6.9.34 — navigate to dashboard so user immediately
                      // sees the freshly-reset checklist.
                      navigate('/dashboard');
                    }}
                    size="sm"
                  >
                    Reset Onboarding
                  </Button>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={handleSignOut}
                    size="sm"
                  >
                    Sign Out
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Coins className="h-5 w-5" />
                    Token Usage Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Token Left</span>
                      <span className="font-medium">{availableTokens}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Available tokens</span>
                      <span className="font-medium">{tokensAvailableForUse}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rollover tokens</span>
                      <span className="font-medium">{rolloverTokens}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Worksheets created</span>
                      <span className="font-medium">{totalWorksheetsCreated}</span>
                    </div>
                    {profile?.is_tokens_frozen && (
                      <div className="text-xs text-destructive mt-2 p-2 bg-destructive/10 rounded">
                        ⚠️ Tokens are frozen - subscription required to use
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Plan & Billing
                </CardTitle>
                <CardDescription>Manage your subscription plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Current Plan</span>
                  <Badge variant="outline" className="font-semibold text-base px-3 py-1">
                    {subscriptionType}
                  </Badge>
                </div>
                
                {renewalInfo && subscriptionLabel && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{subscriptionLabel}</span>
                    <span className="text-sm font-medium">{renewalInfo}</span>
                  </div>
                )}
                
                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    size="sm" 
                    onClick={handleManageSubscription}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Manage Plan
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-secondary/50 p-4 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-primary" />
                      <div>
                        <h4 className="font-semibold text-sm">Side-Gig Plan</h4>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">15 worksheets/month</p>
                    <div className="mb-3">
                      <p className="text-2xl font-bold">$9</p>
                      <p className="text-xs text-muted-foreground">/month</p>
                      <p className="text-xs text-muted-foreground">$0.60 per worksheet</p>
                      {canUpgradeToSideGig && currentPlan.type !== 'free' && (
                        <p className="text-xs text-muted-foreground">
                          Upgrade now for ${sideGigUpgradePrice}
                        </p>
                      )}
                    </div>
                    <Button 
                      className={`w-full ${getSideGigButtonStyle()}`}
                      size="sm"
                      onClick={handleSideGigAction}
                      disabled={isLoading === 'side-gig' || (!isSideGigLowerPlan && !canUpgradeToSideGig)}
                    >
                      {isLoading === 'side-gig' ? 'Processing...' : getSideGigButtonText()}
                    </Button>
                  </div>

                  <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-primary" />
                      <div>
                        <h4 className="font-semibold text-sm">Full-Time Plan</h4>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Choose worksheets/month</p>
                    
                    <div className="mb-3">
                      <Select value={selectedFullTimePlan} onValueChange={handleFullTimePlanChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fullTimePlans.map((plan) => (
                            <SelectItem key={plan.tokens} value={plan.tokens}>
                              {plan.tokens} worksheets/month
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-2xl font-bold">
                        ${selectedPlan?.price}
                      </p>
                      <p className="text-xs text-muted-foreground">/month</p>
                      <p className="text-xs text-muted-foreground">
                        ${((selectedPlan?.price || 19) / parseInt(selectedFullTimePlan)).toFixed(2)} per worksheet
                      </p>
                      {canUpgradeToFullTime && currentPlan.type !== 'free' && !isFullTimeDowngrade && (
                        <p className="text-xs text-muted-foreground">
                          Upgrade now for ${fullTimeUpgradePrice}
                        </p>
                      )}
                    </div>
                    
                    <Button 
                      className={`w-full ${getFullTimeButtonStyle()}`}
                      size="sm"
                      onClick={handleFullTimeAction}
                      disabled={isLoading === 'full-time' || (!isFullTimeDowngrade && !canUpgradeToFullTime)}
                    >
                      {isLoading === 'full-time' ? 'Processing...' : getFullTimeButtonText()}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* NEW: Downgrade confirmation dialog */}
      <ConfirmDowngradeDialog
        open={showDowngradeDialog}
        onOpenChange={setShowDowngradeDialog}
        currentPlan={currentPlan.name}
        targetPlan={pendingDowngrade?.targetPlan?.name || ''}
        onConfirm={handleDowngradeConfirm}
        isLoading={isLoading !== null}
      />
      </div>
    </AuthenticatedPageShell>
  );
};

export default Profile;
