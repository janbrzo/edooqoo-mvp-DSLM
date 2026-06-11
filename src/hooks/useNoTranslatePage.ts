import { useEffect } from 'react';

/**
 * v6.9.55 — Block Chrome / Google Translate auto-translation on a specific
 * route. Used by Welcome Test so the placement diagnostic stays in English
 * and the result is meaningful.
 *
 * Applies, on mount:
 *   - `<html translate="no">`
 *   - `<html class="notranslate">` (combined with body wrapper from caller)
 *   - `<meta name="google" content="notranslate">` in <head>
 * All values are restored on unmount.
 */
export function useNoTranslatePage(_surfaceName = 'edooqoo-no-translate') {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const prevTranslate = root.getAttribute('translate');
    const hadNotranslateClass = root.classList.contains('notranslate');

    root.setAttribute('translate', 'no');
    if (!hadNotranslateClass) root.classList.add('notranslate');

    let meta: HTMLMetaElement | null = document.querySelector(
      'meta[name="google"][content="notranslate"]'
    );
    let createdMeta = false;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'google');
      meta.setAttribute('content', 'notranslate');
      document.head.appendChild(meta);
      createdMeta = true;
    }

    return () => {
      try {
        if (prevTranslate === null) {
          root.removeAttribute('translate');
        } else {
          root.setAttribute('translate', prevTranslate);
        }
        if (!hadNotranslateClass) root.classList.remove('notranslate');
        if (createdMeta && meta && meta.parentNode) {
          meta.parentNode.removeChild(meta);
        }
      } catch {
        /* ignore */
      }
    };
  }, []);
}