
import { useEventTracking } from './useEventTracking';

export const useDownloadTracking = (userId?: string) => {
  const { trackEvent } = useEventTracking(userId);

  const trackDownloadAttempt = (isLocked: boolean, worksheetId: string, additionalData?: any) => {
    trackEvent({
      eventType: isLocked ? 'download_attempt_locked' : 'download_attempt_unlocked',
      eventData: {
        worksheetId,
        timestamp: new Date().toISOString(),
        ...additionalData
      }
    });
  };

  return {
    trackDownloadAttempt
  };
};
