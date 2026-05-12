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
 */
export function createSSEStream(): SSEStream {
  let controller: ReadableStreamDefaultController;
  
  const readable = new ReadableStream({
    start(c) { 
      controller = c; 
    },
    cancel() { 
      console.log('🔴 SSE stream cancelled by client');
    }
  });
  
  return {
    readable,
    send: (event: string, data: any) => {
      try {
        const sseMessage = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(new TextEncoder().encode(sseMessage));
        console.log(`📡 SSE sent: ${event}`, data);
      } catch (error) {
        console.error('❌ Failed to send SSE message:', error);
      }
    },
    close: () => {
      try {
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
