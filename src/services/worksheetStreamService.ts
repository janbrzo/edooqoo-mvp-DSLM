/**
 * Worksheet Streaming Service
 * Handles SSE connection to backend for real-time worksheet generation
 */

interface StreamCallbacks {
  onStart?: () => void;
  onProgress?: (progress: { exercisesGenerated: number; expectedTotal: number }) => void;
  onDone?: (result: { worksheetId: string; worksheet: any }) => void;
  onError?: (error: Error) => void;
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
  const controller = new AbortController();
  
  // Use the same URL as regular generation
  const GENERATE_WORKSHEET_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generateWorksheet`;
  
  console.log('🚀 Starting streaming worksheet generation...', { hasUserId: !!userId });

  // v5.1: heartbeat — abort if no chunk arrives for 40s.
  const HEARTBEAT_MS = 40000;
  let lastProgress = { exercisesGenerated: 0, expectedTotal: 0 };
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  const resetHeartbeat = () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      console.error('⏱️ Heartbeat timeout — aborting stream after 40s of silence');
      try { controller.abort(); } catch {}
      const detail = lastProgress.exercisesGenerated > 0
        ? `Connection lost — generated ${lastProgress.exercisesGenerated}/${lastProgress.expectedTotal || '?'} exercises before disconnect. Please retry.`
        : 'Connection lost — server stopped responding for 40s. Please retry.';
      callbacks.onError?.(new Error(detail));
    }, HEARTBEAT_MS);
  };
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
    signal: controller.signal
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
        console.log('✅ Stream completed');
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
          
          console.log(`📨 Received SSE event: ${eventType}`, data);
          
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
      const detail = lastProgress.exercisesGenerated > 0
        ? `Stream ended unexpectedly after generating ${lastProgress.exercisesGenerated}/${lastProgress.expectedTotal || '?'} exercises. Please retry.`
        : 'Stream ended unexpectedly without completion. Please retry.';
      callbacks.onError?.(new Error(detail));
    }
  }).catch(error => {
    if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null; }
    if (error.name === 'AbortError') {
      console.log('🛑 Stream aborted by user');
      return;
    }
    
    console.error('❌ Stream error:', error);
    callbacks.onError?.(error);
  }).finally(() => {
    if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null; }
  });
  
  return controller;
}
