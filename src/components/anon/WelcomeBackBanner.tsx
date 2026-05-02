import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'welcomeBackBannerDismissedAt';
const DISMISS_VALID_DAYS = 7;
const AUTO_HIDE_MS = 8000;

/**
 * Discrete top slide-down banner replacing the previous full-screen
 * WelcomeBackModal. Shows for returning anonymous users (>1h since last
 * visit, has previously generated). Auto-hides after 8s. Dismiss persists
 * in localStorage for 7 days.
 */
interface WelcomeBackBannerProps {
  shouldShow: boolean;
}

export const WelcomeBackBanner: React.FC<WelcomeBackBannerProps> = ({ shouldShow }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldShow) return;
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const days = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_VALID_DAYS) return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [shouldShow]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="sticky top-0 z-40 w-full bg-gradient-to-r from-primary/10 via-secondary/40 to-primary/10 border-b border-border animate-in slide-in-from-top-2 duration-300">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="font-medium">Welcome back!</span>
          <span className="text-muted-foreground hidden sm:inline">
            Log in to access your previous worksheets and continue your work.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="h-8 px-3 text-xs rounded-full">
            <Link to="/signup" onClick={handleDismiss}>
              Create Free Account
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-8 px-3 text-xs">
            <Link to="/login" onClick={handleDismiss}>
              Log in
            </Link>
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBackBanner;