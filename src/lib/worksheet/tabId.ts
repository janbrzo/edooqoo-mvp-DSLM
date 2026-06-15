/**
 * v6.9.59 — Per-browser-tab identifier.
 *
 * Stored in sessionStorage so it is unique to a single tab (sessionStorage
 * is NOT shared between tabs of the same origin). Used by the worksheet
 * generation registry to scope the resumed-modal UI to the originating tab.
 */
import { useMemo } from 'react';

const KEY = 'edooqoo.tabId';

export function getTabId(): string {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return 'tab_anon';
    let id = window.sessionStorage.getItem(KEY);
    if (!id) {
      id =
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto && crypto.randomUUID())
        || `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      window.sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'tab_anon';
  }
}

export function useTabId(): string {
  return useMemo(getTabId, []);
}
