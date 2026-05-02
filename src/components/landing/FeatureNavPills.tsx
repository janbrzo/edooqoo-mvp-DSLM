import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, ClipboardCheck, Calendar, Radio, Layers, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import SignupPromptDialog from '@/components/landing/SignupPromptDialog';

/**
 * Feature pills for anonymous nav. v6.9.4 behavior:
 *  1. Click on landing (/) → smooth scroll to #feature-<id>.
 *  2. After 2500ms → open <SignupPromptDialog> (per-feature copy) UNLESS
 *     the user already dismissed this prompt this session, OR is logged in
 *     (parent passes `suppressSignupPrompt`), OR navigated away.
 *  3. Click off landing → navigate to /signup with deep-link state.
 *
 * Anchors must match `anchorId` set in EcosystemSection.tsx feature[].
 */

export interface FeaturePillItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  anchorId: string;
}

export const FEATURE_PILLS: FeaturePillItem[] = [
  { label: 'Placement Test', icon: GraduationCap, anchorId: 'feature-placement-test' },
  { label: 'Homework', icon: ClipboardCheck, anchorId: 'feature-homework' },
  { label: 'Calendar', icon: Calendar, anchorId: 'feature-calendar' },
  { label: 'Live Sessions', icon: Radio, anchorId: 'feature-live-sessions' },
  { label: 'Flashcards', icon: Layers, anchorId: 'feature-flashcards' },
  { label: 'Student Hub', icon: Users, anchorId: 'feature-student-hub' },
];

interface FeatureNavPillsProps {
  variant?: 'inline' | 'stacked';
  onItemClick?: () => void;
  className?: string;
  /**
   * When true, suppresses the 2.5s signup prompt dialog. Use for logged-in
   * users (passed by StickyNav).
   */
  suppressSignupPrompt?: boolean;
}

const PROMPT_DELAY_MS = 2500;
const SS_KEY_PREFIX = 'edooqoo.signupPrompt.dismissed.';

const FeatureNavPills: React.FC<FeatureNavPillsProps> = ({
  variant = 'inline',
  onItemClick,
  className,
  suppressSignupPrompt = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const timeoutRef = useRef<number | null>(null);
  const [dialogState, setDialogState] = useState<{ open: boolean; feature: FeaturePillItem | null }>({
    open: false,
    feature: null,
  });

  // Cancel any pending prompt when route changes (e.g. user clicks pill then navigates away).
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [location.pathname]);

  const handleClick = (anchorId: string) => {
    onItemClick?.();
    const item = FEATURE_PILLS.find((p) => p.anchorId === anchorId) || null;
    // If already on landing, just scroll. Otherwise navigate to /signup with deep-link.
    if (location.pathname === '/') {
      const el = document.getElementById(anchorId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Schedule signup prompt unless suppressed or already dismissed this session.
        if (!suppressSignupPrompt && typeof window !== 'undefined') {
          const dismissed = sessionStorage.getItem(SS_KEY_PREFIX + anchorId);
          if (!dismissed) {
            if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(() => {
              setDialogState({ open: true, feature: item });
              timeoutRef.current = null;
            }, PROMPT_DELAY_MS);
          }
        }
        return;
      }
    }
    navigate('/signup', { state: { from: '/', scrollTo: anchorId } });
  };

  const handleDialogChange = (open: boolean) => {
    if (!open && dialogState.feature) {
      try {
        sessionStorage.setItem(SS_KEY_PREFIX + dialogState.feature.anchorId, '1');
      } catch { /* quota — ignore */ }
    }
    setDialogState((s) => ({ ...s, open }));
  };

  const promptDialog = (
    <SignupPromptDialog
      open={dialogState.open}
      onOpenChange={handleDialogChange}
      feature={dialogState.feature}
    />
  );

  if (variant === 'stacked') {
    return (
      <>
        <div className={cn('flex flex-col gap-1', className)}>
          {FEATURE_PILLS.map(({ label, icon: Icon, anchorId }) => (
            <button
              key={anchorId}
              type="button"
              onClick={() => handleClick(anchorId)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors text-left"
            >
              <Icon className="h-4 w-4 text-violet-600 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {promptDialog}
      </>
    );
  }

  return (
    <>
      <div className={cn('hidden lg:flex items-center gap-1', className)}>
        {FEATURE_PILLS.map(({ label, icon: Icon, anchorId }) => (
          <button
            key={anchorId}
            type="button"
            onClick={() => handleClick(anchorId)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label={`Learn about ${label}`}
          >
            <Icon className="h-3.5 w-3.5 text-violet-600" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {promptDialog}
    </>
  );
};

export default FeatureNavPills;