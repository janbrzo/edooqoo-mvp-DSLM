import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, User, GraduationCap, Zap, Users, Gift, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useTokenSystem } from '@/hooks/useTokenSystem';
import { usePlanLogic } from '@/hooks/usePlanLogic';
import { PricingCalculator, type OneMinutePrepCalculatorInput } from '@/components/PricingCalculator';
import { faqItems } from '@/constants/faqItems';

interface PricingSectionProps {
  calculatorValue?: OneMinutePrepCalculatorInput;
  onCalculatorChange?: (value: OneMinutePrepCalculatorInput) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ calculatorValue, onCalculatorChange }) => {
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  const { user, isRegisteredUser } = useAuthFlow();
  const { tokenLeft, profile } = useTokenSystem(user?.id);
  const { currentPlan, plans, canUpgradeTo, getUpgradePrice, getUpgradeTokens, getRecommendedFullTimePlan, getRecommendedPlanByLessons } = usePlanLogic(profile?.subscription_type);
  const [selectedFullTimePlan, setSelectedFullTimePlan] = useState(getRecommendedFullTimePlan());
  const [recommendedPlan, setRecommendedPlan] = useState<'side-gig' | 'full-time'>('side-gig');
  const [recommendedWorksheets, setRecommendedWorksheets] = useState(15);
  const [hasManuallyChanged, setHasManuallyChanged] = useState(false);
  const [lastInteraction, setLastInteraction] = useState<'calculator' | 'manual'>('calculator');
  const [openFaqItems, setOpenFaqItems] = useState<number[]>([]);

  // FAQ items are now imported from shared constants - same 21 questions as /pricing page

  const toggleFaqItem = (index: number) => {
    setOpenFaqItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const fullTimePlans = [
    { tokens: '30', price: 19 },
    { tokens: '60', price: 39 },
    { tokens: '90', price: 59 },
    { tokens: '120', price: 79 }
  ];

  const selectedPlan = fullTimePlans.find(plan => plan.tokens === selectedFullTimePlan);

  const handleRecommendation = (plan: 'side-gig' | 'full-time', worksheetsNeeded: number, lessonsPerWeek?: number) => {
    setRecommendedPlan(plan);
    setRecommendedWorksheets(worksheetsNeeded);
    setLastInteraction('calculator');
    
    // FIXED: Only update dropdown if user hasn't manually changed it
    if (plan === 'full-time' && lessonsPerWeek && !hasManuallyChanged) {
      const recommendedTokens = getRecommendedPlanByLessons(lessonsPerWeek);
      setSelectedFullTimePlan(recommendedTokens);
    }
  };

  const handleManualPlanChange = (value: string) => {
    setSelectedFullTimePlan(value);
    setHasManuallyChanged(true);
    setLastInteraction('manual');
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

  return (
    <div className="bg-gradient-to-br from-background to-secondary/20 p-4 mt-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
          <p className="text-muted-foreground">Estimate how 1-Minute Prep can affect recurring student prep and worksheet usage</p>
        </div>

        <PricingCalculator
          value={calculatorValue}
          onValueChange={onCalculatorChange}
          onRecommendation={handleRecommendation}
        />

        <div className="grid lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          
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
                  <span className="text-sm">2 free worksheets on signup</span>
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
                className="w-full h-10" 
                asChild
                disabled={isButtonDisabled('free')}
              >
                <Link to="/signup" state={fromState}>{getButtonText('free')}</Link>
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
                className="w-full h-10"
                asChild
                disabled={isButtonDisabled('side-gig')}
              >
                <Link to="/signup" state={fromState}>{getButtonText('side-gig')}</Link>
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
                  <SelectTrigger className="w-full" aria-label="Select monthly worksheet plan">
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
                className="w-full h-10 bg-primary hover:bg-primary/90"
                asChild
                disabled={isButtonDisabled('full-time')}
              >
                <Link to="/signup" state={fromState}>{getButtonText('full-time')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <Card className="max-w-4xl mx-auto mt-8">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {faqItems.map((item, index) => (
                <Collapsible key={index} className="border rounded-lg">
                  <CollapsibleTrigger
                    className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/50"
                    onClick={() => toggleFaqItem(index)}
                  >
                    <span className="font-medium text-sm">{item.question}</span>
                    {openFaqItems.includes(index) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 text-sm text-muted-foreground">
                    {item.answer}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
