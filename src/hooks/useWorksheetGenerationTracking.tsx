
import { useEffect } from 'react';
import { useEventTracking } from './useEventTracking';

export const useWorksheetGenerationTracking = (
  isGenerating: boolean,
  worksheetData: any,
  error: any
) => {
  const { trackEvent } = useEventTracking();

  useEffect(() => {
    if (isGenerating) {
      trackEvent({
        eventType: 'worksheet_generation_start',
        eventData: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }, [isGenerating, trackEvent]);

  useEffect(() => {
    if (!isGenerating && worksheetData) {
      trackEvent({
        eventType: 'worksheet_generation_complete',
        eventData: {
          timestamp: new Date().toISOString(),
          success: true,
          worksheetId: worksheetData.id
        }
      });
    }
  }, [isGenerating, worksheetData, trackEvent]);

  useEffect(() => {
    if (!isGenerating && error) {
      trackEvent({
        eventType: 'worksheet_generation_complete',
        eventData: {
          timestamp: new Date().toISOString(),
          success: false,
          error: error.message || 'Unknown error'
        }
      });
    }
  }, [isGenerating, error, trackEvent]);
};
