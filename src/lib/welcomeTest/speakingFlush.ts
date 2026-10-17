/**
 * Single save path for the Welcome Test speaking recorder.
 *
 * The mounted SpeakingRecorder registers one flusher. Navigation (Next, Skip,
 * Previous, section jumps, Complete) calls `flushSpeaking()`, which stops an
 * active recording, waits for the final blob and uploads it once. It resolves
 * `false` when a recording exists but could not be saved, so the caller can
 * stay on the question instead of losing the audio.
 */
type Flusher = () => Promise<boolean>;

let flusher: Flusher | null = null;

export function registerSpeakingFlusher(fn: Flusher): () => void {
  flusher = fn;
  return () => {
    if (flusher === fn) flusher = null;
  };
}

export async function flushSpeaking(): Promise<boolean> {
  if (!flusher) return true;
  try {
    return await flusher();
  } catch {
    return false;
  }
}
