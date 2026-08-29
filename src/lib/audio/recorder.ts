/**
 * Shared audio recording helpers.
 *
 * Two components record audio (welcome test SpeakingRecorder and
 * HomeworkSpeakingRecorder). Both used to call getUserMedia without checking
 * that the API exists, and one of them fabricated a fake "recording_<ts>"
 * answer when the upload failed — reporting a hard failure as success.
 *
 * This module centralises:
 *  - capability detection with actionable, user-facing messages
 *  - microphone error classification
 *  - R2 upload with retry that THROWS on failure (never returns a fake value)
 */

import { supabase } from '@/integrations/supabase/client';

export interface RecordingSupport {
  supported: boolean;
  /** User-facing reason when `supported` is false. */
  reason?: string;
}

/**
 * Check whether the current browser/context can record audio at all.
 * Must be called before `getUserMedia` — on insecure origins
 * `navigator.mediaDevices` is `undefined` and the call throws a bare
 * TypeError that is impossible to explain to a student.
 */
export function checkRecordingSupport(): RecordingSupport {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, reason: 'Recording is not available in this environment.' };
  }

  if (window.isSecureContext === false) {
    return {
      supported: false,
      reason: 'Recording requires a secure (HTTPS) connection. Open this page over HTTPS and try again.',
    };
  }

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return {
      supported: false,
      reason: "Your browser doesn't support microphone recording. Try the latest Chrome, Edge, Firefox or Safari.",
    };
  }

  if (typeof MediaRecorder === 'undefined') {
    return {
      supported: false,
      reason: "Your browser doesn't support audio recording. Try the latest Chrome, Edge, Firefox or Safari.",
    };
  }

  return { supported: true };
}

/** Translate a getUserMedia rejection into an actionable message. */
export function describeMicrophoneError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was blocked. Allow microphone permission for this site in your browser settings, then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found. Connect a microphone or headset and try again.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Your microphone is already in use by another app. Close it (e.g. Zoom, Meet, Teams) and try again.';
    case 'TypeError':
      return 'Recording is not available on this connection. It requires a secure (HTTPS) page.';
    default:
      return 'Could not access the microphone. Check your device settings and try again.';
  }
}

/** Pick a MediaRecorder mime type this browser actually supports. */
export function getSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const types = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (base64) resolve(base64);
      else reject(new Error('Failed to read the recording.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read the recording.'));
    reader.readAsDataURL(blob);
  });
}

const RETRY_DELAYS_MS = [500, 2000, 5000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface UploadRecordingOptions {
  /** Prefix for the stored object, e.g. 'welcome-test-speaking'. */
  filenamePrefix?: string;
  /** Called before each retry attempt (1-based attempt number). */
  onRetry?: (attempt: number) => void;
}

/**
 * Upload a recording to R2 and return its public URL.
 * Retries transient failures. THROWS when the upload ultimately fails —
 * callers must surface the error, never substitute a placeholder answer.
 */
export async function uploadRecording(
  blob: Blob,
  options: UploadRecordingOptions = {},
): Promise<string> {
  if (!blob || blob.size === 0) {
    throw new Error('The recording is empty. Please record again.');
  }

  const { filenamePrefix = 'recording', onRetry } = options;
  const base64Data = await blobToBase64(blob);

  const mimeType = blob.type || 'audio/webm';
  const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const filename = `${filenamePrefix}-${Date.now()}.${ext}`;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      onRetry?.(attempt);
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }

    try {
      const { data, error } = await supabase.functions.invoke('upload-to-r2', {
        body: { base64Data, filename, contentType: mimeType },
      });

      if (error) throw error;

      const url: string | undefined = data?.url || data?.publicUrl;
      if (!url) throw new Error('Upload succeeded but no file URL was returned.');

      return url;
    } catch (err) {
      lastError = err;
      console.error(`[uploadRecording] attempt ${attempt + 1} failed:`, err);
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error');
  throw new Error(`Upload failed: ${detail}`);
}

/**
 * Non-throwing variant for background/auto-save paths that must not crash.
 * Returns `null` on failure so the caller can keep the blob and retry.
 */
export async function tryUploadRecording(
  blob: Blob,
  options: UploadRecordingOptions = {},
): Promise<string | null> {
  try {
    return await uploadRecording(blob, options);
  } catch (err) {
    console.error('[tryUploadRecording] failed:', err);
    return null;
  }
}
