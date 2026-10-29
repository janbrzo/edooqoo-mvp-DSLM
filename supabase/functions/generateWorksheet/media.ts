import { replaceEmDashes } from "./emDash.ts";

// ============================================================
// v6.9.64 — Worksheet-local image description sanitizer.
// Keeps DB row/image metadata intact; only the prompt-context copy
// of `selectedImage.detailedDescription` is bounded so very long
// vision outputs do not destabilize JSON-only worksheet generation.
// ============================================================
export function truncateAtSentenceBoundary(value: string, maxChars: number): string {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars);
  const lastBoundary = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('; '),
    slice.lastIndexOf(': '),
  );
  if (lastBoundary > Math.floor(maxChars * 0.55)) {
    return slice.slice(0, lastBoundary + 1).trim();
  }
  return `${slice.trim()}...`;
}

export function buildWorksheetMediaContextImage(selectedImage: any): any {
  if (!selectedImage) return null;
  const rawDescription = selectedImage?.detailedDescription || selectedImage?.description || '';
  return {
    ...selectedImage,
    detailedDescription: replaceEmDashes(truncateAtSentenceBoundary(rawDescription, 1200)),
  };
}

/**
 * Prompt-context copy of the image for batch mode: the description is fed back
 * into the prompt, so an em dash in it is cleaned. Same object when clean.
 */
export function cleanImageForPrompt(selectedImage: any): any {
  if (!selectedImage || typeof selectedImage.detailedDescription !== 'string') return selectedImage;
  const detailedDescription = replaceEmDashes(selectedImage.detailedDescription);
  return detailedDescription === selectedImage.detailedDescription ? selectedImage : { ...selectedImage, detailedDescription };
}

/** Prompt-context copy of the audio: the transcript is fed back into the prompt (rule 21). Same object when clean. */
export function cleanAudioForPrompt(selectedAudio: any): any {
  if (!selectedAudio || typeof selectedAudio.transcript !== 'string') return selectedAudio;
  const transcript = replaceEmDashes(selectedAudio.transcript);
  return transcript === selectedAudio.transcript ? selectedAudio : { ...selectedAudio, transcript };
}
