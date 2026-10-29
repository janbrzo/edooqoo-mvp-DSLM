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
    detailedDescription: truncateAtSentenceBoundary(rawDescription, 1200),
  };
}
