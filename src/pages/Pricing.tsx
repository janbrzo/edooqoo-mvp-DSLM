import React, { useState, useEffect } from 'react';
import { AuthenticatedPageShell } from '@/components/AuthenticatedPageShell';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Zap, Users, Gift, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useTokenSystem } from '@/hooks/useTokenSystem';
import { usePlanLogic } from '@/hooks/usePlanLogic';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PricingCalculator } from '@/components/PricingCalculator';
import { ConfirmDowngradeDialog } from '@/components/ConfirmDowngradeDialog';
import { devLog } from '@/utils/logger';

import { faqItems } from '@/constants/faqItems';
import StickyNav from '@/components/landing/StickyNav';

const Pricing = () => {
  const { user, isRegisteredUser } = useAuthFlow();
  const { tokenLeft, profile } = useTokenSystem(user?.id);
  const { currentPlan, plans, canUpgradeTo, getUpgradePrice, getUpgradeTokens, getRecommendedFullTimePlan, getRecommendedPlanByLessons } = usePlanLogic(profile?.subscription_type);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedFullTimePlan, setSelectedFullTimePlan] = useState(getRecommendedFullTimePlan());
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [recommendedPlan, setRecommendedPlan] = useState<'side-gig' | 'full-time'>('side-gig');
  const [recommendedWorksheets, setRecommendedWorksheets] = useState(15);
  const [hasManuallyChanged, setHasManuallyChanged] = useState(false);
  const [lastInteraction, setLastInteraction] = useState<'calculator' | 'manual' | 'default'>('default');
  const [openFaqItems, setOpenFaqItems] = useState<number[]>([]);
  const [showEmailConfirmationModal, setShowEmailConfirmationModal] = useState(false);

  useEffect(() => {
    document.title = "Pricing — Edooqoo AI Worksheet Generator | Free, Side-Gig & Full-Time Plans";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Edooqoo pricing: Free (2 worksheets), Side-Gig $9/mo (15 worksheets + homework + flashcards), Full-Time from $19/mo (30-90 worksheets + all features). All plans include 29 exercise types for CEFR A1-C2.');
  }, []);

  // NEW: Downgrade dialog state
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [pendingDowngrade, setPendingDowngrade] = useState<{
    planType: 'side-gig' | 'full-time';
    targetPlan: any;
  } | null>(null);

  const fullTimePlans = [
    { tokens: '30', price: 19 },
    { tokens: '60', price: 39 },
    { tokens: '90', price: 59 },
    { tokens: '120', price: 79 }
  ];

  const selectedPlan = fullTimePlans.find(plan => plan.tokens === selectedFullTimePlan);

  useEffect(() => {
    // Only set default on initial load, not when user has manually changed or calculator updated
    if (lastInteraction === 'default') {
      setSelectedFullTimePlan(getRecommendedFullTimePlan());
    }
  }, [getRecommendedFullTimePlan, lastInteraction]);

  // Handle calculator recommendations with proper priority logic
  const handleRecommendation = (plan: 'side-gig' | 'full-time', worksheetsNeeded: number, lessonsPerWeek?: number) => {
    setRecommendedPlan(plan);
    setRecommendedWorksheets(worksheetsNeeded);
    
    // Only update dropdown if user hasn't manually overridden or if this is a new calculator interaction
    if (plan === 'full-time' && lessonsPerWeek && lastInteraction !== 'manual') {
      const recommendedTokens = getRecommendedPlanByLessons(lessonsPerWeek);
      if (recommendedTokens !== selectedFullTimePlan) {
        setSelectedFullTimePlan(recommendedTokens);
        setLastInteraction('calculator');
        setHasManuallyChanged(false);
      }
    }
  };

  const handleManualPlanChange = (value: string) => {
    setSelectedFullTimePlan(value);
    setHasManuallyChanged(true);
    setLastInteraction('manual');
  };

  // FAQ items are now imported from shared constants

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
        // Note: no refetch here since this is pricing page, profile will refresh when user navigates
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
    if (!isRegisteredUser) {
      toast({
        title: "Registration Required",
        description: "Please sign up to subscribe to a plan.",
        variant: "destructive"
      });
      navigate('/signup');
      return;
    }

    setIsLoading(planType);
    try {
      const planData = planType === 'side-gig' 
        ? { name: 'Side-Gig Plan', price: 9, tokens: 15 }
        : { name: `Full-Time Plan (${selectedFullTimePlan} worksheets)`, price: selectedPlan?.price || 19, tokens: parseInt(selectedFullTimePlan) };

      const targetPlan = planType === 'side-gig' 
        ? plans.find(p => p.id === 'side-gig')
        : plans.find(p => p.tokens === parseInt(selectedFullTimePlan) && p.type === 'full-time');

      if (!targetPlan) {
        throw new Error('Target plan not found');
      }

      const upgradePrice = getUpgradePrice(targetPlan);
      const upgradeTokens = getUpgradeTokens(targetPlan);

      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: {
          planType: planType,
          monthlyLimit: planData.tokens,
          price: upgradePrice,
          planName: planData.name,
          upgradeTokens: upgradeTokens,
          isUpgrade: currentPlan.type !== 'free'
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast({
        title: "Subscription Error",
        description: error.message || "Failed to create subscription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!isRegisteredUser) {
      toast({
        title: "Registration Required",
        description: "Please sign up to manage subscriptions.",
        variant: "destructive"
      });
      navigate('/signup');
      return;
    }

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

  const toggleFaqItem = (index: number) => {
    setOpenFaqItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const sideGigPlan = plans.find(p => p.id === 'side-gig');
  const canUpgradeToSideGig = sideGigPlan ? canUpgradeTo(sideGigPlan) : false;
  const sideGigUpgradePrice = sideGigPlan ? getUpgradePrice(sideGigPlan) : 0;
  const isSideGigLowerPlan = currentPlan.type === 'full-time' && !!sideGigPlan;

  const fullTimePlan = plans.find(p => p.tokens === parseInt(selectedFullTimePlan) && p.type === 'full-time');
  const canUpgradeToFullTime = fullTimePlan ? canUpgradeTo(fullTimePlan) : false;
  const fullTimeUpgradePrice = fullTimePlan ? getUpgradePrice(fullTimePlan) : 0;

  const isFullTimeDowngrade = fullTimePlan && currentPlan.type === 'full-time' && fullTimePlan.tokens < currentPlan.tokens;

  const getButtonText = (planType: 'free' | 'side-gig' | 'full-time') => {
    if (planType === 'free') {
      if (!isRegisteredUser) return 'Get Started Free';
      return currentPlan.type === 'free' ? 'Current Plan' : 'Get Started Free';
    }
    
    if (planType === 'side-gig') {
      if (isSideGigLowerPlan) return 'Lower Plan';
      if (!canUpgradeToSideGig) return 'Current Plan';
      return currentPlan.type === 'free' ? 'Choose Side-Gig' : 'Upgrade to Side-Gig';
    }
    
    if (planType === 'full-time') {
      if (isFullTimeDowngrade) return 'Lower Plan';
      if (!canUpgradeToFullTime) return 'Current Plan';
      return currentPlan.type === 'free' ? 'Choose Full-Time' : 'Upgrade to Full-Time';
    }
    
    return 'Choose Plan';
  };

  const isButtonDisabled = (planType: 'free' | 'side-gig' | 'full-time') => {
    if (planType === 'free') {
      if (!isRegisteredUser) return false;
      return currentPlan.type !== 'free';
    }
    
    if (planType === 'side-gig') {
      return !isSideGigLowerPlan && !canUpgradeToSideGig;
    }
    
    if (planType === 'full-time') {
      return !isFullTimeDowngrade && !canUpgradeToFullTime;
    }
    
    return false;
  };

  const getButtonStyle = (planType: 'side-gig' | 'full-time') => {
    if (planType === 'side-gig' && isSideGigLowerPlan) {
      return 'bg-black text-white hover:bg-black/90';
    }
    if (planType === 'full-time' && isFullTimeDowngrade) {
      return 'bg-black text-white hover:bg-black/90';
    }
    return planType === 'full-time' ? 'bg-primary hover:bg-primary/90' : '';
  };

  const handleSideGigAction = () => {
    if (isSideGigLowerPlan) {
      setPendingDowngrade({
        planType: 'side-gig',
        targetPlan: { ...sideGigPlan, tokens: 15, monthlyLimit: 15 }
      });
      setShowDowngradeDialog(true);
    } else {
      handleSubscribe('side-gig');
    }
  };

  const handleFullTimeAction = () => {
    if (isFullTimeDowngrade) {
      setPendingDowngrade({
        planType: 'full-time',
        targetPlan: { ...fullTimePlan, tokens: parseInt(selectedFullTimePlan), monthlyLimit: parseInt(selectedFullTimePlan) }
      });
      setShowDowngradeDialog(true);
    } else {
      handleSubscribe('full-time');
    }
  };

  const handleFreeSignup = () => {
    if (!isRegisteredUser) {
      setShowEmailConfirmationModal(true);
      navigate('/signup');
    }
  };

  const Wrapper = isRegisteredUser 
    ? AuthenticatedPageShell 
    : ({ children }: { children: React.ReactNode }) => <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">{children}</div>;

  return (
    <Wrapper>
      <StickyNav isRegisteredUser={!!isRegisteredUser} tokenLeft={tokenLeft} user={user} />
      <div className="max-w-6xl mx-auto p-4">

        <PricingCalculator onRecommendation={handleRecommendation} />

        <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          
          <Card className="relative">
            <CardHeader className="text-center pb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Gift className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">Free Demo</CardTitle>
              </div>
              <CardDescription className="text-base">
                Start teaching smarter today
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-lg text-muted-foreground">/forever</span>
              </div>
              <div className="mt-2">
                <Badge variant="secondary">2 free worksheets to start</Badge>
              </div>
              <div className="mt-1">
                <p className="text-xs text-muted-foreground">Free per worksheet</p>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">2 free tokens on signup</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Student management</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Duplicate Worksheet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Share Interactive Worksheet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Flashcards auto-synced</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Draw on Worksheet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Live Session mode</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Homework Assignments</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Student Knowledge tracking</span>
                </div>
              </div>
              
              <Button 
                className="w-full h-10" 
                onClick={handleFreeSignup}
                disabled={isButtonDisabled('free')}
              >
                {getButtonText('free')}
              </Button>
            </CardContent>
          </Card>

          <Card className={`relative ${recommendedPlan === 'side-gig' ? 'border-primary shadow-lg' : ''}`}>
            {recommendedPlan === 'side-gig' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold whitespace-nowrap">
                  RECOMMENDED FOR YOU
                </Badge>
              </div>
            )}
            
            <CardHeader className="text-center pb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">Side-Gig Plan</CardTitle>
              </div>
              <CardDescription className="text-base">
                Perfect for part-time English teachers
              </CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">$9</span>
                <span className="text-lg text-muted-foreground">/month</span>
              </div>
              <div className="mt-2">
                <Badge variant="secondary">15 worksheets / month</Badge>
                {currentPlan.type !== 'free' && canUpgradeToSideGig && !isSideGigLowerPlan && (
                  <Badge variant="outline" className="mt-1">
                    Upgrade now for ${sideGigUpgradePrice}
                  </Badge>
                )}
              </div>
              <div className="mt-1">
                <p className="text-xs text-muted-foreground">$0.60 per worksheet</p>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">15 monthly worksheet credits</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Unused worksheets carry forward</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Student management</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Duplicate Worksheet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Share Interactive Worksheet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Live Session mode</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Flashcards auto-synced</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Draw on Worksheet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Homework Assignments</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Student Knowledge tracking</span>
                </div>
              </div>
              
              <Button 
                className={`w-full h-10 ${getButtonStyle('side-gig')}`}
                onClick={handleSideGigAction}
                disabled={isLoading === 'side-gig' || isButtonDisabled('side-gig')}
              >
                {isLoading === 'side-gig' ? 'Processing...' : getButtonText('side-gig')}
              </Button>
            </CardContent>
          </Card>

          <Card className={`relative ${recommendedPlan === 'full-time' ? 'border-primary shadow-lg' : ''}`}>
            {recommendedPlan === 'full-time' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold whitespace-nowrap">
                  RECOMMENDED FOR YOU
                </Badge>
              </div>
            )}
            
            <CardHeader className="text-center pb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl">Full-Time Plan</CardTitle>
              </div>
              <CardDescription className="text-base">
                For professional English teachers
              </CardDescription>
              
              <div className="mt-4 space-y-3">
                <Select value={selectedFullTimePlan} onValueChange={handleManualPlanChange}>
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
                
                <div className="text-center">
                  <span className="text-4xl font-bold">
                    ${selectedPlan?.price}
                  </span>
                  <span className="text-lg text-muted-foreground">/month</span>
                </div>
                <div>
                  <Badge variant="secondary">{selectedFullTimePlan} worksheets / month</Badge>
                  {currentPlan.type !== 'free' && canUpgradeToFullTime && !isFullTimeDowngrade && (
                    <Badge variant="outline" className="mt-1">
                      Upgrade now for ${fullTimeUpgradePrice}
                    </Badge>
                  )}
                </div>
                <div className="mt-1">
                  <p className="text-xs text-muted-foreground">
                    ${((selectedPlan?.price || 19) / parseInt(selectedFullTimePlan)).toFixed(2)} per worksheet
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{selectedFullTimePlan} monthly worksheet credits</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Unused worksheets carry forward</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Student management</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Duplicate Worksheet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Share Interactive Worksheet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Live Session mode</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Flashcards auto-synced</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Draw on Worksheet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Homework Assignments</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Student Knowledge tracking</span>
                </div>
              </div>
              
              <Button 
                className={`w-full h-10 ${getButtonStyle('full-time')}`}
                onClick={handleFullTimeAction}
                disabled={isLoading === 'full-time' || isButtonDisabled('full-time')}
              >
                {isLoading === 'full-time' ? 'Processing...' : getButtonText('full-time')}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Frequently Asked Questions</CardTitle>
            <CardDescription>
              Everything you need to know about our worksheet generator
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <Collapsible key={index} className="border rounded-lg">
                  <CollapsibleTrigger
                    className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50"
                    onClick={() => toggleFaqItem(index)}
                  >
                    <span className="font-medium">{item.question}</span>
                    {openFaqItems.includes(index) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4 text-muted-foreground">
                    {item.answer}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog open={showEmailConfirmationModal} onOpenChange={setShowEmailConfirmationModal}>
          <DialogContent className="max-w-md">
            <DialogHeader className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-primary" />
              <DialogTitle>Check Your Email</DialogTitle>
              <DialogDescription>
                We've sent you a confirmation email. Please click the link in your email to verify your account and complete your registration.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Important:</strong> You need to confirm your email address to access all features and start using your free tokens.
                </p>
              </div>
              <Button 
                className="w-full" 
                onClick={() => setShowEmailConfirmationModal(false)}
              >
                Got it, I'll check my email
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDowngradeDialog
          open={showDowngradeDialog}
          onOpenChange={setShowDowngradeDialog}
          currentPlan={currentPlan.name}
          targetPlan={pendingDowngrade?.targetPlan?.name || ''}
          onConfirm={handleDowngradeConfirm}
          isLoading={isLoading !== null}
        />
      </div>
    </Wrapper>
  );
};

export default Pricing;
