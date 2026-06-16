import { devLog } from '@/utils/logger';
/**
 * Worksheet Streaming Service
 * Handles SSE connection to backend for real-time worksheet generation
 */

interface StreamCallbacks {
  onStart?: () => void;
  onProgress?: (progress: { exercisesGenerated: number; expectedTotal: number }) => void;
  onDone?: (result: { worksheetId: string; worksheet: any }) => void;
  onError?: (error: Error) => void;
  /**
   * v6.9.55 — Fired when the underlying fetch/SSE stream closed cleanly but
   * NO `done` and NO `error` event arrived AND the model had already
   * streamed at least one exercise. The caller is expected to attempt a
   * DB-based reconciliation (look up the worksheet row by
   * `clientGenerationId`) before deciding whether to surface a real error.
   * If this callback is not provided, the service falls back to `onError`
   * with the legacy "Stream ended unexpectedly..." message.
   */
  onStreamEndedWithoutTerminalEvent?: (lastProgress: {
    exercisesGenerated: number;
    expectedTotal: number;
  }) => void;
}

/**
 * Streams worksheet generation from backend
 * Returns AbortController for cancellation capability
 */
export function streamWorksheetGeneration(
  formData: any,
  userId: string | null,
  callbacks: StreamCallbacks
): AbortController {
  // Outer controller: returned to the caller (so they can still abort the
  // overall request). The inner controller is rebuilt on silent retry.
  const outerController = new AbortController();
  let innerController = new AbortController();
  let retryAttempted = false;
  
  // Use the same URL as regular generation
  const GENERATE_WORKSHEET_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generateWorksheet`;

  devLog('🚀 Starting streaming worksheet generation...', { hasUserId: !!userId });

  // H5 (v6.9.27): heartbeat raised to 45s and now backed by a server-side
  // keepalive comment frame every 15s. Before tearing the stream down we try
  // a single silent retry if no exercise has streamed yet.
  const HEARTBEAT_MS = 45000;
  let lastProgress = { exercisesGenerated: 0, expectedTotal: 0 };
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanupHeartbeat = () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  };

  const resetHeartbeat = () => {
    cleanupHeartbeat();
    heartbeatTimer = setTimeout(() => {
      if (lastProgress.exercisesGenerated === 0 && !retryAttempted) {
        // Silent retry: nothing was streamed yet, so the user did not see any
        // partial state. Tear down the inner stream and start a fresh one.
        retryAttempted = true;
        console.warn('⏱️ Heartbeat timeout before first exercise — silent retry');
        try { innerController.abort(); } catch {}
        innerController = new AbortController();
        startRequest();
        return;
      }
      console.error('⏱️ Heartbeat timeout — aborting stream after 45s of silence');
      try { innerController.abort(); } catch {}
      try { outerController.abort(); } catch {}
      const detail = lastProgress.exercisesGenerated > 0
        ? `Connection lost — generated ${lastProgress.exercisesGenerated}/${lastProgress.expectedTotal || '?'} exercises before disconnect. Please retry.`
        : 'Connection lost — server stopped responding for 45s. Please retry.';
      callbacks.onError?.(new Error(detail));
    }, HEARTBEAT_MS);
  };

  // Forward an outer abort to the active inner request.
  outerController.signal.addEventListener('abort', () => {
    try { innerController.abort(); } catch {}
    cleanupHeartbeat();
  });

  const startRequest = () => {
    resetHeartbeat();
    fetch(GENERATE_WORKSHEET_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      ...formData,
      enableStreaming: true,  // ← KEY FLAG: enables streaming mode
      userId: userId || null  // ← FIXED: Pass null for anonymous mode (edge function accepts it)
    }),
    signal: innerController.signal
  }).then(async response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No readable stream available');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    let receivedDoneOrError = false;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        devLog('✅ Stream completed');
        break;
      }
      resetHeartbeat();
      
      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE events (format: "event: type\ndata: {...}\n\n")
      const events = buffer.split('\n\n');
      buffer = events.pop() || ''; // Keep incomplete event in buffer
      
      for (const event of events) {
        if (!event.trim()) continue;
        
        const lines = event.split('\n');
        const eventLine = lines.find(l => l.startsWith('event: '));
        const dataLine = lines.find(l => l.startsWith('data: '));
        
        if (!eventLine || !dataLine) continue;
        
        const eventType = eventLine.replace('event: ', '').trim();
        const dataStr = dataLine.replace('data: ', '').trim();
        
        try {
          const data = JSON.parse(dataStr);
          
          devLog(`📨 Received SSE event: ${eventType}`, data);
          
          switch (eventType) {
            case 'start':
              callbacks.onStart?.();
              break;
            case 'progress':
              lastProgress = { exercisesGenerated: data?.exercisesGenerated ?? lastProgress.exercisesGenerated, expectedTotal: data?.expectedTotal ?? lastProgress.expectedTotal };
              callbacks.onProgress?.(data);
              break;
            case 'done':
              receivedDoneOrError = true;
              callbacks.onDone?.(data);
              break;
            case 'error':
              receivedDoneOrError = true;
              callbacks.onError?.(new Error(data.message || 'Stream error'));
              break;
          }
        } catch (parseError) {
          console.error('❌ Failed to parse SSE data:', parseError, dataStr);
        }
      }
    }
    
    if (!receivedDoneOrError) {
      console.error('⚠️ Stream ended without done/error event');
      // v6.9.55 — if at least one exercise streamed, the worksheet may be
      // saved on the backend already. Hand the decision to the caller, who
      // will reconcile against the `worksheets` table before showing a
      // hard failure to the user.
      if (
        lastProgress.exercisesGenerated > 0 &&
        callbacks.onStreamEndedWithoutTerminalEvent
      ) {
        callbacks.onStreamEndedWithoutTerminalEvent({
          exercisesGenerated: lastProgress.exercisesGenerated,
          expectedTotal: lastProgress.expectedTotal,
        });
      } else {
        const detail = lastProgress.exercisesGenerated > 0
          ? `Stream ended unexpectedly after generating ${lastProgress.exercisesGenerated}/${lastProgress.expectedTotal || '?'} exercises. Please retry.`
          : 'Stream ended unexpectedly without completion. Please retry.';
        callbacks.onError?.(new Error(detail));
      }
    }
  }).catch(error => {
    cleanupHeartbeat();
    if (error.name === 'AbortError') {
      devLog('🛑 Stream aborted by user');
      return;
    }

    console.error('❌ Stream error:', error);
    // v6.9.60 — Treat network-class transport errors as RECOVERABLE when any
    // progress has streamed and the caller wired the reconciliation callback.
    // The backend `EdgeRuntime.waitUntil(backgroundWork)` keeps the worker
    // alive after a client disconnect, so the worksheet row is very likely
    // saved or about to be saved. Hand off to the DB reconciliation path
    // instead of immediately surfacing a hard failure to the user.
    const msg = (error?.message ?? String(error)) as string;
    const isTransport =
      error?.name === 'TypeError'
      || msg.includes('Failed to fetch')
      || msg.includes('NetworkError')
      || msg.includes('network error')
      || msg.includes('net::ERR');
    if (
      isTransport
      && lastProgress.exercisesGenerated > 0
      && callbacks.onStreamEndedWithoutTerminalEvent
    ) {
      callbacks.onStreamEndedWithoutTerminalEvent({
        exercisesGenerated: lastProgress.exercisesGenerated,
        expectedTotal: lastProgress.expectedTotal,
      });
      return;
    }
    callbacks.onError?.(error);
  }).finally(() => {
    cleanupHeartbeat();
  });
  };

  startRequest();

  return outerController;
}
