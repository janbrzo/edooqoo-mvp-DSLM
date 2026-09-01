/**
 * Export hygiene (P2.1)
 *
 * Single contract for "what is worksheet content" vs "what is a teacher tool".
 * Anything spread with NO_EXPORT is stripped from PDF and standalone-HTML exports.
 * Anything spread with KEEP_IN_EXPORT survives the structural fallback below,
 * even when it is a button (used for interactive HTML exports).
 */

export const NO_EXPORT = { 'data-no-pdf': 'true' } as const;

export const KEEP_IN_EXPORT = { 'data-keep-in-export': 'true' } as const;

/**
 * Structural safety net: any application control that reached the export
 * without being tagged. Applied to PDF exports only — the standalone HTML
 * export stays attribute-driven so its injected navigation keeps working.
 */
export const INTERACTIVE_SELECTOR = [
  'button',
  '[role="button"]',
  '[role="dialog"]',
  '[role="tooltip"]',
  '[role="slider"]',
  'input[type="range"]',
  '.nav-sidebar',
  '.nav-menu-button',
  '.scroll-up-button',
].join(', ');

/** Remove leftover interactive controls from a cloned subtree (PDF only). */
export function stripInteractiveForPdf(root: HTMLElement | null | undefined): number {
  if (!root) return 0;
  const nodes = root.querySelectorAll(`${INTERACTIVE_SELECTOR}`);
  let removed = 0;
  nodes.forEach((node) => {
    if (node.closest('[data-keep-in-export="true"]')) return;
    node.remove();
    removed += 1;
  });
  return removed;
}

/**
 * An <audio> element is useless on paper. Replace each player with a printable
 * line carrying the source URL so the teacher can still reach the recording.
 */
export function replaceAudioWithPrintableLink(root: HTMLElement | null | undefined): number {
  if (!root) return 0;
  const doc = root.ownerDocument || document;
  const players = root.querySelectorAll('audio');
  let replaced = 0;
  players.forEach((audio) => {
    const src =
      audio.getAttribute('src') ||
      audio.querySelector('source')?.getAttribute('src') ||
      '';
    const line = doc.createElement('p');
    line.style.fontSize = '12px';
    line.style.color = '#4b5563';
    line.style.margin = '4px 0';
    line.textContent = src && !src.startsWith('data:')
      ? `Audio: ${src}`
      : 'Audio: available in the online version of this worksheet.';
    audio.replaceWith(line);
    replaced += 1;
  });
  return replaced;
}

/** Full PDF cleanup pass, run after the data-no-pdf removal. */
export function applyPdfExportHygiene(root: HTMLElement | null | undefined) {
  const audio = replaceAudioWithPrintableLink(root);
  const interactive = stripInteractiveForPdf(root);
  return { audio, interactive };
}
