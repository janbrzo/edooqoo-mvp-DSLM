
import { useMemo } from 'react';

interface PlanConfig {
  id: string;
  name: string;
  type: 'free' | 'side-gig' | 'full-time';
  price: number;
  tokens: number;
  description: string;
}

const PLANS: PlanConfig[] = [
  { id: 'free', name: 'Free Demo', type: 'free', price: 0, tokens: 2, description: 'Try our worksheet generator' },
  { id: 'side-gig', name: 'Side-Gig Plan', type: 'side-gig', price: 9, tokens: 15, description: 'Perfect for part-time English teachers' },
  { id: 'full-time-30', name: 'Full-Time 30', type: 'full-time', price: 19, tokens: 30, description: 'For professional English teachers' },
  { id: 'full-time-60', name: 'Full-Time 60', type: 'full-time', price: 39, tokens: 60, description: 'For professional English teachers' },
  { id: 'full-time-90', name: 'Full-Time 90', type: 'full-time', price: 59, tokens: 90, description: 'For professional English teachers' },
  { id: 'full-time-120', name: 'Full-Time 120', type: 'full-time', price: 79, tokens: 120, description: 'For professional English teachers' },
];

export const usePlanLogic = (currentSubscriptionType?: string) => {
  const currentPlan = useMemo(() => {
    // NAPRAWIONE: Obsługa statusu "Inactive" po wygaśnięciu subskrypcji
    if (!currentSubscriptionType || currentSubscriptionType === 'Free Demo') {
      return PLANS[0]; // free plan
    }
    
    if (currentSubscriptionType === 'Inactive') {
      // Zwróć specjalny plan dla statusu "Inactive"
      return {
        id: 'inactive',
        name: 'Inactive',
        type: 'free' as const,
        price: 0,
        tokens: 0,
        description: 'Subscription expired'
      };
    }
    
    if (currentSubscriptionType === 'Side-Gig') {
      return PLANS[1]; // side-gig plan
    }
    
    // For Full-Time plans, extract the number
    const fullTimeMatch = currentSubscriptionType.match(/Full-Time (\d+)/);
    if (fullTimeMatch) {
      const tokens = parseInt(fullTimeMatch[1]);
      return PLANS.find(p => p.tokens === tokens && p.type === 'full-time') || PLANS[0];
    }
    
    return PLANS[0]; // fallback to free
  }, [currentSubscriptionType]);

  const getNextAvailablePlan = (planType: 'side-gig' | 'full-time') => {
    if (planType === 'side-gig') {
      return currentPlan.type === 'free' ? PLANS[1] : null;
    }
    
    if (planType === 'full-time') {
      if (currentPlan.type === 'free') {
        return PLANS[2]; // full-time-30
      }
      if (currentPlan.type === 'side-gig') {
        return PLANS[2]; // full-time-30
      }
      if (currentPlan.type === 'full-time') {
        // Find next higher full-time plan
        const currentIndex = PLANS.findIndex(p => p.id === currentPlan.id);
        return currentIndex < PLANS.length - 1 ? PLANS[currentIndex + 1] : null;
      }
    }
    
    return null;
  };

  const getUpgradePrice = (targetPlan: PlanConfig) => {
    if (currentPlan.type === 'free') {
      return targetPlan.price;
    }
    
    // For upgrades, calculate the difference
    return Math.max(0, targetPlan.price - currentPlan.price);
  };

  const getUpgradeTokens = (targetPlan: PlanConfig) => {
    if (currentPlan.type === 'free') {
      return targetPlan.tokens;
    }
    
    // For upgrades, calculate the difference in tokens
    return Math.max(0, targetPlan.tokens - currentPlan.tokens);
  };

  const canUpgradeTo = (targetPlan: PlanConfig) => {
    if (currentPlan.type === 'free') {
      return targetPlan.type !== 'free';
    }
    
    if (currentPlan.type === 'side-gig') {
      return targetPlan.type === 'full-time';
    }
    
    if (currentPlan.type === 'full-time' && targetPlan.type === 'full-time') {
      return targetPlan.tokens > currentPlan.tokens;
    }
    
    return false;
  };

  // NOWA FUNKCJA: Rekomenduje plan na podstawie liczby lekcji tygodniowo
  const getRecommendedPlanByLessons = (lessonsPerWeek: number) => {
    // Przelicz na miesiąc (4.3 tygodnia średnio w miesiącu)
    const lessonsPerMonth = Math.ceil(lessonsPerWeek * 4.3);
    
    if (lessonsPerMonth <= 15) {
      return '30'; // Side-gig lub minimum Full-Time
    } else if (lessonsPerMonth <= 30) {
      return '30';
    } else if (lessonsPerMonth <= 60) {
      return '60';
    } else if (lessonsPerMonth <= 90) {
      return '90';
    } else {
      return '120';
    }
  };

  const getRecommendedFullTimePlan = () => {
    if (currentPlan.type === 'free' || currentPlan.type === 'side-gig') {
      return '30';
    }
    
    if (currentPlan.type === 'full-time') {
      // FIXED: Recommend next higher plan, or current if it's the highest
      const nextPlan = getNextAvailablePlan('full-time');
      return nextPlan ? nextPlan.tokens.toString() : currentPlan.tokens.toString();
    }
    
    return '30';
  };

  return {
    currentPlan,
    plans: PLANS,
    getNextAvailablePlan,
    getUpgradePrice,
    getUpgradeTokens,
    canUpgradeTo,
    getRecommendedFullTimePlan,
    getRecommendedPlanByLessons, // NOWA FUNKCJA
  };
};
