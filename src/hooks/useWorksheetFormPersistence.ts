/**
 * useWorksheetFormPersistence — auto-saves the public worksheet form draft to localStorage
 * for 24h, so accidental refresh / tab-close doesn't wipe the teacher's work.
 *
 * Scope: anonymous + authenticated users on the home form. Keyed per-user when possible.
 * NOT used inside DSLM-prefilled flows (those have their own session prefill that wins).
 */
import { useEffect, useRef, useCallback } from 'react';

const STORAGE_PREFIX = 'edooqoo.worksheetFormDraft';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface WorksheetDraft {
  lessonTime?: string;
  lessonTopic?: string;
  lessonGoal?: string;
  grammarFocus?: string;
  additionalInformation?: string;
  englishLevel?: string;
  languageStyle?: number;
  selectedExercises?: string[];
  selectedMediaTypes?: string[];
  exerciseFocusMap?: Record<string, string>;
  selectionMode?: string;
  /**
   * v6.9.60 — Persist the selected student so a failed generation does not
   * silently drop the student context on re-hydration. Stored as a plain id;
   * a hydration step in WorksheetForm restores it (and the parent Index
   * state via the existing `onStudentChange` effect).
   */
  selectedStudentId?: string;
}

interface StoredDraft {
  savedAt: number;
  data: WorksheetDraft;
}

export function useWorksheetFormPersistence(
  key: string,
  current: WorksheetDraft,
  apply: (draft: WorksheetDraft) => void,
) {
  const storageKey = `${STORAGE_PREFIX}.${key || 'anon'}`;
  const hydratedRef = useRef(false);
  const lastKeyRef = useRef<string>(storageKey);

  // Hydrate on mount AND whenever the key (userId) changes from anon → real id.
  // Without this, drafts saved under the user's id were never read back if the
  // first render happened with userId=null.
  useEffect(() => {
    if (hydratedRef.current && lastKeyRef.current === storageKey) return;
    hydratedRef.current = true;
    lastKeyRef.current = storageKey;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredDraft;
      if (!parsed?.savedAt || Date.now() - parsed.savedAt > TTL_MS) {
        localStorage.removeItem(storageKey);
        return;
      }
      // Don't overwrite if a DSLM prefill ran in this session
      const dslmPrefill = sessionStorage.getItem('prefillWorksheet')
        || sessionStorage.getItem('prefillExercises')
        || sessionStorage.getItem('autoGenerateWorksheet');
      if (dslmPrefill) return;
      if (parsed.data && typeof parsed.data === 'object') {
        apply(parsed.data);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Debounced auto-save
  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        // Skip empty drafts
        const hasContent = (current.lessonTopic?.trim()?.length ?? 0) > 0
          || (current.lessonGoal?.trim()?.length ?? 0) > 0
          || (current.grammarFocus?.trim()?.length ?? 0) > 0
          || (current.additionalInformation?.trim()?.length ?? 0) > 0;
        if (!hasContent) return;
        const payload: StoredDraft = { savedAt: Date.now(), data: current };
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch {
        // ignore quota errors
      }
    }, 600);
    return () => window.clearTimeout(handle);
  }, [storageKey, current]);

  const clear = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  return { clear };
}