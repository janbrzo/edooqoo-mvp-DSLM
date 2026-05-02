
import React, { useEffect, useState } from 'react';
import { useEventTracking } from '@/hooks/useEventTracking';

interface WorksheetViewTrackingProps {
  children: React.ReactNode;
  worksheetId?: string;
  userId?: string;
}

const WorksheetViewTracking: React.FC<WorksheetViewTrackingProps> = ({ 
  children, 
  worksheetId, 
  userId 
}) => {
  const { trackEvent, startTimer, trackTimeSpent } = useEventTracking(userId);
  const [hasStartedViewing, setHasStartedViewing] = useState(false);

  // Track worksheet view start
  useEffect(() => {
    if (worksheetId && !hasStartedViewing) {
      trackEvent({
        eventType: 'worksheet_view_time',
        eventData: {
          worksheetId,
          timestamp: new Date().toISOString()
        }
      });
      setHasStartedViewing(true);
      startTimer();
    }
  }, [worksheetId, trackEvent, startTimer, hasStartedViewing]);

  // Track worksheet view end events
  useEffect(() => {
    if (!hasStartedViewing) return;

    const handleBeforeUnload = () => {
      trackTimeSpent('worksheet_view_end_page_leave', {
        worksheetId,
        timestamp: new Date().toISOString()
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        trackTimeSpent('worksheet_view_end_tab_switch', {
          worksheetId,
          timestamp: new Date().toISOString()
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasStartedViewing, worksheetId, trackTimeSpent]);

  return <>{children}</>;
};

export default WorksheetViewTracking;
