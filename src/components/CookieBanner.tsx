/**
 * CookieBanner v6.9.4 — Always-visible pill, scroll-triggered expand.
 *
 * Behavior:
 *  - On mount: if no prior consent, render the floating pill IMMEDIATELY
 *    (cookie icon, 48x48, bottom-right, above safe-area inset).
 *  - First scroll ≥ 100px → auto-expand into the full consent card (once
 *    per session — gated by sessionStorage('edooqoo.cookie.autoExpanded')).
 *  - Tapping the pill → manually expand the card.
 *  - Choice (Accept / Decline) → persisted in localStorage('cookie-consent')
 *    and the whole banner is removed.
 *  - Dismiss (X) on expanded card → collapses back to pill (no persistence).
 *
 * Why pill is always visible (was: only after scroll in v6.9.2):
 *  Visibility on first paint is required for GDPR transparency, but the
 *  small pill never occludes the hero worksheet form. Auto-expand on first
 *  scroll mirrors user "engagement" intent without blocking the CTA at
 *  page load.
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Cookie, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const SCROLL_TRIGGER_PX = 100;
const SS_AUTO_EXPANDED = 'edooqoo.cookie.autoExpanded';

const CookieBanner = () => {
  // Pill is visible immediately on mount unless the user already chose.
  const [shouldRender, setShouldRender] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('cookie-consent');
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!shouldRender) return;
    // Skip auto-expand if user already triggered/dismissed it this session.
    if (sessionStorage.getItem(SS_AUTO_EXPANDED)) return;

    const onScroll = () => {
      if (window.scrollY >= SCROLL_TRIGGER_PX) {
        try { sessionStorage.setItem(SS_AUTO_EXPANDED, '1'); } catch { /* ignore */ }
        setExpanded(true);
        window.removeEventListener('scroll', onScroll);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Cover the case where the browser restored a scrolled position before mount.
    const idle = window.setTimeout(onScroll, 500);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(idle);
    };
  }, [shouldRender]);

  const handleAccept = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShouldRender(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie-consent', 'declined');
    setShouldRender(false);
  };

  const handleDismiss = () => {
    // Collapse expanded card back to pill. Mark as auto-expanded so we don't
    // re-trigger on subsequent scroll. User keeps a one-tap path back to consent.
    try { sessionStorage.setItem(SS_AUTO_EXPANDED, '1'); } catch { /* ignore */ }
    setExpanded(false);
  };

  if (!shouldRender) return null;

  // Collapsed: small floating pill with cookie icon.
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          try { sessionStorage.setItem(SS_AUTO_EXPANDED, '1'); } catch { /* ignore */ }
          setExpanded(true);
        }}
        aria-label="Cookie preferences"
        aria-expanded="false"
        className={cn(
          'fixed z-50 right-4 bottom-4',
          'h-12 w-12 rounded-full',
          'bg-background/95 backdrop-blur-sm border-2 border-primary/30',
          'shadow-lg flex items-center justify-center',
          'hover:scale-105 hover:border-primary transition-all',
          'animate-in fade-in slide-in-from-bottom-4 duration-300',
        )}
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <Cookie className="h-5 w-5 text-primary" />
        <span className="sr-only">Open cookie preferences</span>
      </button>
    );
  }

  // Expanded: full consent card.
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <Card className="mx-auto max-w-4xl border-2 shadow-lg bg-background/95 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Cookie className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Cookies</p>
                <p className="text-muted-foreground">
                  We use cookies to improve your experience and for analysis. You can deactivate them anytime.
                  <Link to="/cookie-policy" className="text-primary hover:underline ml-1">
                    Learn more in our Cookie Policy
                  </Link>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button variant="outline" size="sm" onClick={handleDecline} className="text-xs">
                Decline
              </Button>
              <Button size="sm" onClick={handleAccept} className="text-xs">
                Accept
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="p-1 h-8 w-8"
                aria-label="Dismiss cookie banner"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CookieBanner;
