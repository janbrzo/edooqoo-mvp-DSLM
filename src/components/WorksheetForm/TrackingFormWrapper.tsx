
import React, { useEffect, useState } from 'react';
import { useEventTracking } from '@/hooks/useEventTracking';

interface TrackingFormWrapperProps {
  children: React.ReactNode;
  userId?: string;
}

const TrackingFormWrapper: React.FC<TrackingFormWrapperProps> = ({ children, userId }) => {
  const { trackEvent, startTimer } = useEventTracking(userId);
  const [hasStartedForm, setHasStartedForm] = useState(false);

  // Track form start when component mounts
  useEffect(() => {
    if (!hasStartedForm) {
      trackEvent({
        eventType: 'form_start',
        eventData: {
          timestamp: new Date().toISOString(),
          referrer: document.referrer || 'direct'
        }
      });
      setHasStartedForm(true);
      startTimer();
    }
  }, [trackEvent, startTimer, hasStartedForm]);

  // Track form abandon when user leaves page or switches tabs
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasStartedForm) {
        trackEvent({
          eventType: 'form_abandon_page_leave',
          eventData: {
            timestamp: new Date().toISOString(),
            url: window.location.href
          }
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && hasStartedForm) {
        trackEvent({
          eventType: 'form_abandon_tab_switch',
          eventData: {
            timestamp: new Date().toISOString(),
            reason: 'visibility_change',
            url: window.location.href
          }
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [trackEvent, hasStartedForm]);

  return <>{children}</>;
};

export default TrackingFormWrapper;
