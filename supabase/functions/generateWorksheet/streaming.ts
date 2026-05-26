/**
 * SSE Streaming Helper for OpenAI Response
 * Allows real-time progress updates during worksheet generation
 */

export interface SSEStream {
  readable: ReadableStream;
  send: (event: string, data: any) => void;
  close: () => void;
}

/**
 * Creates a Server-Sent Events (SSE) stream
 * Used to send real-time progress updates to the frontend
 *
 * H5 (v6.9.27): emits SSE comment frames (`: keepalive\n\n`) every 15s so the
 * client's heartbeat watchdog doesn't trip when the upstream model pauses
 * between chunks. Comments are ignored by the SSE event parser but count as
 * bytes on the wire and reset the client read watchdog.
 */
export function createSSEStream(): SSEStream {
  let controller: ReadableStreamDefaultController;
  const encoder = new TextEncoder();
  let keepaliveTimer: number | undefined;
  let closed = false;

  const stopKeepalive = () => {
    if (keepaliveTimer !== undefined) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = undefined;
    }
  };
  
  const readable = new ReadableStream({
    start(c) {
      controller = c;
      // H5 server keepalive — emit a comment frame every 15s.
      keepaliveTimer = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {
          stopKeepalive();
        }
      }, 15000) as unknown as number;
    },
    cancel() {
      closed = true;
      stopKeepalive();
      console.log('🔴 SSE stream cancelled by client');
    }
  });
  
  return {
    readable,
    send: (event: string, data: any) => {
      try {
        const sseMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(sseMessage));
        console.log(`📡 SSE sent: ${event}`, data);
      } catch (error) {
        console.error('❌ Failed to send SSE message:', error);
      }
    },
    close: () => {
      try {
        closed = true;
        stopKeepalive();
        controller.close();
        console.log('✅ SSE stream closed');
      } catch (error) {
        console.error('❌ Failed to close SSE stream:', error);
      }
    }
  };
}

/**
 * Parses partial JSON to detect completed exercises
 * Returns count of exercises found so far
 */
export function countExercisesInPartialJSON(content: string): number {
  try {
    // Count occurrences of "type": pattern which indicates exercise objects
    const matches = content.match(/"type"\s*:\s*"/g);
    return matches ? matches.length : 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Estimates expected total exercises based on lesson time
 */
export function getExpectedExerciseCount(lessonTime?: string): number {
  if (!lessonTime) return 8;
  return lessonTime === "45min" ? 6 : 8;
}
