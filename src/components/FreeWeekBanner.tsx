import React from 'react';
import { Gift, TreePine } from 'lucide-react';
import { 
  isFreeCustomDemoWeek, 
  getFreeWeekEndDateString, 
  getPromoName, 
  isPromoForLoggedInOnly 
} from '@/utils/promoUtils';

/**
 * FreeWeekBanner component displays a promotional banner during FREE WEEK promotions
 * Shows only when the promotion is active based on isFreeCustomDemoWeek()
 */
export const FreeWeekBanner: React.FC = () => {
  // Only show banner if FREE WEEK is currently active
  if (!isFreeCustomDemoWeek()) {
    return null;
  }

  const endDateString = getFreeWeekEndDateString();
  const promoName = getPromoName();
  const loggedInOnly = isPromoForLoggedInOnly();

  return (
    <div className="bg-green-500 text-white text-center py-2 px-4 text-sm font-medium">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <TreePine className="h-4 w-4" />
        <Gift className="h-4 w-4" />
        <span>🎄 {promoName} 🎁</span>
        <span className="hidden sm:inline">|</span>
        <span>⏰ Till: {endDateString} 23:59 UTC+0</span>
        {loggedInOnly && (
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs ml-1">
            Logged-in users only
          </span>
        )}
      </div>
    </div>
  );
};
