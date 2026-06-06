import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { GCalStatusButton } from '@/components/calendar/GCalStatusButton';
import { PacingProposalsBell } from '@/components/dslm/PacingProposalsBell';
import { UnifiedBell } from '@/components/notifications/UnifiedBell';
import { Menu, GraduationCap, User, Plus, Eye } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDemoContext } from '@/contexts/DemoContext';
import FeatureNavPills from '@/components/landing/FeatureNavPills';
import { NavStudentSwitcher } from '@/components/landing/NavStudentSwitcher';

interface StickyNavProps {
  isRegisteredUser: boolean;
  tokenLeft: number;
  user: any;
  scrollToPricing?: () => void;
  subscriptionType?: string;
  onGenerateWorksheet?: () => void;
  leftContent?: React.ReactNode;
  /**
   * When true, render the nav with relative positioning instead of sticky.
   * Used on anon worksheet pages so the nav scrolls away with the worksheet
   * content instead of overlaying it.
   */
  nonSticky?: boolean;
}

const StickyNav: React.FC<StickyNavProps> = ({ isRegisteredUser, tokenLeft, user, scrollToPricing, subscriptionType, onGenerateWorksheet, leftContent, nonSticky = false }) => {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isProfile = location.pathname === '/profile';
  const isCalendar = location.pathname === '/calendar';
  const isStudentPage = /^\/student\//.test(location.pathname);
  // v6.9.33 — show NavStudentSwitcher on every authenticated page except
  // dashboard / profile (incl. /student/:id where it replaces the local popover).
  const showStudentSwitcher = isRegisteredUser && !isDashboard && !isProfile;
  const { isDemoMode, exitDemo } = useDemoContext();

  // Position class for ANON nav (non-sticky on worksheet pages, sticky elsewhere)
  const anonNavPosClass = nonSticky
    ? 'relative w-full bg-background/95 backdrop-blur-md border-b border-border'
    : 'sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border';

  // State carried into auth pages so closing the modal returns the user to
  // the worksheet they came from.
  const fromState = { from: location.pathname + location.search };

  const DemoBanner = () => isDemoMode ? (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-400 text-amber-900 text-center text-sm font-medium py-1.5 flex items-center justify-center gap-3">
      <Eye className="h-4 w-4" />
      <span>DEMO MODE — Explore freely!</span>
      <Button size="sm" variant="outline" className="h-6 text-xs bg-white/80 border-amber-600 text-amber-900 hover:bg-white" onClick={() => navigate('/signup', { state: fromState })}>
        Sign Up Free →
      </Button>
      <Button size="sm" variant="outline" className="h-6 text-xs bg-red-100 border-red-400 text-red-800 hover:bg-red-200" onClick={() => { exitDemo(); }}>
        ✕ Exit Demo
      </Button>
    </div>
  ) : null;

  const handleLogoClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname !== '/') return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const Logo = () => (
    <Link
      to="/"
      onClick={handleLogoClick}
      className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent"
    >
      edooqoo
    </Link>
  );

  if (isRegisteredUser) {
    if (isMobile) {
      return (
        <>
        <DemoBanner />
        <nav className={`sticky ${isDemoMode ? 'top-[36px]' : 'top-0'} z-50 bg-background/90 backdrop-blur-md border-b border-border h-14 px-4 flex items-center justify-between`}>
          <div className="flex items-center gap-2 min-w-0">
            <Logo />
            {showStudentSwitcher && <NavStudentSwitcher />}
            {leftContent}
          </div>
          <div className="flex items-center gap-2">
            {onGenerateWorksheet && isDashboard && (
              <Button size="sm" onClick={onGenerateWorksheet} className="h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Generate
              </Button>
            )}
            {onGenerateWorksheet && !isDashboard && (
              <Button asChild size="sm" className="h-8 text-xs">
                <a
                  href="/"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                    e.preventDefault();
                    onGenerateWorksheet();
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Generate
                </a>
              </Button>
            )}
            {subscriptionType && (
              <Badge variant="secondary" className="text-xs shrink-0">{subscriptionType}</Badge>
            )}
            <Badge variant="outline" className="text-xs">
              Tokens: {tokenLeft}
            </Badge>
            <UnifiedBell />
            <PacingProposalsBell />
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 focus-visible:ring-2 focus-visible:ring-offset-2" aria-label="Open navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <div className="flex flex-col gap-3 pt-8">
                  {!isDashboard && (
                    <Button asChild variant="outline" size="sm" onClick={() => setSheetOpen(false)}>
                      <Link to="/dashboard"><GraduationCap className="h-4 w-4 mr-2" />Dashboard</Link>
                    </Button>
                  )}
                  {!isProfile && (
                    <Button asChild variant="outline" size="sm" onClick={() => setSheetOpen(false)}>
                      <Link to="/profile"><User className="h-4 w-4 mr-2" />Profile</Link>
                    </Button>
                  )}
                  <GCalStatusButton />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
        </>
      );
    }

    return (
      <>
      <DemoBanner />
      <nav className={`sticky ${isDemoMode ? 'top-[36px]' : 'top-0'} z-50 bg-background/90 backdrop-blur-md border-b border-border h-14 px-6 flex items-center justify-between`}>
        <div className="flex items-center gap-3 min-w-0">
          <Logo />
          {showStudentSwitcher && <NavStudentSwitcher />}
          {leftContent}
        </div>
        <div className="flex items-center gap-3">
          {onGenerateWorksheet && isDashboard && (
            <Button size="sm" onClick={onGenerateWorksheet}>
              <Plus className="h-4 w-4 mr-2" />
              Generate Worksheet
            </Button>
          )}
          {onGenerateWorksheet && !isDashboard && (
            <Button asChild size="sm">
              <a
                href="/"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                  e.preventDefault();
                  onGenerateWorksheet();
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Generate Worksheet
              </a>
            </Button>
          )}
          {subscriptionType && (
            <Badge variant="secondary" className="text-sm shrink-0">{subscriptionType}</Badge>
          )}
          <Badge variant="outline" className="text-sm">
            Tokens: {tokenLeft}
          </Badge>
          <UnifiedBell />
          <PacingProposalsBell />
          {!isDashboard && (
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard"><GraduationCap className="h-4 w-4 mr-2" />Dashboard</Link>
            </Button>
          )}
          {!isProfile && (
            <Button asChild variant="outline" size="sm">
              <Link to="/profile"><User className="h-4 w-4 mr-2" />Profile</Link>
            </Button>
          )}
          <GCalStatusButton />
        </div>
      </nav>
      </>
    );
  }

  // Anonymous nav
  if (isMobile) {
    return (
      <nav className={`${anonNavPosClass} h-14 px-4 flex items-center justify-between`}>
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-700 rounded-full relative">
            <Link to="/signup" state={fromState}>
              Start Free
              <Badge className="absolute -top-2 -right-2 bg-green-500 text-white animate-pulse text-[9px] px-1 py-0 border-0 leading-tight">
                2 FREE
              </Badge>
            </Link>
          </Button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex flex-col gap-3 pt-8">
                <div className="border-b border-border pb-3 mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1">Features</p>
                  <FeatureNavPills variant="stacked" onItemClick={() => setSheetOpen(false)} />
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                  scrollToPricing ? scrollToPricing() : navigate('/pricing');
                  setSheetOpen(false);
                }}>
                  Pricing
                </Button>
                <Button asChild variant="outline" size="sm" onClick={() => setSheetOpen(false)}>
                  <Link to="/login" state={fromState}>Log in</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    );
  }

  return (
    <nav className={`${anonNavPosClass} h-14 px-6 flex items-center justify-between`}>
      <div className="flex items-center gap-4">
        <Logo />
        <FeatureNavPills />
      </div>
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <Link to="/how-it-works" state={fromState}>How it works</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => scrollToPricing ? scrollToPricing() : navigate('/pricing')}
          className="text-muted-foreground hover:text-foreground"
        >
          Pricing
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link to="/login" state={fromState}>Log in</Link>
        </Button>
        <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-700 rounded-full relative">
          <Link to="/signup" state={fromState}>
            Start Free
            <Badge className="absolute -top-2 -right-2 bg-green-500 text-white animate-pulse text-[10px] px-1.5 py-0.5 border-0">
              2 FREE
            </Badge>
          </Link>
        </Button>
      </div>
    </nav>
  );
};

export default StickyNav;
