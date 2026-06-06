import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brain, BrainCircuit, GraduationCap, ClipboardCheck, Calendar, Radio, Layers, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEventTracking } from '@/hooks/useEventTracking';

/**
 * Feature pills for anonymous public nav.
 * These now route to the public feature pages instead of scrolling the landing
 * page, so every feature page remains one puzzle piece in the same workflow.
 */

export interface FeaturePillItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  anchorId: string;
  path: string;
}

export const FEATURE_PILLS: FeaturePillItem[] = [
  { label: '1-Minute Prep', icon: Brain, anchorId: 'feature-one-minute-prep', path: '/one-minute-prep' },
  { label: 'Welcome Test', icon: GraduationCap, anchorId: 'feature-placement-test', path: '/features/placement-test' },
  { label: 'DSLM', icon: BrainCircuit, anchorId: 'feature-dslm', path: '/features/dslm' },
  { label: 'Homework', icon: ClipboardCheck, anchorId: 'feature-homework', path: '/features/homework' },
  { label: 'Flashcards', icon: Layers, anchorId: 'feature-flashcards', path: '/features/flashcards' },
  { label: 'Live Sessions', icon: Radio, anchorId: 'feature-live-sessions', path: '/features/live-sessions' },
  { label: 'Calendar', icon: Calendar, anchorId: 'feature-calendar', path: '/features/calendar' },
  { label: 'Student Hub', icon: Users, anchorId: 'feature-student-hub', path: '/features/student-hub' },
];

interface FeatureNavPillsProps {
  variant?: 'inline' | 'stacked';
  onItemClick?: () => void;
  className?: string;
  /**
   * Kept for backwards compatibility with StickyNav call sites. Public feature
   * pills are route links now, so there is no delayed signup prompt to suppress.
   */
  suppressSignupPrompt?: boolean;
}

const FeatureNavPills: React.FC<FeatureNavPillsProps> = ({
  variant = 'inline',
  onItemClick,
  className,
  suppressSignupPrompt: _suppressSignupPrompt = false,
}) => {
  const location = useLocation();
  const { trackEvent } = useEventTracking();

  const handleClick = (item: FeaturePillItem) => {
    onItemClick?.();
    trackEvent({
      eventType: item.anchorId === 'feature-one-minute-prep' ? 'one_minute_dslm_card_click' : 'one_minute_feature_pill_click',
      eventData: { anchorId: item.anchorId, label: item.label, location: location.pathname },
    });
  };

  if (variant === 'stacked') {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        {FEATURE_PILLS.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.anchorId}
              to={item.path}
              onClick={() => handleClick(item)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent',
              )}
            >
              <Icon className="h-4 w-4 shrink-0 text-violet-600" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('hidden items-center gap-1 lg:flex', className)}>
      {FEATURE_PILLS.map((item) => {
        const Icon = item.icon;
        const active = location.pathname === item.path;
        return (
          <Link
            key={item.anchorId}
            to={item.path}
            onClick={() => handleClick(item)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            aria-label={`Learn about ${item.label}`}
          >
            <Icon className="h-3.5 w-3.5 text-violet-600" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
};

export default FeatureNavPills;
