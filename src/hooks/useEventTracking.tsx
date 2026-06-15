
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { devLog } from '@/utils/logger';

// v6.9.0 — Defer non-critical analytics to idle so they exit the LCP/TBT
// critical path. requestIdleCallback fallback for Safari (setTimeout 0).
// v6.9.1 — Additionally hold the FIRST event back by 3s so it is fully
// outside the LCP window on mobile 4G. PageSpeed report showed
// `track-user-event` was still in the critical request chain at 2.7s.
const scheduleIdle = (cb: () => void, delayMs = 0) => {
  if (typeof window === 'undefined') return;
  const fire = () => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(cb, { timeout: 2000 });
    } else {
      setTimeout(cb, 0);
    }
  };
  if (delayMs > 0) {
    setTimeout(fire, delayMs);
  } else {
    fire();
  }
};

export interface TrackingEvent {
  eventType: 
    | 'form_start' 
    | 'form_abandon_page_leave' 
    | 'form_abandon_tab_switch'
    | 'form_submit'
    | 'worksheet_generation_start'
    | 'worksheet_generation_complete'
    | 'worksheet_view_time'
    | 'worksheet_view_end_page_leave'
    | 'worksheet_view_end_tab_switch'
    | 'download_attempt_locked' 
    | 'download_attempt_unlocked'
    | 'payment_button_click'
    | 'stripe_payments_success'
    | 'one_minute_hero_cta_click'
    | 'one_minute_secondary_cta_click'
    | 'one_minute_feature_pill_click'
    | 'one_minute_dslm_card_click'
    | 'one_minute_calculator_input_change'
    | 'one_minute_calculator_cta_click'
    | 'one_minute_calculator_pricing_click'
    | 'content_view'
    | 'content_cta_click'
    | 'decision_tool_start'
    | 'decision_tool_complete'
    | 'decision_tool_copy'
    | 'newsletter_submit'
    | 'newsletter_confirm'
    | 'case_share';
  eventData?: any;
  userIdentifier?: string;
}

export const useEventTracking = (userId?: string) => {
  const [sessionId] = useState(() => uuidv4());
  const [isTracking, setIsTracking] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const trackedEventsRef = useRef<Set<string>>(new Set());
  const firstEventFiredRef = useRef(false);

  const trackEvent = useCallback(async (event: TrackingEvent) => {
    const eventId = `${event.eventType}_${sessionId}_${Date.now()}`;
    if (trackedEventsRef.current.has(eventId)) {
      devLog('Event already tracked, skipping:', eventId);
      return;
    }
    devLog('Tracking event (idle):', event.eventType, event.eventData);
    setIsTracking(true);
    // First event: 3s delay so it is past LCP on slow 4G. Subsequent events
    // fire on idle immediately.
    const firstEventDelay = firstEventFiredRef.current ? 0 : 3000;
    firstEventFiredRef.current = true;
    scheduleIdle(() => {
      supabase.functions
        .invoke('track-user-event', {
          body: {
            eventType: event.eventType,
            eventData: event.eventData,
            userIdentifier: event.userIdentifier || userId || undefined,
            sessionId,
          },
        })
        .then(({ error }) => {
          if (error) {
            console.error('Failed to track event:', error);
          } else {
            trackedEventsRef.current.add(eventId);
            devLog('Event tracked successfully:', event.eventType);
          }
        })
        .catch((error) => {
          console.error('Error tracking event:', error);
        })
        .finally(() => {
          setIsTracking(false);
        });
    }, firstEventDelay);
  }, [sessionId, userId]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
  }, []);

  const trackTimeSpent = useCallback((eventType: TrackingEvent['eventType'], additionalData?: any) => {
    if (startTimeRef.current) {
      const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
      trackEvent({
        eventType,
        eventData: {
          timeSpentSeconds: timeSpent,
          ...additionalData
        }
      });
      startTimeRef.current = null;
    }
  }, [trackEvent]);

  return {
    trackEvent,
    startTimer,
    trackTimeSpent,
    sessionId,
    isTracking
  };
};
